"""Deterministic, schema-valid content for the fake provider.

Used for tests, the frontend fixture, and demos without an API key. The content is
about whatever idea the user typed, but its numbers are invented and labelled as
such by the ledger's low confidence and the assumptions in the press release.
"""

from __future__ import annotations

import re

from app.schemas.document import SLOT_ORDER

_SLOT_IDS = list(SLOT_ORDER)


def working_name_from(idea: str) -> str:
    words = [w for w in re.findall(r"[A-Za-z][A-Za-z'-]+", idea) if w.lower() not in {"a", "an", "the", "that", "for", "to", "of", "and", "with", "app", "platform"}]
    if not words:
        return "Northstar"
    return "".join(w.capitalize() for w in words[:2])


def framing(idea: str, attempt: int = 1, feedback: dict | None = None) -> dict:
    name = working_name_from(idea)
    fb = feedback or {}
    customer = fb.get("target_customer") or (
        "Operators of small independent businesses with one to three locations who run their own back office in the evenings, "
        "are comfortable with a phone and a spreadsheet, and have no dedicated finance staff."
    )
    problem = fb.get("customer_problem") or (
        "Reconciling receipts, invoices and payment records takes six to nine hours a week, usually after close, and errors surface "
        "months later as missed discounts, late fees and a year-end scramble for the accountant."
    )
    scope = fb.get("product_scope") or (
        f"{name} ingests receipts, POS exports and supplier invoices, matches them to bank transactions, and produces a reviewed "
        "monthly close with exceptions flagged for a ten-minute owner review. Version one does not do payroll, tax filing or forecasting."
    )
    return {
        "framing": {
            "working_name": name,
            "target_customer": customer,
            "customer_problem": problem,
            "product_scope": scope,
        },
        "key_insight": f"{name} sells time back to owners who do the books after close; attempt {attempt}.",
    }


def research_markdown(name: str) -> str:
    return f"""## Market Opportunity Analysis

Small businesses in the United States spend an estimated $37 billion a year on bookkeeping labour, and the share handled by owners themselves rather than staff or a firm is close to 60 percent. The segment relevant to {name}, owner-operated businesses with one to three locations, grew 4 percent in 2025 as service and hospitality reopened at scale. Cloud bookkeeping penetration among these businesses sits near 45 percent, leaving a majority still on spreadsheets, shoeboxes, or a monthly hand-off to an accountant.

## Competitive Intelligence

| Competitor | Offer | Price | Weakness |
|---|---|---|---|
| Full-service bookkeeping firms | Human bookkeeper, monthly close | $300–$800 per month | Slow turnaround, owner still gathers documents |
| Cloud accounting suites | Ledger, invoicing, bank feeds | $30–$90 per month | Owner still does the categorisation and reconciliation |
| Receipt-capture apps | Photo capture and OCR | $10–$25 per month | Stops at capture; no close, no exceptions |

No competitor combines automated matching with a reviewed close at a price under $150 per month for a single-location operator.

## Customer Research

Owners describe the work as "the books" and do it in one or two late sessions a week. The most common trigger for change is a missed supplier discount or a surprise from the accountant at tax time. Willingness to pay clusters between $80 and $150 per month when the close is reviewed by a person; below $50 per month when it is software only.

## Industry & Trend Analysis

Bank data access through open-banking APIs is now standard for US small-business accounts. Optical character recognition on receipts has reached over 95 percent field accuracy on clean images. Regulators require records to be retained for seven years for tax purposes, and several states have moved to require digital receipts for sales-tax audits.

## Strategic Recommendations

Position {name} as "the books, done by Monday", price between $99 and $129 per month for one location, and lead with the exception review rather than the automation. The main risks are trust in an automated close and the cost of the human review step at scale.
"""


def research_citations() -> list[dict]:
    return [
        {"url": "https://example.com/smb-bookkeeping-survey-2025", "title": "Small Business Bookkeeping Survey 2025", "cited_text": "Roughly six in ten owners handle bookkeeping themselves."},
        {"url": "https://example.com/smb-bookkeeping-survey-2025", "title": "Small Business Bookkeeping Survey 2025", "cited_text": "Willingness to pay clusters between $80 and $150 per month for a reviewed close."},
        {"url": "https://example.com/cloud-accounting-market-report", "title": "Cloud Accounting Market Report", "cited_text": "Cloud bookkeeping penetration among owner-operated businesses is close to 45 percent."},
        {"url": "https://example.com/open-banking-smb-2025", "title": "Open Banking for Small Business, 2025", "cited_text": "Bank data access via API is standard for US small-business accounts."},
        {"url": "https://example.com/receipt-ocr-benchmark", "title": "Receipt OCR Benchmark", "cited_text": "Field accuracy exceeds 95 percent on clean images."},
    ]


def ledger(name: str, source_ids: list[str]) -> dict:
    s = source_ids or []
    first = s[:1]
    second = s[1:2]
    third = s[2:3]
    fourth = s[3:4]
    return {
        "findings": [
            {"id": "F-01", "claim": "Small businesses in the US spend about $37 billion a year on bookkeeping labour.", "metric": "$37B/yr (2025)", "topic": "market_size", "source_ids": first, "confidence": "medium"},
            {"id": "F-02", "claim": "About 60 percent of owners of small businesses do the bookkeeping themselves.", "metric": "~60% (2025)", "topic": "customer", "source_ids": first, "confidence": "high"},
            {"id": "F-03", "claim": "Owner-operated businesses with one to three locations grew 4 percent in 2025.", "metric": "+4% (2025)", "topic": "market_size", "source_ids": second, "confidence": "low"},
            {"id": "F-04", "claim": "Cloud bookkeeping penetration among owner-operated businesses is close to 45 percent.", "metric": "~45%", "topic": "trend", "source_ids": second, "confidence": "medium"},
            {"id": "F-05", "claim": "Full-service bookkeeping firms charge $300 to $800 per month and still require the owner to gather documents.", "metric": "$300–$800/mo", "topic": "competition", "source_ids": [], "confidence": "medium"},
            {"id": "F-06", "claim": "Cloud accounting suites cost $30 to $90 per month but leave categorisation and reconciliation to the owner.", "metric": "$30–$90/mo", "topic": "competition", "source_ids": [], "confidence": "medium"},
            {"id": "F-07", "claim": "Owners' willingness to pay clusters between $80 and $150 per month when a person reviews the close.", "metric": "$80–$150/mo", "topic": "pricing", "source_ids": first, "confidence": "medium"},
            {"id": "F-08", "claim": "Open-banking API access to small-business bank data is now standard in the US.", "metric": None, "topic": "trend", "source_ids": third, "confidence": "high"},
            {"id": "F-09", "claim": "Receipt OCR reaches over 95 percent field accuracy on clean images.", "metric": ">95% field accuracy", "topic": "trend", "source_ids": fourth, "confidence": "high"},
            {"id": "F-10", "claim": "Tax rules require business records to be retained for seven years.", "metric": "7 years", "topic": "regulation", "source_ids": [], "confidence": "high"},
            {"id": "F-11", "claim": "A missed supplier discount or a tax-time surprise is the most common trigger for changing bookkeeping habits.", "metric": None, "topic": "customer", "source_ids": first, "confidence": "medium"},
            {"id": "F-12", "claim": "No competitor combines automated matching with a reviewed close under $150 per month for one location.", "metric": "<$150/mo", "topic": "competition", "source_ids": [], "confidence": "low"},
        ],
        "key_insight": f"The gap for {name} is a reviewed monthly close under $150 that no competitor offers.",
    }


def problem_validation(name: str) -> dict:
    participants = [
        ("P-01", "Maria Delgado", "Owner, two taquerias", "acute", "Does the books after close on Sundays", "Weekly, three to four hours", "Spreadsheet plus a shoebox"),
        ("P-02", "Devon Okafor", "Owner, independent bike shop", "acute", "Missed an early-payment discount twice last quarter", "Weekly", "Cloud accounting suite, half set up"),
        ("P-03", "Priya Natarajan", "Owner, boutique fitness studio", "acute", "Accountant sends a list of questions every quarter", "Weekly", "Receipt app plus accountant"),
        ("P-04", "Tom Brennan", "Owner, hardware store", "moderate", "Has a part-time bookkeeper eight hours a month", "Monthly", "Part-time bookkeeper"),
        ("P-05", "Lena Fischer", "Owner, bakery with a wholesale line", "moderate", "Wholesale invoices are the pain, retail is fine", "Weekly", "Cloud suite plus spreadsheets"),
        ("P-06", "Marcus Hill", "Owner, barbershop with three chairs", "moderate", "Cash-heavy; reconciles from memory", "Monthly", "Notebook and bank app"),
        ("P-07", "Aisha Rahman", "Owner, pharmacy", "moderate", "Regulated inventory makes records strict", "Weekly", "Full-service firm at $650 a month"),
        ("P-08", "Jonas Lindqvist", "Owner, food truck and catering", "edge", "Seasonal; six months of chaos, six months of nothing", "Seasonal", "Whatever works that week"),
        ("P-09", "Grace Kim", "Owner, dental practice", "edge", "Insurance remittances dominate; receipts are minor", "Monthly", "Practice management software"),
        ("P-10", "Ray Castellano", "Owner, auto repair shop", "skeptic", "Spouse does the books every Friday and it works", "Weekly", "Spouse plus a cloud suite"),
    ]
    return {
        "research_questions": [
            "Walk me through the last time you did the books. What did you do first?",
            "When did you last discover a bookkeeping mistake, and what did it cost you?",
            "What have you tried to make this faster, and why did you stop?",
            "Who else touches your financial records, and when?",
            "What would have to be true for you to hand this to software?",
            "What did your accountant ask you for last year that you could not find?",
        ],
        "participants": [
            {"id": i, "name": n, "role": r, "archetype": a, "context": c, "problem_frequency": f, "current_solution": s}
            for i, n, r, a, c, f, s in participants
        ],
        "severity": {
            "high_priority": [
                "Six to nine hours a week spent after close on matching receipts to transactions (seven of ten)",
                "Errors surface months later as missed discounts, late fees or accountant questions (six of ten)",
            ],
            "moderate": ["Supplier invoices arriving by email, paper and text in the same week", "Cash sales that never make it into the ledger"],
            "edge_cases": ["Seasonal businesses with months of no activity", "Practices where insurance remittances, not receipts, dominate"],
        },
        "current_solutions": {
            "what_they_use": ["Cloud accounting suites, partially configured", "Receipt-capture apps that stop at capture", "A part-time bookkeeper or a spouse"],
            "where_it_fails": ["The owner still has to categorise and reconcile", "Nothing flags the missing invoice until the accountant asks", "Firms are slow and still need the owner to gather documents"],
            "workaround_costs": ["A weekly evening lost", "Missed early-payment discounts worth $200 to $600 a quarter", "A year-end scramble that costs a weekend"],
        },
        "appetite": {
            "quotes": [
                {"participant_id": "P-01", "text": "If someone closed my books by Monday morning I would pay for that before I paid for new tables."},
                {"participant_id": "P-02", "text": "I do not want to learn accounting. I want to know what is wrong and fix it in ten minutes."},
                {"participant_id": "P-10", "text": "My wife does it Friday afternoons. Unless it is free and perfect I am not switching."},
            ],
            "price_sensitivity": "Acute and moderate sufferers named $80 to $150 a month without prompting when a reviewed close was described; skeptics anchored on the cost of doing nothing.",
            "must_haves": ["Bank and POS connections that work on day one", "A short exception list, not a dashboard", "A person who has checked the close"],
        },
        "implications": {
            "core_capabilities": ["Automatic matching of receipts, invoices and bank transactions", "A monthly close reviewed by a person", "An exception queue the owner clears in minutes"],
            "approaches_to_avoid": ["Another dashboard the owner must interpret", "Capture-only tools with no close", "Pricing that scales with transaction volume in confusing ways"],
            "performance_thresholds": ["Close delivered within three business days of month end", "Fewer than ten exceptions a month for a single location", "Matching accuracy the owner stops double-checking after two months"],
            "acceptable_tradeoffs": ["No payroll or tax filing in version one", "A monthly rather than daily close", "Manual upload for suppliers who send paper"],
        },
        "risks": {
            "segments_unlikely_to_adopt": ["Owners whose spouse or family member already does the books", "Regulated businesses that need audit-grade inventory records"],
            "competing_priorities": ["Hiring", "Rent renegotiation", "Menu or inventory changes"],
        },
        "key_insight": "Owners lose an evening a week matching receipts and only notice errors when the accountant asks.",
    }


def _slots(name: str, version: int) -> list[dict]:
    v = version
    headline = {
        1: f"{name} Closes the Books for Small Business Owners Every Month",
        2: f"{name} Closes the Books for Independent Operators by the Third Business Day",
        3: f"{name} Closes the Books for Independent Operators by the Third Business Day",
        4: f"{name} Closes the Books for Independent Operators by the Third Business Day",
    }[v]
    subheading = {
        1: f"{name} turns receipts, invoices and bank data into a finished monthly close, without a bookkeeper on staff.",
        2: f"{name} turns receipts, invoices and bank data into a reviewed monthly close, without a bookkeeper on staff.",
        3: f"{name} turns receipts, invoices and bank data into a reviewed monthly close that owners approve in minutes, without a bookkeeper on staff.",
        4: f"{name} turns receipts, invoices and bank data into a reviewed monthly close that owners approve in minutes, without a bookkeeper on staff.",
    }[v]
    summary = {
        1: f"AUSTIN, Texas — March 15, 2027 — {name} today announced a bookkeeping service for small business owners who do their own books. Owners connect their bank and point-of-sale accounts, forward receipts and invoices, and receive a completed monthly close with the handful of items that need their attention. About 60 percent of small business owners do their own bookkeeping, and most spend hours every week on it.",
        2: f"AUSTIN, Texas — March 15, 2027 — {name} today announced a bookkeeping service for owners of independent businesses with one to three locations who do their own books. Owners connect their bank and point-of-sale accounts, forward receipts and invoices, and receive a reviewed monthly close by the third business day with the handful of items that need their attention. About 60 percent of small business owners do their own bookkeeping, spending six to nine hours a week on it.",
        3: f"AUSTIN, Texas — March 15, 2027 — {name} today announced a bookkeeping service for owners of independent businesses with one to three locations who do their own books. Owners connect their bank and point-of-sale accounts, forward receipts and invoices, and by the third business day receive a monthly close that a {name} reviewer has checked, with the handful of items that need the owner's attention. About 60 percent of small business owners do their own bookkeeping, spending six to nine hours a week on it.",
        4: f"AUSTIN, Texas — March 15, 2027 — {name} today announced a bookkeeping service for owners of independent businesses with one to three locations who do their own books. Owners connect their bank and point-of-sale accounts, forward receipts and invoices, and by the third business day receive a monthly close a {name} reviewer has checked, with the few items that need the owner's attention. About 60 percent of small business owners do their own bookkeeping and spend six to nine hours a week on it.",
    }[v]
    problem = {
        1: "Small business owners spend hours every week reconciling receipts against bank statements, and most still hand their accountant a shoebox at year end. Mistakes are found late, when a supplier discount has expired or the accountant sends a list of questions.",
        2: "Owners of independent businesses running one to three locations spend six to nine hours a week, usually after close, reconciling receipts against bank statements, and most still hand their accountant a shoebox at year end. Seven of the ten operators in our panel had missed a supplier discount because an invoice surfaced after the payment window.",
        3: "Owners of independent businesses running one to three locations spend six to nine hours a week, usually after close, reconciling receipts against bank statements, and most still hand their accountant a shoebox at year end. Seven of the ten operators in our panel had missed a supplier discount because an invoice surfaced after the payment window, and none of them wanted another dashboard to interpret.",
        4: "Owners of independent businesses with one to three locations spend six to nine hours a week, usually after close, reconciling receipts against bank statements, and most still hand their accountant a shoebox at year end. Seven of the ten operators in our panel had missed a supplier discount because an invoice surfaced after the payment window, and none wanted another dashboard to interpret.",
    }[v]
    solution = {
        1: f"{name} connects to the owner's bank and point-of-sale system, accepts receipts and invoices by photo, email or upload, and matches every document to a transaction automatically. At month end the owner receives a close and a short list of exceptions. Maria Delgado, who runs two taquerias, used to spend Sunday nights with a spreadsheet; in her first month with {name} she reviewed eleven exceptions in fourteen minutes and approved the close from her phone.",
        2: f"{name} connects to the owner's bank and point-of-sale system, accepts receipts and invoices by photo, email or upload, and matches every document to a transaction automatically. By the third business day of the month the owner receives a close a {name} reviewer has checked and a short list of exceptions. Maria Delgado, who runs two taquerias in San Antonio, used to spend Sunday nights with a spreadsheet; in her first month with {name} she cleared eleven exceptions in fourteen minutes and approved the close from her phone.",
        3: f"{name} connects to the owner's bank and point-of-sale system, accepts receipts and invoices by photo, email or upload, and matches every document to a transaction automatically. By the third business day of the month the owner receives a close a {name} reviewer has checked, a short list of exceptions, and a plain explanation of anything that looks unusual. Maria Delgado, who runs two taquerias in San Antonio, used to spend Sunday nights with a spreadsheet; in her first month with {name} she cleared eleven exceptions in fourteen minutes and approved the close from her phone.",
        4: f"{name} connects to the owner's bank and point-of-sale system, accepts receipts and invoices by photo, email or upload, and matches every document to a transaction automatically. By the third business day of the month the owner receives a close a {name} reviewer has checked, a short list of exceptions, and a plain explanation of anything unusual. Maria Delgado, who runs two taquerias in San Antonio, used to spend Sunday nights with a spreadsheet. In her first month with {name} she cleared eleven exceptions in fourteen minutes and approved the close from her phone.",
    }[v]
    benefits = {
        1: f"{name} also flags supplier invoices with early-payment discounts before they expire and keeps every document for seven years. Devon Okafor, who owns a bike shop, caught two discounts worth $340 in his second month and stopped keeping paper copies.",
        2: f"{name} also flags supplier invoices with early-payment discounts before they expire and keeps every document for the seven years tax rules require. Devon Okafor, who owns a bike shop in Portland, caught two discounts worth $340 in his second month and stopped keeping paper copies.",
        3: f"{name} also flags supplier invoices with early-payment discounts before they expire, keeps every document for the seven years tax rules require, and hands the accountant a clean year-end package. Devon Okafor, who owns a bike shop in Portland, caught two discounts worth $340 in his second month and stopped keeping paper copies.",
        4: f"{name} also flags supplier invoices with early-payment discounts before they expire, keeps every document for the seven years tax rules require, and hands the accountant a clean year-end package. Devon Okafor, who owns a bike shop in Portland, caught two discounts worth $340 in his second month and stopped keeping paper copies.",
    }[v]
    quote = {
        1: f"\"Owners told us they did not want to learn accounting; they wanted to know what was wrong and fix it in ten minutes,\" said Elena Park, head of product at {name}. \"We built the close around that ten minutes.\"",
        2: f"\"Owners told us they did not want to learn accounting; they wanted to know what was wrong and fix it in ten minutes,\" said Elena Park, head of product at {name}. \"We built the close around that ten minutes, and we put a person behind it.\"",
        3: f"\"Owners told us they did not want to learn accounting; they wanted to know what was wrong and fix it in ten minutes,\" said Elena Park, head of product at {name}. \"We built the close around that ten minutes, and we put a person behind it.\"",
        4: f"\"Owners told us they did not want to learn accounting. They wanted to know what was wrong and fix it in ten minutes,\" said Elena Park, head of product at {name}. \"We built the close around those ten minutes, and we put a person behind it.\"",
    }[v]
    cta = {
        1: f"{name} is available today for $99 a month per location. Owners can connect their accounts in fifteen minutes at {name.lower()}.com.",
        2: f"{name} is available today for $119 a month per location. Owners can connect their accounts in fifteen minutes at {name.lower()}.com and receive their first reviewed close the following month.",
        3: f"{name} is available today for $119 a month per location, with the first month free. Owners can connect their accounts in fifteen minutes at {name.lower()}.com and receive their first reviewed close the following month.",
        4: f"{name} is available today for $119 a month per location, with the first month free. Owners connect their accounts in fifteen minutes at {name.lower()}.com and receive their first reviewed close the following month.",
    }[v]
    texts = [headline, subheading, summary, problem, solution, benefits, quote, cta]
    claims_by_slot = {
        "summary": [
            {"text": "About 60 percent of small business owners do their own bookkeeping", "kind": "evidence", "finding_ids": ["F-02"]},
        ]
        + ([{"text": "spending six to nine hours a week on it", "kind": "assumption", "finding_ids": []}] if v >= 2 else []),
        "problem": [
            {"text": "Seven of the ten operators in our panel had missed a supplier discount", "kind": "evidence", "finding_ids": ["F-11"]},
        ] if v >= 2 else [],
        "benefits": [{"text": "keeps every document for seven years", "kind": "evidence", "finding_ids": ["F-10"]}],
        "cta": [{"text": "$119 a month per location" if v >= 2 else "$99 a month per location", "kind": "evidence", "finding_ids": ["F-07"]}],
    }
    return [{"id": sid, "text": t, "claims": claims_by_slot.get(sid, [])} for sid, t in zip(_SLOT_IDS, texts)]


def draft(name: str) -> dict:
    return {"product_name": name, "press_release": {"slots": _slots(name, 1)}, "key_insight": f"{name} Closes the Books for Small Business Owners Every Month"}


def refinement(name: str, version: int) -> dict:
    slots = _slots(name, version)
    if version == 2:
        edits = [
            {"slot_id": "headline", "new_text": slots[0]["text"], "rationale": "Named the segment the research supports and the concrete promise of a third-business-day close instead of a generic monthly claim.", "evidence_finding_ids": ["F-02", "F-11"], "change_kind": "sharpen"},
            {"slot_id": "subheading", "new_text": slots[1]["text"], "rationale": "Added that the close is reviewed, which the panel named as the reason they would pay.", "evidence_finding_ids": ["F-07"], "change_kind": "sharpen"},
            {"slot_id": "summary", "new_text": slots[2]["text"], "rationale": "Sharpened the target customer to one-to-three-location operators and replaced the vague time claim with the panel's six to nine hours.", "evidence_finding_ids": ["F-02"], "change_kind": "reground"},
            {"slot_id": "problem", "new_text": slots[3]["text"], "rationale": "Replaced the generic pain with the panel's own numbers and the missed-discount trigger the research identified.", "evidence_finding_ids": ["F-11"], "change_kind": "reground"},
            {"slot_id": "solution", "new_text": slots[4]["text"], "rationale": "Made the review step and the third-business-day promise explicit, and placed Maria in a city so the anecdote reads as real.", "evidence_finding_ids": [], "change_kind": "clarify"},
            {"slot_id": "benefits", "new_text": slots[5]["text"], "rationale": "Tied the seven-year retention to the tax rule that requires it.", "evidence_finding_ids": ["F-10"], "change_kind": "reground"},
            {"slot_id": "internal_quote", "new_text": slots[6]["text"], "rationale": "Added the human review to the quote so the differentiator appears in the product's own voice.", "evidence_finding_ids": [], "change_kind": "sharpen"},
            {"slot_id": "cta", "new_text": slots[7]["text"], "rationale": "Moved the price inside the panel's willingness-to-pay range and set the expectation for the first close.", "evidence_finding_ids": ["F-07"], "change_kind": "reground"},
        ]
        summary = "The refined release names the exact operator segment, puts a person behind the close, and grounds every number in the panel and the ledger."
        insight = "Named the segment and the reviewed close; every number now cites the panel or the ledger."
    else:
        edits = [
            {"slot_id": "subheading", "new_text": slots[1]["text"], "rationale": "Four of ten concept participants asked how much work the owner still does; the sub-heading now says approval takes minutes.", "evidence_finding_ids": [], "change_kind": "clarify"},
            {"slot_id": "problem", "new_text": slots[3]["text"], "rationale": "Added the panel's rejection of dashboards to pre-empt the concern that this is another tool to interpret.", "evidence_finding_ids": [], "change_kind": "clarify"},
            {"slot_id": "solution", "new_text": slots[4]["text"], "rationale": "Participants who trusted the automation least wanted an explanation with each exception; the solution paragraph now promises one.", "evidence_finding_ids": [], "change_kind": "clarify"},
            {"slot_id": "benefits", "new_text": slots[5]["text"], "rationale": "Three participants asked what the accountant receives at year end; the benefits now name the year-end package.", "evidence_finding_ids": [], "change_kind": "clarify"},
            {"slot_id": "cta", "new_text": slots[7]["text"], "rationale": "Budget-conscious participants wanted to try before committing; a free first month addresses it without changing the price.", "evidence_finding_ids": ["F-07"], "change_kind": "sharpen"},
        ]
        summary = "The customer-validated release explains the owner's remaining work, adds an explanation to each exception, names the year-end package and offers a free first month."
        insight = "Clarified how little the owner still does and added explanations to exceptions."
    return {"edits": edits, "press_release": {"slots": slots}, "summary_of_changes": summary, "key_insight": insight}


def internal_faq(name: str) -> dict:
    def item(q: str, a: str, ev: list[str]) -> dict:
        return {"question": q, "answer": a, "evidence_finding_ids": ev}

    return {
        "sections": [
            {"title": "Product Overview", "items": [
                item("What is the core customer problem we are trying to solve?", "Owners of independent businesses lose six to nine hours a week matching receipts, invoices and bank transactions, and discover errors months later as missed discounts and accountant questions. The panel put the missed-discount cost at $200 to $600 a quarter.", ["F-02", "F-11"]),
                item("Who is the target customer segment and why is this problem space important to them?", "Owner-operators with one to three locations and no finance staff, roughly 60 percent of small businesses. They do the books after close because nobody else will, and the time comes out of evenings and weekends.", ["F-02"]),
                item(f"What is the product and how does it uniquely solve this problem?", f"{name} matches every document to a transaction automatically and delivers a monthly close a reviewer has checked, with a short exception list. No competitor combines automated matching with a reviewed close under $150 a month.", ["F-12"]),
            ]},
            {"title": "Market Opportunity", "items": [
                item("What is the competitive landscape and why haven't existing solutions met the customer need?", "Firms charge $300 to $800 and still make the owner gather documents; suites cost $30 to $90 but leave the reconciliation to the owner; capture apps stop at capture. Each solves one third of the job.", ["F-05", "F-06"]),
                item("Why does this problem need to be solved now?", "Open-banking access to small-business bank data is now standard and receipt OCR exceeds 95 percent field accuracy, so the matching that used to need a bookkeeper can be automated reliably for the first time.", ["F-08", "F-09"]),
                item("What is the TAM, and what are the key assumptions driving the calculation?", "Assuming 4 million owner-operated businesses in the target segment, 45 percent already on cloud tools and reachable, and $119 a month, the serviceable market is about $2.6 billion a year. The 4 million figure is an assumption to validate.", ["F-04", "F-07"]),
            ]},
            {"title": "Minimum Lovable Product", "items": [
                item("What are the MLP use cases?", "Connect bank and POS, capture receipts and invoices, automatic matching, a reviewed monthly close, an exception queue, and a year-end package for the accountant.", []),
                item("What are the MLP customer experience requirements?", "Accounts connected in fifteen minutes, close delivered by the third business day, fewer than ten exceptions a month for one location, and every exception explained in one sentence.", []),
                item("What are the guardrails for what this product is not: customers it does not serve, functionality outside MLP scope?", "No payroll, tax filing, forecasting or inventory in version one. Not for regulated businesses needing audit-grade inventory records, nor for businesses with more than three locations.", []),
            ]},
            {"title": "Business Strategy", "items": [
                item("What is our approach to building this in a customer-obsessed, differentiated and profitable way?", "Lead with the reviewed close and the exception list, price inside the panel's willingness-to-pay range, and keep the reviewer step lean with automation that handles the routine 90 percent.", ["F-07"]),
                item("What are the business model options and what is the recommended path?", "Options: (1) software-only subscription at $49; (2) subscription with reviewed close at $119; (3) usage-based pricing per transaction. We recommend option 2: it matches the panel's stated willingness to pay, keeps CAC recoverable within four months at a $400 acquisition cost, and yields 70 percent gross margin once a reviewer handles forty accounts.", ["F-07"]),
                item("What is the phased product roadmap beyond MLP?", "Phase two adds sales-tax preparation and multi-location roll-ups; phase three adds cash-flow forecasting and accountant collaboration tools.", []),
            ]},
            {"title": "Validation & Risk Assessment", "items": [
                item("What are the critical assumptions that must be validated for this product and business to succeed?", "That owners trust an automated close once a person has checked it, that matching accuracy reaches a level owners stop double-checking within two months, and that one reviewer can handle forty accounts.", []),
                item("What is the fastest and most frugal path to validate these assumptions with high confidence?", "A concierge pilot with twenty operators for two months, a landing page pricing test at $99 and $129, and a reviewer time study across the pilot accounts.", []),
                item("What are the top reasons this product won't succeed?", "Reviewer costs erode margin, owners keep double-checking and see no time saved, or a cloud suite bundles a reviewed close first.", ["F-06"]),
                item("What are the key regulatory, compliance or legal considerations?", "Seven-year record retention, bank data access under open-banking terms, state digital-receipt rules for sales-tax audits, and clear disclaimers that the service is bookkeeping, not tax advice.", ["F-08", "F-10"]),
            ]},
        ],
        "key_insight": "Reviewer cost at scale is the risk that shows up in most answers.",
    }


def concept_validation(name: str) -> dict:
    participants = [
        ("C-01", "Maria Delgado", "Early adopter, two taquerias", "Sunday-night spreadsheet", "very_disappointed", "adopt"),
        ("C-02", "Devon Okafor", "Mainstream, bike shop", "Half-configured suite", "very_disappointed", "adopt"),
        ("C-03", "Lena Fischer", "Premium buyer, bakery with wholesale", "Suite plus spreadsheets", "somewhat_disappointed", "maybe"),
        ("C-04", "Marcus Hill", "Budget-conscious, barbershop", "Notebook and bank app", "somewhat_disappointed", "maybe"),
        ("C-05", "Tom Brennan", "Tech-resistant, hardware store", "Part-time bookkeeper", "not_disappointed", "reject"),
        ("C-06", "Sofia Alvarez", "Heavy suite user, cafe", "Cloud suite, fully set up", "somewhat_disappointed", "maybe"),
        ("C-07", "Priya Natarajan", "New to the category, fitness studio", "Receipt app plus accountant", "very_disappointed", "adopt"),
        ("C-08", "Jonas Lindqvist", "Seasonal, food truck", "Whatever works that week", "somewhat_disappointed", "maybe"),
        ("C-09", "Hannah Weiss", "Rural, farm stand", "Paper ledger", "very_disappointed", "adopt"),
        ("C-10", "Ray Castellano", "Skeptic, auto repair", "Spouse plus a suite", "not_disappointed", "reject"),
    ]
    return {
        "research_questions": [
            "After reading this, what do you think you would still have to do every month?",
            "What would make you stop trusting the close?",
            "What would you pay, and what would make $119 feel expensive?",
            "What would make you choose this over your current suite?",
            "After the first month, what would keep you using it?",
            "Who else has to agree before you sign up?",
        ],
        "participants": [
            {"id": i, "name": n, "segment": s, "context": f"{n} runs a {s.split(',')[-1].strip()}.", "current_solution": c, "sean_ellis": se, "verdict": v}
            for i, n, s, c, se, v in participants
        ],
        "resonated": [
            {"theme": "A person has checked the close", "participant_ids": ["C-01", "C-02", "C-03", "C-06", "C-07", "C-09"], "quotes": [{"participant_id": "C-07", "text": "The reviewer is the whole product for me. Software alone I already have."}]},
            {"theme": "Exceptions instead of a dashboard", "participant_ids": ["C-01", "C-02", "C-04", "C-07", "C-08", "C-09"], "quotes": [{"participant_id": "C-02", "text": "Eleven things to look at is fine. Eleven charts is not."}]},
            {"theme": "Early-payment discounts caught", "participant_ids": ["C-02", "C-03", "C-06"], "quotes": [{"participant_id": "C-03", "text": "The discounts alone would pay for it in my wholesale months."}]},
        ],
        "concerns": [
            {"theme": "How much work is left for the owner", "participant_ids": ["C-03", "C-04", "C-05", "C-06"], "quotes": [{"participant_id": "C-06", "text": "Forwarding every invoice is still work. Say how much of my week this actually removes."}]},
            {"theme": "Trusting an automated match", "participant_ids": ["C-04", "C-05", "C-08", "C-10"], "quotes": [{"participant_id": "C-05", "text": "If it matches wrong and I approve it, whose mistake is that?"}]},
            {"theme": "What the accountant gets at year end", "participant_ids": ["C-03", "C-06", "C-09"], "quotes": [{"participant_id": "C-09", "text": "My accountant will ask for the same folder either way unless you tell me what she gets."}]},
        ],
        "surprising_insights": ["Participants valued the explanation attached to an exception more than the matching accuracy itself.", "Three participants would let the reviewer message their accountant directly."],
        "polarizing": [
            {"aspect": "$119 a month", "loved_by": ["C-01", "C-03", "C-07"], "questioned_by": ["C-04", "C-08"], "why": "Owners with wholesale or discount exposure see a clear payback; cash-heavy budget operators compare it to doing nothing."},
        ],
        "recommended_refinements": [
            "State how little the owner still does each month.",
            "Promise a one-sentence explanation with every exception.",
            "Name what the accountant receives at year end.",
            "Offer a free first month rather than lowering the price.",
        ],
        "synthesized_faq": {
            "question": "What key insights from customer concept testing shaped this product?",
            "answer": "Six of ten participants said the reviewed close was the reason they would pay, and six preferred a short exception list to any dashboard. Four asked how much work remains for the owner, which led to the approval-in-minutes promise and a one-sentence explanation on every exception. Three asked what the accountant receives, so the year-end package became explicit. Two budget-conscious owners wanted to try before committing, which produced the free first month.",
            "evidence_finding_ids": ["F-07"],
        },
        "key_insight": "Six of ten would pay for the reviewed close; four worry about the work left for the owner.",
    }


def external_faq(name: str) -> dict:
    def item(q: str, a: str, ev: list[str]) -> dict:
        return {"question": q, "answer": a, "evidence_finding_ids": ev}

    return {
        "items": [
            item("How much do I still have to do each month?", f"Connect your bank and point-of-sale once, then forward receipts and supplier invoices as they arrive by photo, email or upload. {name} matches them for you. On the third business day you get a close a reviewer has checked and a short list of exceptions, usually under ten, that takes most owners about fifteen minutes to clear.", []),
            item("What happens if a transaction is matched wrong and I approve it?", "Every exception comes with a one-sentence explanation so you can see why it was matched. If a mistake gets through, tell us and we correct the close and the following month at no charge. You always keep the final approval, and nothing is filed anywhere on your behalf.", []),
            item("What does my accountant get at year end?", "A year-end package with the twelve monthly closes, every document attached to its transaction, and a summary of anything we flagged during the year. Accountants can be given read access so they stop asking you for the folder.", ["F-10"]),
            item("What does it cost and can I try it first?", "$119 a month per location, and the first month is free. There are no per-transaction fees. Cancel any time and export everything.", ["F-07"]),
            item("Does it do payroll or my taxes?", f"Not in this version. {name} does the monthly books and the year-end package; payroll, tax filing and forecasting are on the roadmap and your accountant continues to handle filings.", []),
        ],
        "key_insight": "How much do I still have to do each month?",
    }


def synthesis(name: str, attempt: int = 1) -> dict:
    slots = _slots(name, 4)
    edits = [
        {"slot_id": "summary", "new_text": slots[2]["text"], "rationale": "Tightened the summary and removed a hedging clause.", "evidence_finding_ids": [], "change_kind": "polish"},
        {"slot_id": "problem", "new_text": slots[3]["text"], "rationale": "Cut a repeated phrase and kept the panel numbers.", "evidence_finding_ids": [], "change_kind": "polish"},
        {"slot_id": "solution", "new_text": slots[4]["text"], "rationale": "Split a long sentence so the anecdote reads as speech.", "evidence_finding_ids": [], "change_kind": "polish"},
        {"slot_id": "internal_quote", "new_text": slots[6]["text"], "rationale": "Made the quote read as spoken rather than written.", "evidence_finding_ids": [], "change_kind": "polish"},
        {"slot_id": "cta", "new_text": slots[7]["text"], "rationale": "Active voice in the call to action.", "evidence_finding_ids": [], "change_kind": "polish"},
    ]
    if attempt > 1:
        edits.append({"slot_id": "benefits", "new_text": slots[5]["text"], "rationale": "Bar Raiser: kept the year-end package explicit and checked the retention claim against the ledger.", "evidence_finding_ids": ["F-10"], "change_kind": "reground"})
    faq = internal_faq(name)
    ext = external_faq(name)
    return {
        "title": f"{name} PRFAQ",
        "product_name": name,
        "executive_summary": f"Owners of independent businesses lose an evening a week to bookkeeping and discover mistakes months late. {name} matches receipts, invoices and bank transactions automatically and delivers a monthly close a reviewer has checked, with a short exception list the owner clears in minutes. No competitor offers a reviewed close under $150 a month, and the panel's willingness to pay sits inside our $119 price. The plan is a concierge pilot to prove trust in the close and reviewer economics before scaling.",
        "edits": edits,
        "press_release": {"slots": slots},
        "customer_faq": ext["items"],
        "internal_faq": faq["sections"],
        "research_faq": concept_validation(name)["synthesized_faq"],
        "summary_of_changes": "Editorial pass for voice and flow; all claims kept, two assumptions left flagged for validation." + (" Bar Raiser fixes applied." if attempt > 1 else ""),
        "key_insight": f"{name} gives owners a reviewed monthly close for the price of one lost evening.",
    }


def bar_raiser(name: str) -> dict:
    return {
        "scores": [
            {"criterion": "customer_clarity", "score": 5, "note": "The summary names one-to-three-location operators without finance staff."},
            {"criterion": "problem_specificity", "score": 4, "note": "Six to nine hours and the missed-discount trigger are specific; the year-end scramble is asserted."},
            {"criterion": "anecdote_believability", "score": 4, "note": "Maria and Devon have places and numbers; Maria's fourteen minutes is plausible."},
            {"criterion": "v1_feasibility", "score": 4, "note": "Matching plus a reviewer is buildable; reviewer capacity is the open question the FAQ admits."},
            {"criterion": "differentiation", "score": 4, "note": "The reviewed close under $150 is the claim; F-12 is low confidence."},
            {"criterion": "evidence_coverage", "score": 3, "note": "The six-to-nine-hours figure in the summary is an assumption presented like a finding."},
            {"criterion": "executive_readability", "score": 5, "note": "Reads in one pass; the FAQ answers are direct."},
        ],
        "overall": 4,
        "verdict": "revise",
        "required_fixes": [
            {"target": "press_release.benefits", "instruction": "Keep the year-end package explicit and confirm the seven-year retention claim cites F-10.", "severity": "important"},
            {"target": "internal_faq.6", "instruction": "State the 4 million businesses figure as an assumption to validate, not as a fact.", "severity": "blocking"},
        ],
        "key_insight": "One assumption in the summary reads like evidence; fix it before leadership sees it.",
    }


def validation_plan(name: str) -> dict:
    return {
        "executive_summary": f"{name} promises a reviewed monthly close that owners approve in minutes. Two hypotheses decide everything: that owners trust an automated close once a person has checked it, and that one reviewer can handle forty accounts at $119 a month. If either fails, the product is a capture app with a service cost it cannot carry. The plan tests those first, with twenty operators and a time study, before spending on acquisition.",
        "hypotheses": [
            {"id": "H1", "statement": "Owners approve a reviewed close without re-checking it after two months of use.", "impact": 10, "confidence": 7, "ease": 6, "why_critical": "If owners keep double-checking, no time is saved and the value proposition fails.", "depends_on": [], "phase": "foundation"},
            {"id": "H2", "statement": "One reviewer can complete forty single-location closes a month at the required quality.", "impact": 9, "confidence": 8, "ease": 5, "why_critical": "Reviewer cost determines whether $119 yields a viable gross margin.", "depends_on": [], "phase": "foundation"},
            {"id": "H3", "statement": "Automatic matching produces fewer than ten exceptions a month for a typical single location.", "impact": 8, "confidence": 5, "ease": 7, "why_critical": "More exceptions means more owner work and more reviewer time.", "depends_on": [], "phase": "foundation"},
            {"id": "H4", "statement": "Owners will pay $119 a month after a free first month.", "impact": 9, "confidence": 6, "ease": 8, "why_critical": "Sets revenue per account and the CAC payback.", "depends_on": ["H1"], "phase": "solution_fit"},
            {"id": "H5", "statement": "A one-sentence explanation on each exception removes the trust concern for skeptical owners.", "impact": 6, "confidence": 6, "ease": 8, "why_critical": "Converts the maybe segment from the panel.", "depends_on": ["H1"], "phase": "solution_fit"},
            {"id": "H6", "statement": "Accountants accept the year-end package without requesting the raw folder.", "impact": 6, "confidence": 5, "ease": 6, "why_critical": "Year-end value is a stated reason to stay subscribed.", "depends_on": ["H3"], "phase": "solution_fit"},
            {"id": "H7", "statement": "Customer acquisition cost through accountant referrals is under $400.", "impact": 7, "confidence": 8, "ease": 4, "why_critical": "Determines payback and the growth model.", "depends_on": ["H4"], "phase": "scale"},
            {"id": "H8", "statement": "Owners with two or three locations get the same exception count per location as single-location owners.", "impact": 5, "confidence": 6, "ease": 5, "why_critical": "Multi-location pricing depends on it.", "depends_on": ["H3"], "phase": "scale"},
        ],
        "sequence": [
            {"phase": "foundation", "hypothesis_ids": ["H1", "H2", "H3"], "rationale": "Trust, reviewer economics and exception volume decide whether the product exists.", "decision_point": "If H1 or H2 fails, reconsider the concept before any acquisition spend."},
            {"phase": "solution_fit", "hypothesis_ids": ["H4", "H5", "H6"], "rationale": "Price, explanations and the accountant package determine conversion and retention.", "decision_point": "Determines the launch offer and the exception design."},
            {"phase": "scale", "hypothesis_ids": ["H7", "H8"], "rationale": "Acquisition cost and multi-location behaviour shape the growth plan.", "decision_point": "Sets the marketing budget and multi-location pricing."},
        ],
        "test_plans": [
            {"hypothesis_id": "H1", "method": "Concierge pilot with a manual close", "build": "A shared inbox, a matching spreadsheet and a reviewer; no product code.", "success_criteria": "By month two, at least 70 percent of owners approve the close within one day without opening the underlying transactions.", "sample_size": "Twenty operators; at 70 percent versus a 40 percent null, twenty gives directional confidence with a follow-up cohort of forty.", "risks": "Pilot owners may be unusually motivated; include five skeptics.", "tools": ["Shared email inbox", "Google Sheets", "A weekly call"]},
            {"hypothesis_id": "H2", "method": "Reviewer time study", "build": "Time tracking per close across the pilot accounts.", "success_criteria": "Median reviewer time per close under twenty minutes by month two.", "sample_size": "All pilot closes for two months, at least forty closes.", "risks": "Early closes are slower; measure the trend, not the first month.", "tools": ["Toggl", "A simple checklist"]},
            {"hypothesis_id": "H3", "method": "Matching accuracy measurement", "build": "A rules-plus-OCR prototype run against pilot data.", "success_criteria": "Fewer than ten exceptions per single-location month for 80 percent of accounts.", "sample_size": "Forty account-months.", "risks": "Cash-heavy businesses will skew the exception count; report by segment.", "tools": ["An OCR API", "A notebook"]},
            {"hypothesis_id": "H4", "method": "Landing page price test", "build": "Two landing pages at $99 and $129 with a free-month offer and a sign-up form.", "success_criteria": "Sign-up rate at $129 within 20 percent of the $99 rate.", "sample_size": "Roughly 400 visitors per variant for a detectable difference at typical conversion rates.", "risks": "Sign-up intent is not payment; follow with card capture.", "tools": ["A landing page builder", "Ad spend of about $600"]},
            {"hypothesis_id": "H5", "method": "Message test inside the pilot", "build": "Half the pilot receives explanations on exceptions, half receives the bare list.", "success_criteria": "Approval time and re-check rate improve in the explanation group.", "sample_size": "Ten and ten within the pilot.", "risks": "Small groups; treat as directional.", "tools": ["The pilot inbox"]},
        ],
        "synthesis": {"proceed": "H1 and H2 pass and H3 is within range; the price test shows no cliff at $129.", "iterate": "H1 passes but H3 shows too many exceptions; redesign matching or narrow the launch segment.", "stop": "H1 fails with skeptics and mainstream owners alike, or reviewer time stays above forty minutes per close."},
        "not_testing": [
            {"aspect": "Payroll and tax filing", "why": "Out of version one; the close must work first."},
            {"aspect": "Multi-location roll-ups", "why": "Single-location economics decide the business."},
            {"aspect": "Forecasting", "why": "Owners asked for fewer things to interpret, not more."},
        ],
        "best_practices": {"biggest_pitfall": "Measuring satisfaction with the close instead of whether owners stop re-checking it.", "first_test": "The concierge pilot, because it tests trust and reviewer economics at once.", "recruitment": "Accountants who serve owner-operators, and local business associations; include the skeptics the panel identified.", "prototype_fidelity": "A real reviewer and a real monthly close; the software can be a spreadsheet."},
        "key_insight": "Owners must stop re-checking the reviewed close, or no time is saved.",
    }
