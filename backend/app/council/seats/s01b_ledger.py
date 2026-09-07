from app.council.seat import Seat, SeatContext
from app.schemas.research import LedgerOutput, ResearchArtifact


def task(ctx: SeatContext) -> str:
    research: ResearchArtifact | None = ctx.get("market_research")
    sources = ctx.artifacts.get("_sources") or []
    if sources:
        table = "\n".join(f"| {s.id} | {s.title or s.url} | {s.url} |" for s in sources)
        source_block = f"""The sources below were attached to the research by the search tools. Refer to them by id.

| id | title | url |
|---|---|---|
{table}"""
    else:
        source_block = "No tool citations were attached to the research; use an empty `source_ids` list and lower the confidence where the report gives no source."
    return f"""## Your seat: 1b, Market Analyst (evidence ledger)

Turn the market research above into the evidence ledger every later seat will cite. Extract between twelve and twenty-five findings that a product team would actually use: market size and growth, named competitors and their pricing, customer pain points and behaviours, willingness to pay, trends, regulation, barriers and success factors.

For each finding:
- `id` — sequential, `F-01`, `F-02`, ...
- `claim` — one sentence, specific, self-contained (a reader must understand it without the report).
- `metric` — the number with unit and year when the claim is quantitative, otherwise null.
- `topic` — one of market_size, competition, customer, pricing, trend, regulation, barrier, success_factor, other.
- `source_ids` — the ids of the sources that support it. Only ids from the table below.
- `confidence` — high when a primary or authoritative source states it directly; medium when inferred or secondary; low when the report asserts it without support.

{source_block}

`key_insight`: the single most decision-relevant finding for {ctx.working_name}, in one sentence.

Research word count for reference: {len(research.markdown.split()) if research else 0}."""


SEAT = Seat(
    id="1b",
    name="Evidence Ledger",
    persona="analyst",
    produces="ledger",
    depends_on=("market_research",),
    tier="fast",
    effort="low",
    max_tokens=16000,
    output_model=LedgerOutput,
    task_builder=task,
    activity=("Extracting findings from the research", "Linking findings to sources"),
)
