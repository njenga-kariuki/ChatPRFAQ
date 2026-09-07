"""An offline provider that streams deterministic, schema-valid content.

It makes the whole system runnable without an API key: tests, the frontend
fixture, and demos. Outputs are keyed on the seat id carried in the request.
"""

from __future__ import annotations

import asyncio
import json

from app.llm import fake_content as fc
from app.llm.types import OnEvent, ProviderEvent, SeatOutcome, SeatRequest
from app.schemas.events import Usage
from app.schemas.research import Citation

CHUNK = 96


class FakeProvider:
    name = "fake"

    def __init__(self, delay_s: float = 0.0):
        self.delay_s = delay_s

    async def _stream_text(self, text: str, on_event: OnEvent) -> None:
        for i in range(0, len(text), CHUNK):
            await on_event(ProviderEvent(kind="delta", text=text[i : i + CHUNK]))
            if self.delay_s:
                await asyncio.sleep(self.delay_s)

    async def run(self, request: SeatRequest, on_event: OnEvent) -> SeatOutcome:
        ctx = request.context
        name = ctx.get("working_name") or fc.working_name_from(ctx.get("idea", ""))
        seat = request.seat_id

        await on_event(ProviderEvent(kind="thinking", text=f"Reading the dossier for seat {seat}."))
        if self.delay_s:
            await asyncio.sleep(self.delay_s * 4)

        citations: list[Citation] = []
        if seat == "1":
            for q in (f"{name} market size small business bookkeeping 2025", "small business bookkeeping willingness to pay", "cloud accounting penetration owner operated businesses"):
                await on_event(ProviderEvent(kind="tool", tool_kind="search", query=q))
                if self.delay_s:
                    await asyncio.sleep(self.delay_s * 3)
            await on_event(ProviderEvent(kind="tool", tool_kind="fetch", url="https://example.com/smb-bookkeeping-survey-2025"))
            text = fc.research_markdown(name)
            citations = [Citation(**c) for c in fc.research_citations()]
            await self._stream_text(text, on_event)
            usage = Usage(input_tokens=4200, cache_read_input_tokens=1900, output_tokens=1400, web_searches=4)
            return SeatOutcome(text=text, parsed=None, citations=citations, usage=usage, stop_reason="end_turn", model_served=request.model, fallback_used=False)

        payload: dict
        if seat == "0":
            payload = fc.framing(ctx.get("idea", ""), attempt=request.attempt, feedback=ctx.get("feedback"))
        elif seat == "1b":
            payload = fc.ledger(name, ctx.get("source_ids", []))
        elif seat == "2":
            payload = fc.problem_validation(name)
        elif seat == "3":
            payload = fc.draft(name)
        elif seat == "4":
            payload = fc.refinement(name, 2)
        elif seat == "5":
            payload = fc.internal_faq(name)
        elif seat == "6":
            payload = fc.concept_validation(name)
        elif seat == "7":
            payload = fc.refinement(name, 3)
        elif seat == "8":
            payload = fc.external_faq(name)
        elif seat == "9":
            payload = fc.synthesis(name, attempt=request.attempt)
        elif seat == "9b":
            payload = fc.bar_raiser(name)
        elif seat == "10":
            payload = fc.validation_plan(name)
        elif seat == "judge":
            payload = {
                "scores": [{"criterion": c, "score": 4, "note": "Fake judge: consistent with the Bar Raiser."} for c in ("customer_clarity", "problem_specificity", "anecdote_believability", "v1_feasibility", "differentiation", "evidence_coverage", "executive_readability")],
                "overall": 4,
                "claim_checks": [{"claim": "About 60 percent of small business owners do their own bookkeeping", "status": "cited", "note": "F-02"}, {"claim": "spending six to nine hours a week on it", "status": "assumption", "note": "flagged"}],
                "unsupported_claims": 0,
                "summary": "A specific, evidenced draft with one flagged assumption. Ready for a leadership read.",
            }
        else:
            raise ValueError(f"fake provider has no content for seat {seat}")

        await on_event(ProviderEvent(kind="thinking", text=f"Planning the structure of the answer for seat {seat}."))
        text = json.dumps(payload, ensure_ascii=False)
        await self._stream_text(text, on_event)
        n_in = 1500 + 900 * len(ctx.get("dossier_kinds", []))
        usage = Usage(input_tokens=600, cache_creation_input_tokens=800, cache_read_input_tokens=n_in, output_tokens=max(300, len(text) // 4))
        return SeatOutcome(text=text, parsed=payload, citations=citations, usage=usage, stop_reason="end_turn", model_served=request.model, fallback_used=False)
