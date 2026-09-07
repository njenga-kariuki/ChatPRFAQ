from app.council.seat import Seat, SeatContext
from app.schemas.faq import ExternalFAQOutput


def task(ctx: SeatContext) -> str:
    return f"""## Your seat: 8, Customer Success Lead (customer FAQ)

Write the five questions prospective customers of {ctx.working_name} will actually ask, based on the concerns, polarizing aspects and surprising insights in the concept-validation panel, and answer them against press release v3.

Each `question` is worded the way a customer would ask a support representative before buying or while using the product: clear, concise, in their language. Each `answer` is what a great customer success representative would say: direct, specific, confident where the product delivers, honest about limitations and what version one does not do. Use language from the panel; cite finding ids in `evidence_finding_ids` when an answer leans on the ledger.

Answers run 60–140 words. Order the questions by how often the underlying concern appeared in the panel.

`key_insight`: the first question, verbatim."""


SEAT = Seat(
    id="8",
    name="Drafting External FAQ",
    persona="customer_success",
    produces="external_faq",
    depends_on=("pr_v3",),
    tier="fast",
    effort="medium",
    max_tokens=12000,
    output_model=ExternalFAQOutput,
    task_builder=task,
    activity=("Turning concerns into customer questions", "Answering against v3"),
)
