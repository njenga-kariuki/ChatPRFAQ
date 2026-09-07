from app.council.seat import Seat, SeatContext
from app.schemas.prfaq import SynthesisOutput


def task(ctx: SeatContext) -> str:
    base = f"""## Your seat: 9, Senior Editor (PRFAQ synthesis)

Assemble the final PRFAQ for {ctx.working_name} from press release v3, the customer FAQ, the internal FAQ, and the two research panels above, and give it the editorial polish of a document prepared for S-Team review. You bring the solution to life through clarity, specificity and authentic detail, not manufactured excitement.

Editorial standards: customer-benefit language over feature descriptions; concrete examples over abstractions; active voice; vivid but credible; natural speech in anecdotes; hedging and filler removed; jargon replaced with customers' words; varied sentence rhythm. Write like you are explaining to an excited friend, not a board room.

Do not change: core claims, benefits or market data; the eight-slot structure; the FAQ questions; the research findings; the positioning; the substance of anecdotes. Where an FAQ answer repeats the press release verbatim, lightly rework it without losing detail.

Claim check: every quantitative or market claim in the press release must either cite a finding id in its slot's `claims` or be marked an assumption and phrased so a reader can tell. Flag rather than remove; the validation lead will test assumptions.

Return:
- `title` — "[Product name] PRFAQ" — and `product_name`.
- `executive_summary` — three or four sentences synthesising the opportunity and the solution, teeing up the press release and FAQs.
- `edits` — your editorial changes to the press release, one per slot changed, with a one-sentence rationale each.
- `press_release` — v4, all eight slots, 600–800 words, with updated `claims`.
- `customer_faq` — all five pairs from the customer FAQ, questions unchanged, answers polished where needed.
- `internal_faq` — all five sections and sixteen pairs from the internal FAQ, questions unchanged, answers refined where needed.
- `research_faq` — "How did customer research shape this product proposal?" answered from the two panels with counts and specifics.
- `summary_of_changes` — one sentence on the editorial pass.
- `key_insight` — the core value proposition, in at most twenty words."""
    if ctx.bar_raiser_review is not None:
        rv = ctx.bar_raiser_review
        fixes = "\n".join(f"- [{f.severity}] {f.target}: {f.instruction}" for f in rv.required_fixes) or "- (none)"
        base += f"""

## Bar Raiser revision (attempt {ctx.attempt})

The Bar Raiser scored the previous synthesis {rv.overall}/5 and asked for the fixes below. Apply each one precisely, keep everything else as it was, and record the press-release changes in `edits` with the Bar Raiser's reason as the rationale.

{fixes}"""
    return base


SEAT = Seat(
    id="9",
    name="Synthesizing PRFAQ Document",
    persona="editor",
    produces="prfaq",
    depends_on=("external_faq",),
    tier="judgment",
    effort="high",
    max_tokens=40000,
    output_model=SynthesisOutput,
    task_builder=task,
    activity=("Reading every document in the dossier", "Unifying the voice", "Checking claims against the ledger", "Writing the executive summary"),
)
