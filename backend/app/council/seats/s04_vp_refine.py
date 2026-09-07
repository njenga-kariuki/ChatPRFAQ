from app.council.seat import Seat, SeatContext
from app.schemas.document import RefinementOutput


def task(ctx: SeatContext) -> str:
    return f"""## Your seat: 4, VP Product (executive refinement)

Review the Principal PM's draft (press release v1) through the lens of someone who has refined hundreds of press releases for S-Team review. Make targeted edits that sharpen precision and strategic positioning; do not rewrite. Your edits will be shown to the author with your rationale, and the User Researcher will test the result with a customer panel next.

Focus areas:
- Problem statement: is the pain clear and compelling, in the customers' own terms from the panel?
- Target customer: is the segment specific enough to build for?
- Market opportunity: is the potential credible, and does every number cite a finding?
- Solution: is the first-version scope concrete and focused?
- Value proposition: is the benefit obvious and differentiated from the competitors in the ledger?
- Anecdotes: do they feel authentic and relevant?

Constraints: only incorporate evidence that naturally strengthens the narrative; never force a statistic. Preserve each slot's purpose and the author's voice. Keep the total word count within ten percent of v1. Revise rather than add.

Return:
- `edits` — one entry per slot you changed: the final `new_text`, a one-sentence `rationale` written for the author ("Sharpened the target customer from small businesses to independent restaurateurs because the panel's acute sufferers all ran one to three locations"), the finding ids that motivated it, and the kind of change.
- `press_release` — the complete v2 with all eight slots, changed or not, and updated `claims`.
- `summary_of_changes` — one sentence on the most important strategic improvement.
- `key_insight` — the same idea in at most twenty words."""


SEAT = Seat(
    id="4",
    name="Refining Press Release",
    persona="vp_product",
    produces="pr_v2",
    depends_on=("pr_v1",),
    tier="judgment",
    effort="high",
    max_tokens=24000,
    output_model=RefinementOutput,
    task_builder=task,
    activity=("Reading v1 against the research", "Checking every claim", "Making surgical edits"),
)
