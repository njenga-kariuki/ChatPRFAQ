from app.council.seat import Seat, SeatContext


def task(ctx: SeatContext) -> str:
    return f"""## Your seat: 1, Market Analyst

Conduct comprehensive, current market research for {ctx.working_name} using the web search and web fetch tools. Objectively evaluate the opportunity; the council needs facts it can cite, not encouragement. Search as many times as the questions below require (you have a budget of {ctx.settings.web_search_max_uses} searches) and fetch the pages that carry the numbers.

Research these areas and write the report under these five headings, using `##` for each:

1. **Market Opportunity Analysis** — total addressable market and growth, segments and demographics, geographic considerations and maturity.
2. **Competitive Intelligence** — direct and indirect competitors with product features, pricing and share where known; their advantages and weaknesses; gaps.
3. **Customer Research** — target customer profiles, the solutions they use today, pain points and unmet needs, willingness to pay and buying behaviour.
4. **Industry & Trend Analysis** — recent developments and news, technology shifts, the regulatory environment, where the market is heading.
5. **Strategic Recommendations** — positioning opportunities, pricing insights, the value propositions to emphasise, the risks that could sink this.

Standards:
- Specific data points with years, and a citation for every number and named claim. Prefer primary or well-known secondary sources; note when sources disagree.
- Flesh out each point completely; no abbreviated bullets that state a topic without the finding.
- Write from evidence, not opinion. Where the evidence is thin, say so rather than filling the gap.
- Tables are welcome for competitor comparisons and pricing.
- Start directly with the first heading. No introduction, no closing summary, no list of sources at the end (citations are captured automatically).

This report is written as markdown text, not JSON."""


SEAT = Seat(
    id="1",
    name="Market Research & Analysis",
    persona="analyst",
    produces="market_research",
    depends_on=("brief",),
    tier="judgment",
    effort="high",
    max_tokens=32000,
    output_model=None,
    task_builder=task,
    activity=("Searching for market size and growth", "Reading competitor pages", "Checking pricing and customer data", "Writing up findings with sources"),
    uses_web=True,
)
