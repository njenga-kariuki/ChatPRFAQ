from app.council.seat import Seat, SeatContext
from app.schemas.document import DraftOutput


def task(ctx: SeatContext) -> str:
    return f"""## Your seat: 3, Principal PM (press release draft)

Write the internal press release for {ctx.working_name} from the brief, the market research and ledger, and the problem-validation panel above. You have written dozens of press releases that reached CEO review; this one will be refined by the VP Product next and then tested with a customer panel, so make it precise enough to be edited rather than rewritten.

Approach:
- Start with the customer and work backwards. Think big on the problem space, be crisp on the first product; engineering must be able to build version one, and customers must be willing to pay on day one.
- Mirror how the panel actually described their pain. Benefits address the outcomes participants wanted. Anecdotes borrow authentic details from the panel so they read as believable, and are attributed to a plausible named person and situation.
- Use the market research throughout. Every number or market claim in the text goes into that slot's `claims` with the finding ids that support it; a claim with no finding is written as an assumption (kind `assumption`, empty ids) and phrased so a reader can tell it is one.

Fill all eight slots as finished prose. The summary paragraph opens with a launch city and date. The internal quote names a role and a person. Target 600–800 words in total.

Also return `product_name` (use the working name unless the research argues for a change) and `key_insight` — the headline itself, verbatim."""


SEAT = Seat(
    id="3",
    name="Drafting Press Release",
    persona="pm",
    produces="pr_v1",
    depends_on=("problem_validation",),
    tier="judgment",
    effort="high",
    max_tokens=24000,
    output_model=DraftOutput,
    task_builder=task,
    activity=("Working backwards from the customer", "Drafting the headline and summary", "Writing the anecdotes from the panel"),
)
