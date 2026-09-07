"""Validate a real API key and the request shape with one cheap seat.

    ANTHROPIC_API_KEY=... python scripts/live_check.py

Runs seat 0 (framing) on the fast model against the live API, prints the usage,
the served model, whether a fallback ran, and the parsed framing. Costs a fraction
of a cent. Add --research to also run seat 1 with web search (a few cents).
"""

from __future__ import annotations

import os as _os
import sys as _sys

_sys.path.insert(0, _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))

import argparse
import asyncio
import json

from app.council.dossier import build_prompt
from app.council.seat import SeatContext
from app.council.seats import seat
from app.llm.anthropic_provider import AnthropicProvider
from app.llm.types import ProviderEvent, SeatRequest
from app.schemas import Framing, FramingOutput, output_schema
from app.schemas.framing import Brief
from app.settings import get_settings

IDEA = "A bookkeeping service that closes the books for independent restaurants every month."


async def main(research: bool) -> None:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise SystemExit("ANTHROPIC_API_KEY is not set")
    provider = AnthropicProvider(settings)

    async def on_event(ev: ProviderEvent) -> None:
        if ev.kind == "delta":
            print(ev.text, end="", flush=True)
        elif ev.kind == "thinking":
            print(f"\n[notes] {ev.text[:160]}")
        elif ev.kind == "tool":
            print(f"\n[{ev.tool_kind}] {ev.query or ev.url}")

    s0 = seat("0")
    ctx = SeatContext(idea=IDEA, framing=None, artifacts={}, settings=settings)
    prompt = build_prompt(s0, ctx)
    req = SeatRequest(seat_id="0", model=s0.model(settings), effort=s0.effort_for(settings), max_tokens=s0.max_tokens, system=prompt.system, messages=prompt.messages, output_schema=output_schema(FramingOutput), uses_web=False, thinking_display=settings.thinking_display)
    print(f"seat 0 on {req.model} (effort {req.effort})\n")
    out = await provider.run(req, on_event)
    framing = FramingOutput.model_validate(out.parsed)
    print("\n\nparsed framing:", json.dumps(framing.framing.model_dump(), indent=2))
    print("usage:", out.usage.model_dump(), "| served by:", out.model_served, "| fallback:", out.fallback_used, "| stop:", out.stop_reason)

    if research:
        s1 = seat("1")
        brief = Brief(idea=IDEA, framing=framing.framing, key_insight=framing.key_insight)
        ctx1 = SeatContext(idea=IDEA, framing=framing.framing, artifacts={"brief": brief}, settings=settings)
        p1 = build_prompt(s1, ctx1)
        req1 = SeatRequest(seat_id="1", model=s1.model(settings), effort=s1.effort_for(settings), max_tokens=s1.max_tokens, system=p1.system, messages=p1.messages, output_schema=None, uses_web=True, web_search_max_uses=4, web_fetch_max_uses=2, thinking_display=settings.thinking_display)
        print(f"\n\nseat 1 on {req1.model} with web search (max 4 searches)\n")
        out1 = await provider.run(req1, on_event)
        print(f"\n\ncitations: {len(out1.citations)} | searches billed: {out1.usage.web_searches} | usage: {out1.usage.model_dump()}")
        for c in out1.citations[:5]:
            print(f"  - {c.title[:60]} — {c.url}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--research", action="store_true")
    args = parser.parse_args()
    asyncio.run(main(args.research))
