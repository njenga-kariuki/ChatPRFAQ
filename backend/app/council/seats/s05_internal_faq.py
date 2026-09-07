from app.council.seat import Seat, SeatContext
from app.schemas.faq import InternalFAQOutput

SECTIONS: list[tuple[str, list[str]]] = [
    (
        "Product Overview",
        [
            "What is the core customer problem we are trying to solve?",
            "Who is the target customer segment and why is this problem space important to them?",
            "What is the product and how does it uniquely solve this problem?",
        ],
    ),
    (
        "Market Opportunity",
        [
            "What is the competitive landscape and why haven't existing solutions met the customer need?",
            "Why does this problem need to be solved now?",
            "What is the TAM, and what are the key assumptions driving the calculation?",
        ],
    ),
    (
        "Minimum Lovable Product",
        [
            "What are the MLP use cases?",
            "What are the MLP customer experience requirements?",
            "What are the guardrails for what this product is not: customers it does not serve, functionality outside MLP scope?",
        ],
    ),
    (
        "Business Strategy",
        [
            "What is our approach to building this in a customer-obsessed, differentiated and profitable way?",
            "What are the business model options and what is the recommended path?",
            "What is the phased product roadmap beyond MLP?",
        ],
    ),
    (
        "Validation & Risk Assessment",
        [
            "What are the critical assumptions that must be validated for this product and business to succeed?",
            "What is the fastest and most frugal path to validate these assumptions with high confidence?",
            "What are the top reasons this product won't succeed?",
            "What are the key regulatory, compliance or legal considerations?",
        ],
    ),
]


def questions_block() -> str:
    out = []
    for title, qs in SECTIONS:
        out.append(f"**{title}**")
        out += [f"- {q}" for q in qs]
        out.append("")
    return "\n".join(out).rstrip()


def task(ctx: SeatContext) -> str:
    return f"""## Your seat: 5, VP Business Lead and Principal Engineer (internal FAQ)

Answer the sixteen internal questions below about {ctx.working_name} with the precision and depth of an S-Team review, using press release v2, the market research and ledger, and the problem-validation panel above. You embody two leaders: the VP Business Lead (strategic fit, market opportunity, unit economics, pricing, TAM, go-to-market, legal awareness) leads on business model and TAM questions; the Principal Engineer (feasibility, architecture, operational complexity, MLP definition, customer-experience requirements, failure modes) leads on MLP and technical questions; risk and validation questions combine both.

Standards: crisp, data-driven answers with specific examples and brief reasoning; every claim backed by a finding id, the panel, or explicit reasoning; honest about uncertainties and trade-offs; no corporate speak. For the business model question, present three options, pick one, and give the rationale covering revenue model, pricing, customer acquisition cost and unit economics. For the TAM, show the assumptions. Answers are substantive but concise, roughly 80–180 words each.

Return exactly five sections with these titles and questions, in this order, each answer carrying the `evidence_finding_ids` it relies on:

{questions_block()}

`key_insight`: the risk raised most often across your answers, in one sentence."""


SEAT = Seat(
    id="5",
    name="Drafting Internal FAQ",
    persona="biz_eng",
    produces="internal_faq",
    depends_on=("pr_v2",),
    tier="judgment",
    effort="high",
    max_tokens=32000,
    output_model=InternalFAQOutput,
    task_builder=task,
    activity=("Sizing the market from the ledger", "Assessing feasibility and MLP scope", "Weighing business model options", "Listing risks and legal considerations"),
)
