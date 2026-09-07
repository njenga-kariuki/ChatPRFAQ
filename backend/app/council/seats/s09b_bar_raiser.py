from app.council.seat import Seat, SeatContext
from app.schemas.review import CRITERION_LABELS, BarRaiserOutput


def task(ctx: SeatContext) -> str:
    criteria = "\n".join(f"- `{cid}` — {label}" for cid, label in CRITERION_LABELS.items())
    return f"""## Your seat: 9b, Bar Raiser

You did not write any of this. Read the synthesized PRFAQ for {ctx.working_name} as an S-Team reader would and score it one to five on each criterion, with one sentence of justification per score that names the passage you are judging:

{criteria}

Scoring guide: 5 means an S-Team reader would need nothing more; 3 means a competent draft with a gap a reviewer would send back; 1 means the section does not do its job. `overall` is your judgement of the whole, not an average.

Then list at most five `required_fixes`, each with a `target` (`press_release.<slot>`, `internal_faq.<question number>`, `customer_faq.<number>`, or `executive_summary`), a precise instruction the editor can apply without re-deciding anything, and a severity: `blocking` if the document should not go to leadership without it, `important` otherwise. Do not list nits.

`verdict` is `revise` if any fix is blocking or `overall` is three or lower; otherwise `pass`. `key_insight`: the one thing that most limits this document, in at most twenty words."""


SEAT = Seat(
    id="9b",
    name="Bar Raiser Review",
    persona="bar_raiser",
    produces="bar_raiser",
    depends_on=("prfaq",),
    tier="reviewer",
    effort="high",
    max_tokens=12000,
    output_model=BarRaiserOutput,
    task_builder=task,
    activity=("Reading the PRFAQ cold", "Scoring against the rubric", "Naming the fixes that matter"),
    optional=True,
)
