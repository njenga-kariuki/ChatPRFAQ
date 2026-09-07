"""The Claude API provider.

One streaming Messages request per seat. Current-model facts this file encodes:
- adaptive thinking is on for every current model; no `budget_tokens`, no sampling
  parameters, no prefill, no forced tool choice;
- `output_config.effort` controls depth; `output_config.format` gives structured
  JSON (never combined with citations, so the research seat is free-form);
- refusals arrive as HTTP 200 with `stop_reason == "refusal"`; server-side
  fallbacks (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) re-run a
  declined request on Opus 5 / Opus 4.8 inside the same call;
- web search and fetch are server tools; citations ride on text blocks.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import anthropic

from app.llm.types import OnEvent, OutputTruncated, ProviderError, ProviderEvent, RefusalError, SeatOutcome, SeatRequest
from app.schemas.events import Usage
from app.schemas.research import Citation
from app.settings import Settings

log = logging.getLogger(__name__)

FALLBACK_BETA = "server-side-fallback-2026-07-01"
WEB_SEARCH_TOOL = "web_search_20260209"
WEB_FETCH_TOOL = "web_fetch_20260209"


def build_request_kwargs(req: SeatRequest, settings: Settings) -> dict[str, Any]:
    """Pure function so tests can assert the exact request shape without a network."""
    kwargs: dict[str, Any] = {
        "model": req.model,
        "max_tokens": req.max_tokens,
        "system": req.system,
        "messages": req.messages,
        "thinking": {"type": "adaptive", "display": req.thinking_display},
    }
    output_config: dict[str, Any] = {"effort": req.effort}
    if req.output_schema is not None:
        output_config["format"] = {"type": "json_schema", "schema": req.output_schema}
    kwargs["output_config"] = output_config

    if req.uses_web:
        kwargs["tools"] = [
            {"type": WEB_SEARCH_TOOL, "name": "web_search", "max_uses": req.web_search_max_uses},
            {"type": WEB_FETCH_TOOL, "name": "web_fetch", "max_uses": req.web_fetch_max_uses},
        ]

    betas: list[str] = []
    extra_body: dict[str, Any] = {}
    if settings.enable_fallbacks and req.model in settings.fallback_models_with_support:
        betas.append(FALLBACK_BETA)
        extra_body["fallbacks"] = "default"
    if betas:
        kwargs["betas"] = betas
    if extra_body:
        kwargs["extra_body"] = extra_body
    return kwargs


def _usage_from(msg: Any) -> Usage:
    u = getattr(msg, "usage", None)
    if u is None:
        return Usage()
    searches = 0
    stu = getattr(u, "server_tool_use", None)
    if stu is not None:
        searches = int(getattr(stu, "web_search_requests", 0) or 0) + int(getattr(stu, "web_fetch_requests", 0) or 0)
    return Usage(
        input_tokens=int(getattr(u, "input_tokens", 0) or 0),
        cache_creation_input_tokens=int(getattr(u, "cache_creation_input_tokens", 0) or 0),
        cache_read_input_tokens=int(getattr(u, "cache_read_input_tokens", 0) or 0),
        output_tokens=int(getattr(u, "output_tokens", 0) or 0),
        web_searches=searches,
    )


def _fallback_used(msg: Any, requested_model: str) -> bool:
    if getattr(msg, "model", requested_model) != requested_model:
        return True
    for block in getattr(msg, "content", []) or []:
        if getattr(block, "type", "") == "fallback":
            return True
    iterations = getattr(getattr(msg, "usage", None), "iterations", None) or []
    return any(getattr(it, "type", "") == "fallback_message" for it in iterations)


def _collect_text_and_citations(msg: Any) -> tuple[str, list[Citation]]:
    parts: list[str] = []
    citations: list[Citation] = []
    for block in getattr(msg, "content", []) or []:
        if getattr(block, "type", "") != "text":
            continue
        parts.append(block.text)
        for c in getattr(block, "citations", None) or []:
            url = getattr(c, "url", None)
            if not url:
                continue
            citations.append(
                Citation(url=url, title=getattr(c, "title", "") or "", cited_text=getattr(c, "cited_text", "") or "")
            )
    return "".join(parts), citations


class AnthropicProvider:
    name = "anthropic"

    def __init__(self, settings: Settings):
        if not settings.anthropic_api_key:
            raise ProviderError("ANTHROPIC_API_KEY is not set")
        self.settings = settings
        self.client = anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            max_retries=3,
            timeout=anthropic.Timeout(900.0, connect=10.0),
        )

    async def run(self, request: SeatRequest, on_event: OnEvent) -> SeatOutcome:
        kwargs = build_request_kwargs(request, self.settings)
        thinking_buffer: list[str] = []
        tool_blocks: dict[int, str] = {}
        try:
            async with self.client.beta.messages.stream(**kwargs) as stream:
                async for event in stream:
                    etype = getattr(event, "type", "")
                    if etype == "content_block_start":
                        block = event.content_block
                        if getattr(block, "type", "") == "server_tool_use":
                            tool_blocks[event.index] = getattr(block, "name", "")
                    elif etype == "content_block_delta":
                        delta = event.delta
                        dtype = getattr(delta, "type", "")
                        if dtype == "text_delta" and delta.text:
                            await on_event(ProviderEvent(kind="delta", text=delta.text))
                        elif dtype == "thinking_delta" and getattr(delta, "thinking", ""):
                            thinking_buffer.append(delta.thinking)
                    elif etype == "content_block_stop":
                        if thinking_buffer:
                            await on_event(ProviderEvent(kind="thinking", text="".join(thinking_buffer).strip()))
                            thinking_buffer.clear()
                        if event.index in tool_blocks:
                            name = tool_blocks.pop(event.index)
                            query, url = _tool_input(stream, event.index)
                            await on_event(
                                ProviderEvent(
                                    kind="tool",
                                    tool_kind="search" if name == "web_search" else "fetch",
                                    query=query,
                                    url=url,
                                )
                            )
                msg = await stream.get_final_message()
        except anthropic.RateLimitError as e:
            raise ProviderError(f"rate limited: {e.message}") from e
        except anthropic.APIStatusError as e:
            raise ProviderError(f"api error {e.status_code}: {e.message}") from e
        except anthropic.APIConnectionError as e:
            raise ProviderError(f"connection error: {e}") from e

        if msg.stop_reason == "refusal":
            details = getattr(msg, "stop_details", None)
            raise RefusalError(getattr(details, "category", None))
        if msg.stop_reason == "max_tokens":
            raise OutputTruncated(request.max_tokens)

        text, citations = _collect_text_and_citations(msg)
        parsed: dict | None = None
        if request.output_schema is not None:
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError as e:
                raise ProviderError(f"structured output was not valid JSON: {e}") from e

        return SeatOutcome(
            text=text,
            parsed=parsed,
            citations=citations,
            usage=_usage_from(msg),
            stop_reason=msg.stop_reason or "end_turn",
            model_served=getattr(msg, "model", request.model),
            fallback_used=_fallback_used(msg, request.model),
            request_id=getattr(msg, "_request_id", None),
        )


def _tool_input(stream: Any, index: int) -> tuple[str | None, str | None]:
    try:
        snapshot = stream.current_message_snapshot
        block = snapshot.content[index]
        inp = getattr(block, "input", None) or {}
        if isinstance(inp, str):
            inp = json.loads(inp)
        return inp.get("query"), inp.get("url")
    except Exception:  # snapshot shape is best-effort; the tool event is cosmetic
        return None, None
