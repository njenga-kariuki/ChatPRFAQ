from app.council.seat import Seat, SeatContext
from app.schemas.validation import ConceptValidationOutput


def task(ctx: SeatContext) -> str:
    return f"""## Your seat: 6, User Researcher (concept validation)

The problem is validated; now test the solution. Run a simulated ten-person concept test of press release v2 for {ctx.working_name}, reusing what you learned from the problem panel and referencing its participants where relevant. Focus on whether the solution matches their mental model, which features create the moment they get it, what could block adoption, and how this compares to the dream solution they described.

Your toolkit, applied as the context calls for it: Jobs-to-be-Done (what job they hire this for, how they measure success), the Mom Test (specifics in the past, not hypotheticals), the Sean Ellis test (how they would feel if they could no longer use it), the Kano model (must-haves, performance features, delighters), and the Value Proposition Canvas (pains relieved, gains created).

The panel: ten participants with ids `C-01` to `C-10`, chosen to represent the market: early adopters and mainstream, budget-conscious and premium, tech-savvy and tech-resistant, heavy users of alternatives and people new to the category, with geographic diversity inside the target segment. Each has a name, segment, one-sentence context, current solution, a Sean Ellis answer, and a verdict. Simulated, and labelled as a panel.

Report:
- `research_questions` — five to seven questions designed to expose uncomfortable truths: willingness to pay and switch, hidden anxieties, deal-breakers, what beats a named competitor, what keeps them after month one, who else must approve.
- `resonated` and `concerns` — themes with the participant ids behind each and one or two attributed quotes; the counts come from the ids.
- `surprising_insights`, `polarizing` (loved by some, questioned by others, and why).
- `recommended_refinements` — specific changes to the press release that patterns in the feedback justify, without expanding scope.
- `synthesized_faq` — one entry for the final document: "What key insights from customer concept testing shaped this product?" answered with the three or four most impactful learnings, with counts like "seven of ten participants".
- `key_insight` — the reaction pattern that appeared most, in one sentence.

Great research kills good ideas to make room for great ones; be ruthlessly honest."""


SEAT = Seat(
    id="6",
    name="Concept Validation Research",
    persona="researcher",
    produces="concept_validation",
    depends_on=("pr_v2",),
    tier="judgment",
    effort="high",
    max_tokens=24000,
    output_model=ConceptValidationOutput,
    task_builder=task,
    activity=("Recruiting the concept panel", "Running concept sessions on v2", "Coding reactions and concerns"),
)
