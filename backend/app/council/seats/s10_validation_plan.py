from app.council.seat import Seat, SeatContext
from app.schemas.plan import ValidationPlanOutput


def task(ctx: SeatContext) -> str:
    return f"""## Your seat: 10, Head of Validation (hypothesis-driven validation plan)

Decompose the {ctx.working_name} concept into testable hypotheses and design the cheapest sequence of tests that could kill it. Work from the whole dossier: the assumptions flagged in the press release, the critical assumptions and top failure reasons in the internal FAQ, the concerns in both panels, and the ledger's low-confidence findings.

Principles: test the riskiest assumptions first; design the minimum test that yields valid learning; sequence so each test informs the next; give every test a specific success threshold; assume a small team with a constrained budget using modern tools (landing pages with conversion tracking, Wizard-of-Oz prototypes built with AI tools, concierge MVPs, message tests, Mom Test interviews, card sorting, willingness-to-pay smoke tests).

Prioritisation: ICE adapted for validation. For each hypothesis give `impact` (1–10, how critical to success), `confidence` (1–10 where 10 means very uncertain), and `ease` (1–10, how cheap to test); the priority score `impact × (11 − confidence) ÷ (11 − ease)` is computed for you.

Return:
- `hypotheses` — seven to ten, ids `H1`…, each a clear testable statement with why it is critical, what depends on it, and its phase (`foundation`, `solution_fit`, `scale`).
- `sequence` — the three phases with the hypothesis ids in each, why they come in that order, and the decision point at the end of each phase.
- `test_plans` — for the top five hypotheses: method, the minimum artifact to build, success criteria with numbers, sample size with the statistical reasoning, what could invalidate the result, and suggested tools.
- `synthesis` — what combination of results is a strong signal to proceed, what mixed pattern means iterate, and what invalidates the concept.
- `not_testing` — three to five aspects deliberately excluded for now, and why.
- `best_practices` — the biggest validation pitfall for this specific concept, the recommended first test, where to recruit the right testers, and how real the prototype needs to feel.
- `executive_summary` — written last: three to five sentences bridging from the PRFAQ's vision to the need to test, naming the one or two hypotheses that could kill the concept.
- `key_insight` — the hypothesis most critical to validate, in one sentence."""


SEAT = Seat(
    id="10",
    name="Hypothesis-Driven Validation Plan",
    persona="validation_lead",
    produces="plan",
    depends_on=("prfaq",),
    tier="judgment",
    effort="high",
    max_tokens=24000,
    output_model=ValidationPlanOutput,
    task_builder=task,
    activity=("Listing the assumptions the document rests on", "Scoring hypotheses", "Designing frugal tests"),
)
