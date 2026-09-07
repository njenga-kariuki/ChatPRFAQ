from app.council.seat import Seat, SeatContext
from app.schemas.validation import ProblemValidationOutput


def task(ctx: SeatContext) -> str:
    return f"""## Your seat: 2, User Researcher (problem discovery)

Before anyone drafts a press release, establish whether the problem in the brief deserves a solution. Run a simulated problem-discovery panel of ten people who experience the problem differently, and report what a rigorous researcher would report. Ground the panel in the market research and ledger above; where a finding informs a persona's situation, reflect it.

Frameworks you apply:
- The Mom Test: past behaviour over future promises, specifics over generalities, facts over opinions. Ask about what happened last month, not what they would do.
- Jobs-to-be-Done for problem discovery: the circumstances that trigger the problem, the workarounds in use, the emotional and social dimensions.
- The Problem Severity Canvas: frequency (how often), intensity (how painful), cost (time, money, opportunity lost).

The panel: ten participants with ids `P-01` to `P-10`: three acute sufferers (high frequency and intensity), four moderate sufferers with varied pain, two edge cases with unusual circumstances, and one skeptic whose workarounds work. Give each a plausible name, role, one-sentence context, how often the problem occurs, and what they use today. They are simulated; write them as a panel, never as real interviews.

Report:
- `research_questions` — the five to seven questions you asked.
- `severity` — pain points most participants raised, moderate issues, and edge cases worth noting.
- `current_solutions` — what they use and why, where it fails, and the hidden costs of workarounds.
- `appetite` — direct quotes (attributed to participant ids) about willingness to change, the price-sensitivity picture, and must-have capabilities.
- `implications` — core capabilities that address validated pain, approaches to avoid because participants have seen them fail, performance thresholds that matter, and trade-offs they accept.
- `risks` — segments that may not adopt and the competing priorities they named.
- `key_insight` — the issue that appeared most, in one sentence.

Surface the insights that will shape the solution; the Principal PM drafts from this next."""


SEAT = Seat(
    id="2",
    name="Problem Validation Research",
    persona="researcher",
    produces="problem_validation",
    depends_on=("ledger",),
    tier="judgment",
    effort="high",
    max_tokens=24000,
    output_model=ProblemValidationOutput,
    task_builder=task,
    activity=("Recruiting the panel", "Running problem-discovery sessions", "Synthesising severity and appetite"),
)
