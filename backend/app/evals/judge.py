"""An LLM judge that scores a finished run on the Bar Raiser rubric plus a hallucination check.

The judge is a different model from the author (Sonnet 5 by default) and reads the
final PRFAQ together with the evidence ledger, so it can check whether every
quantitative claim in the press release is either cited or flagged as an assumption.
"""

from __future__ import annotations

from typing import Literal

from app.council.charter import charter_text
from app.council.render import render_ledger
from app.llm.provider import Provider
from app.llm.types import ProviderEvent, SeatRequest
from app.schemas import CRITERION_LABELS, Ledger, SynthesisOutput, output_schema
from app.schemas.base import StrictModel
from app.schemas.review import Criterion
from app.settings import Settings


class JudgeScore(StrictModel):
    criterion: Criterion
    score: int
    note: str


class ClaimCheck(StrictModel):
    claim: str
    status: Literal["cited", "assumption", "unsupported"]
    note: str


class JudgeOutput(StrictModel):
    scores: list[JudgeScore]
    overall: int
    claim_checks: list[ClaimCheck]
    unsupported_claims: int
    summary: str


def judge_task(prfaq: SynthesisOutput, ledger: Ledger) -> str:
    criteria = "\n".join(f"- `{cid}` — {label}" for cid, label in CRITERION_LABELS.items())
    return f"""## Your seat: eval judge

You are grading a finished PRFAQ produced by the council. Score it one to five on each criterion with one sentence of justification naming the passage:

{criteria}

Then audit every quantitative or market claim in the press release below against the evidence ledger: `cited` when the claim's slot lists a finding id that supports it, `assumption` when the claim is marked or phrased as an assumption, `unsupported` when it is stated as fact with no finding. Count the unsupported claims.

`overall` is your judgement of the document as a whole (not an average). `summary` is two sentences a product leader would read.

{render_ledger(ledger)}

## The press release under review (with its claims)

{chr(10).join(f"[{s.id}] {s.text}" + chr(10) + chr(10).join(f"  claim: {c.text} ({c.kind}; {', '.join(c.finding_ids) or 'no finding'})" for c in s.claims) for s in prfaq.press_release.slots)}

## The rest of the PRFAQ

{prfaq.markdown()}"""


async def judge_run(provider: Provider, settings: Settings, prfaq: SynthesisOutput, ledger: Ledger) -> JudgeOutput:
    system = [{"type": "text", "text": charter_text(), "cache_control": {"type": "ephemeral", "ttl": "1h"}}]
    messages = [{"role": "user", "content": [{"type": "text", "text": judge_task(prfaq, ledger)}]}]
    request = SeatRequest(
        seat_id="judge",
        model=settings.council_model_fast,
        effort="medium",
        max_tokens=12000,
        system=system,
        messages=messages,
        output_schema=output_schema(JudgeOutput),
        uses_web=False,
        thinking_display=settings.thinking_display,
    )

    async def ignore(_: ProviderEvent) -> None:
        return None

    outcome = await provider.run(request, ignore)
    return JudgeOutput.model_validate(outcome.parsed)
