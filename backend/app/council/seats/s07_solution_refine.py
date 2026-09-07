from app.council.seat import Seat, SeatContext
from app.schemas.document import RefinementOutput


def task(ctx: SeatContext) -> str:
    return f"""## Your seat: 7, Principal PM (customer-validated refinement)

Take press release v2 and the concept-validation panel above and make the surgical edits that improve product-market fit. Work primarily from the panel's major concerns, keep what resonated, and settle polarizing aspects with clearer explanation. Use the internal FAQ's MLP guardrails and feasibility answers to avoid promising what version one cannot deliver.

Method: for each major concern, decide whether a clarification or a refinement of existing functionality addresses it (wholesale additions do not qualify); locate the exact sentence it relates to; craft the smallest edit that removes the confusion; and combine concerns that touch the same claim into one refinement.

Constraints: address only concerns the panel raised; preserve each slot's purpose; no new features, only refinements or clarifications of existing claims; keep the total word count within ten percent of v2; refine anecdotes in place if needed; match the existing voice.

Return `edits` (final `new_text`, one-sentence `rationale` naming the concern and the participants behind it, the finding ids if the ledger is involved, the kind of change), the complete `press_release` v3 with updated `claims`, `summary_of_changes` (what was added or modified to address the panel, in one sentence) and `key_insight` (the most important change, at most twenty words)."""


SEAT = Seat(
    id="7",
    name="Solution Refinement",
    persona="pm",
    produces="pr_v3",
    depends_on=("internal_faq", "concept_validation"),
    tier="judgment",
    effort="high",
    max_tokens=24000,
    output_model=RefinementOutput,
    task_builder=task,
    activity=("Reading the panel's concerns", "Checking MLP guardrails with engineering", "Refining the solution paragraphs"),
)
