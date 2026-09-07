"""The Anthropic provider's stream handling, exercised against a synthetic stream.

No network: the SDK's `client.beta.messages.stream` is replaced with an async
context manager that yields the same event shapes the real stream produces.
"""

from __future__ import annotations

import json
from types import SimpleNamespace as NS

import pytest

from app.llm.anthropic_provider import AnthropicProvider
from app.llm.types import OutputTruncated, RefusalError, SeatRequest
from app.settings import Settings

SYSTEM = [{"type": "text", "text": "charter"}]
MESSAGES = [{"role": "user", "content": [{"type": "text", "text": "task"}]}]


class FakeStream:
    def __init__(self, events, final):
        self._events = events
        self._final = final
        self.current_message_snapshot = NS(content=[NS(input={"query": "market size bookkeeping"})])
        self.kwargs = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def __aiter__(self):
        async def gen():
            for e in self._events:
                yield e

        return gen()

    async def get_final_message(self):
        return self._final


def _provider(stream: FakeStream) -> AnthropicProvider:
    settings = Settings(llm_provider="anthropic", anthropic_api_key="test", _env_file=None)
    provider = AnthropicProvider(settings)
    captured = {}

    def fake_stream(**kwargs):
        captured.update(kwargs)
        return stream

    provider.client.beta.messages.stream = fake_stream  # type: ignore[assignment]
    provider.captured = captured  # type: ignore[attr-defined]
    return provider


def _final(text: str, *, stop_reason="end_turn", model="claude-fable-5-1", citations=None, iterations=None, category=None):
    text_block = NS(type="text", text=text, citations=citations or [])
    usage = NS(input_tokens=1200, cache_creation_input_tokens=300, cache_read_input_tokens=9000, output_tokens=800, server_tool_use=NS(web_search_requests=3, web_fetch_requests=1), iterations=iterations)
    return NS(content=[text_block], stop_reason=stop_reason, model=model, usage=usage, stop_details=NS(category=category) if category else None, _request_id="req_1")


@pytest.mark.asyncio
async def test_streams_deltas_thinking_and_tools_then_parses_json():
    payload = {"items": [], "key_insight": "x"}
    text = json.dumps(payload)
    events = [
        NS(type="content_block_start", index=0, content_block=NS(type="thinking")),
        NS(type="content_block_delta", index=0, delta=NS(type="thinking_delta", thinking="Reading the ")),
        NS(type="content_block_delta", index=0, delta=NS(type="thinking_delta", thinking="dossier.")),
        NS(type="content_block_stop", index=0),
        NS(type="content_block_start", index=1, content_block=NS(type="server_tool_use", name="web_search")),
        NS(type="content_block_stop", index=1),
        NS(type="content_block_start", index=2, content_block=NS(type="text")),
        NS(type="content_block_delta", index=2, delta=NS(type="text_delta", text=text[:10])),
        NS(type="content_block_delta", index=2, delta=NS(type="text_delta", text=text[10:])),
        NS(type="content_block_stop", index=2),
    ]
    stream = FakeStream(events, _final(text, citations=[NS(url="https://x.test/a", title="A", cited_text="quoted")]))
    stream.current_message_snapshot = NS(content=[None, NS(input={"query": "market size bookkeeping"}), None])
    provider = _provider(stream)
    seen = []

    async def on_event(ev):
        seen.append((ev.kind, ev.text or ev.query))

    req = SeatRequest(seat_id="8", model="claude-fable-5-1", effort="high", max_tokens=16000, system=SYSTEM, messages=MESSAGES, output_schema={"type": "object"}, uses_web=False)
    out = await provider.run(req, on_event)

    assert ("thinking", "Reading the dossier.") in seen
    assert ("tool", "market size bookkeeping") in seen
    assert "".join(t for k, t in seen if k == "delta") == text
    assert out.parsed == payload
    assert out.usage.cache_read_input_tokens == 9000 and out.usage.web_searches == 4
    assert out.citations[0].url == "https://x.test/a" and out.citations[0].cited_text == "quoted"
    assert out.fallback_used is False and out.model_served == "claude-fable-5-1"
    assert provider.captured["fallbacks"] == "default" and provider.captured["betas"] == ["server-side-fallback-2026-07-01"]


@pytest.mark.asyncio
async def test_refusal_and_truncation_raise_typed_errors():
    provider = _provider(FakeStream([], _final("", stop_reason="refusal", category="cyber")))
    req = SeatRequest(seat_id="5", model="claude-fable-5-1", effort="high", max_tokens=100, system=SYSTEM, messages=MESSAGES, output_schema=None, uses_web=False)

    async def noop(_):
        return None

    with pytest.raises(RefusalError) as info:
        await provider.run(req, noop)
    assert info.value.category == "cyber"

    provider = _provider(FakeStream([], _final("partial", stop_reason="max_tokens")))
    with pytest.raises(OutputTruncated):
        await provider.run(req, noop)


@pytest.mark.asyncio
async def test_fallback_is_detected_from_served_model_or_iterations():
    provider = _provider(FakeStream([], _final("{}", model="claude-opus-4-8")))
    req = SeatRequest(seat_id="5", model="claude-fable-5-1", effort="high", max_tokens=100, system=SYSTEM, messages=MESSAGES, output_schema={"type": "object"}, uses_web=False)

    async def noop(_):
        return None

    out = await provider.run(req, noop)
    assert out.fallback_used is True and out.model_served == "claude-opus-4-8"

    provider = _provider(FakeStream([], _final("{}", iterations=[NS(type="message"), NS(type="fallback_message")])))
    out = await provider.run(req, noop)
    assert out.fallback_used is True
