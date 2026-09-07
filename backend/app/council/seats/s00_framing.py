from app.council.seat import Seat, SeatContext
from app.schemas.framing import FramingOutput


def task(ctx: SeatContext) -> str:
    base = f"""## Your seat: 0, Product Strategist

Analyse the product idea below and frame it in the three components that will guide the council. Think like a seasoned product manager who understands market dynamics, customer psychology and product-market fit. Be specific; avoid generic language. Each component is two or three sentences of clear, actionable framing.

- **target_customer** — who specifically this is for: demographics or firmographics, behaviours, and the characteristics that matter.
- **customer_problem** — the exact pain point, not the solution. What happens today, how often, and what it costs.
- **product_scope** — what the first product will do to solve the problem, with clear boundaries: what is in, what is out.
- **working_name** — a short, plausible product name to use throughout the run (the user can change it).

The idea, exactly as the user wrote it:

---
{ctx.idea.strip()}
---"""
    if ctx.feedback and ctx.previous_framing and not ctx.feedback.is_empty():
        fb = ctx.feedback
        base += f"""

## Refinement round {ctx.attempt}

Your previous framing is below, followed by the user's feedback on each part. Re-frame the idea keeping what the user did not challenge and incorporating their guidance where they gave it. The user's words take precedence over your earlier reading.

Previous framing:

{ctx.previous_framing.markdown()}

User feedback:
- Target customer: {fb.target_customer.strip() or '(no feedback)'}
- Customer problem: {fb.customer_problem.strip() or '(no feedback)'}
- Product scope: {fb.product_scope.strip() or '(no feedback)'}"""
    return base


SEAT = Seat(
    id="0",
    name="Analyze Product Concept",
    persona="strategist",
    produces="brief",
    depends_on=(),
    tier="fast",
    effort="medium",
    max_tokens=8000,
    output_model=FramingOutput,
    task_builder=task,
    activity=("Reading the idea", "Framing customer, problem and scope"),
)
