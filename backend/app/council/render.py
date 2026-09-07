"""Render typed artifacts as the readable text the council sees in the dossier.

Rendering is deterministic (no timestamps, sorted where order is not semantic) so
that a rendered artifact is byte-identical every time it appears in a prompt.
"""

from __future__ import annotations

from typing import Any

from app.schemas.document import SLOT_LABELS, DraftOutput, Edit, PressRelease, RefinementOutput
from app.schemas.faq import ExternalFAQOutput, FAQSection, InternalFAQOutput
from app.schemas.framing import Framing
from app.schemas.plan import ValidationPlanOutput
from app.schemas.prfaq import SynthesisOutput
from app.schemas.research import Ledger, ResearchArtifact
from app.schemas.review import CRITERION_LABELS, BarRaiserOutput
from app.schemas.validation import ConceptValidationOutput, ProblemValidationOutput


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {i}" for i in items) if items else "- (none)"


def render_brief(idea: str, framing: Framing) -> str:
    return (
        "# Product brief\n\n"
        f"**Idea as submitted:** {idea.strip()}\n\n"
        "**Confirmed framing**\n\n"
        f"{framing.markdown()}"
    )


def render_research(r: ResearchArtifact) -> str:
    out = ["# Market research", "", r.markdown.strip()]
    if r.citations:
        out += ["", "## Citations attached by the research tools", ""]
        seen: set[str] = set()
        n = 0
        for c in r.citations:
            if c.url in seen:
                continue
            seen.add(c.url)
            n += 1
            out.append(f"{n}. {c.title or c.url} — {c.url}")
    return "\n".join(out)


def render_ledger(ledger: Ledger) -> str:
    return "# Evidence ledger\n\nCite findings by id (F-xx). Sources are listed below the findings.\n\n" + ledger.markdown()


def render_problem_validation(pv: ProblemValidationOutput) -> str:
    out = ["# Problem validation (simulated panel of ten)", "", "## Research questions", _bullets(pv.research_questions), ""]
    out += ["## Participants", "", "| id | name | role | archetype | frequency | current solution |", "|---|---|---|---|---|---|"]
    for p in pv.participants:
        out.append(f"| {p.id} | {p.name} | {p.role} | {p.archetype} | {p.problem_frequency} | {p.current_solution} |")
    out += ["", "## Severity", "**High priority:**", _bullets(pv.severity.high_priority), "**Moderate:**", _bullets(pv.severity.moderate), "**Edge cases:**", _bullets(pv.severity.edge_cases)]
    out += ["", "## Current solutions", "**What they use:**", _bullets(pv.current_solutions.what_they_use), "**Where it fails:**", _bullets(pv.current_solutions.where_it_fails), "**Workaround costs:**", _bullets(pv.current_solutions.workaround_costs)]
    out += ["", "## Solution appetite", "**Quotes:**", _bullets([f"{q.participant_id}: \"{q.text}\"" for q in pv.appetite.quotes]), f"**Price sensitivity:** {pv.appetite.price_sensitivity}", "**Must-haves:**", _bullets(pv.appetite.must_haves)]
    out += ["", "## Implications for product direction", "**Core capabilities:**", _bullets(pv.implications.core_capabilities), "**Approaches to avoid:**", _bullets(pv.implications.approaches_to_avoid), "**Performance thresholds:**", _bullets(pv.implications.performance_thresholds), "**Acceptable trade-offs:**", _bullets(pv.implications.acceptable_tradeoffs)]
    out += ["", "## Risks", "**Segments unlikely to adopt:**", _bullets(pv.risks.segments_unlikely_to_adopt), "**Competing priorities:**", _bullets(pv.risks.competing_priorities)]
    return "\n".join(out)


def _render_edits(edits: list[Edit]) -> str:
    if not edits:
        return "- (no changes recorded)"
    return "\n".join(
        f"- [{e.slot_id}] ({e.change_kind}) {e.rationale}" + (f" Evidence: {', '.join(e.evidence_finding_ids)}." if e.evidence_finding_ids else "")
        for e in edits
    )


def render_press_release(version: int, pr: PressRelease, edits: list[Edit] | None, summary: str | None) -> str:
    title = {1: "Press release v1 (Principal PM draft)", 2: "Press release v2 (VP Product refinement)", 3: "Press release v3 (customer-validated refinement)", 4: "Press release v4 (editorial final)"}[version]
    out = [f"# {title}", ""]
    if summary:
        out += [f"**Summary of changes:** {summary}", ""]
    if edits is not None:
        out += ["## Key refinements made", _render_edits(edits), ""]
    out += ["## Text", ""]
    for s in pr.slots:
        out.append(f"[{SLOT_LABELS[s.id]}] {s.text.strip()}")
        out.append("")
    assumptions = [c for s in pr.slots for c in s.claims if c.kind == "assumption"]
    if assumptions:
        out += ["## Claims marked as assumptions", _bullets([c.text for c in assumptions])]
    return "\n".join(out).rstrip()


def _render_sections(sections: list[FAQSection], start: int = 1) -> tuple[list[str], int]:
    out: list[str] = []
    n = start
    for sec in sections:
        out += [f"**{sec.title}**", ""]
        for item in sec.items:
            ev = f" (evidence: {', '.join(item.evidence_finding_ids)})" if item.evidence_finding_ids else ""
            out += [f"{n}. **Question:** {item.question}", f"**Answer:** {item.answer}{ev}", ""]
            n += 1
    return out, n


def render_internal_faq(faq: InternalFAQOutput) -> str:
    body, _ = _render_sections(faq.sections)
    return "\n".join(["# Internal FAQ", ""] + body).rstrip()


def render_concept_validation(cv: ConceptValidationOutput) -> str:
    out = ["# Concept validation (simulated panel of ten)", "", "## Research questions", _bullets(cv.research_questions), ""]
    out += ["## Participants", "", "| id | name | segment | current solution | Sean Ellis | verdict |", "|---|---|---|---|---|---|"]
    for p in cv.participants:
        out.append(f"| {p.id} | {p.name} | {p.segment} | {p.current_solution} | {p.sean_ellis} | {p.verdict} |")
    share = round(cv.very_disappointed_share() * 100)
    out += ["", f"Sean Ellis signal: {share}% would be very disappointed without the product (40%+ is a strong signal).", ""]
    out += ["## What resonated most"]
    for r in cv.resonated:
        out.append(f"- **{r.theme}** ({len(r.participant_ids)} of {len(cv.participants)}: {', '.join(r.participant_ids)})")
        out += [f"  - {q.participant_id}: \"{q.text}\"" for q in r.quotes]
    out += ["", "## Major concerns"]
    for r in cv.concerns:
        out.append(f"- **{r.theme}** ({len(r.participant_ids)} of {len(cv.participants)}: {', '.join(r.participant_ids)})")
        out += [f"  - {q.participant_id}: \"{q.text}\"" for q in r.quotes]
    out += ["", "## Surprising insights", _bullets(cv.surprising_insights), "", "## Polarizing aspects"]
    out += [f"- **{p.aspect}** — loved by {', '.join(p.loved_by) or 'none'}; questioned by {', '.join(p.questioned_by) or 'none'}. {p.why}" for p in cv.polarizing]
    out += ["", "## Recommended refinements", _bullets(cv.recommended_refinements), ""]
    out += ["## Synthesized FAQ entry", f"**Question:** {cv.synthesized_faq.question}", f"**Answer:** {cv.synthesized_faq.answer}"]
    return "\n".join(out)


def render_external_faq(faq: ExternalFAQOutput) -> str:
    out = ["# Customer FAQ", ""]
    for i, item in enumerate(faq.items, 1):
        out += [f"{i}. **Question:** {item.question}", f"**Answer:** {item.answer}", ""]
    return "\n".join(out).rstrip()


def render_prfaq(s: SynthesisOutput) -> str:
    out = ["# Synthesized PRFAQ", "", f"**Summary of editorial changes:** {s.summary_of_changes}", "", "## Editorial edits to the press release", _render_edits(s.edits), "", s.markdown()]
    return "\n".join(out).rstrip()


def render_bar_raiser(r: BarRaiserOutput) -> str:
    out = ["# Bar Raiser review", "", "| criterion | score | note |", "|---|---|---|"]
    for sc in r.scores:
        out.append(f"| {CRITERION_LABELS.get(sc.criterion, sc.criterion)} | {sc.score}/5 | {sc.note} |")
    out += ["", f"**Overall:** {r.overall}/5 — verdict: {r.verdict}", "", "## Required fixes"]
    out += [f"- [{f.severity}] {f.target}: {f.instruction}" for f in r.required_fixes] or ["- (none)"]
    return "\n".join(out)


def render_plan(p: ValidationPlanOutput) -> str:
    out = ["# Hypothesis-driven validation plan", "", p.executive_summary, "", "## Hypotheses (ranked by priority score)", "", "| id | hypothesis | I | C | E | score | phase |", "|---|---|---|---|---|---|---|"]
    for h in p.ranked():
        out.append(f"| {h.id} | {h.statement} | {h.impact} | {h.confidence} | {h.ease} | {h.priority_score} | {h.phase} |")
    out += ["", "## Sequence"]
    for ph in p.sequence:
        out.append(f"- **{ph.phase}** ({', '.join(ph.hypothesis_ids)}): {ph.rationale} Decision point: {ph.decision_point}")
    out += ["", "## Test plans"]
    for t in p.test_plans:
        out += [f"### {t.hypothesis_id}", f"- Method: {t.method}", f"- Build: {t.build}", f"- Success criteria: {t.success_criteria}", f"- Sample size: {t.sample_size}", f"- Risks: {t.risks}", f"- Tools: {', '.join(t.tools)}", ""]
    out += ["## Synthesis", f"- Proceed: {p.synthesis.proceed}", f"- Iterate: {p.synthesis.iterate}", f"- Stop: {p.synthesis.stop}", "", "## Not testing yet"]
    out += [f"- {e.aspect}: {e.why}" for e in p.not_testing]
    bp = p.best_practices
    out += ["", "## Validation practice for this concept", f"- Biggest pitfall: {bp.biggest_pitfall}", f"- First test: {bp.first_test}", f"- Recruitment: {bp.recruitment}", f"- Prototype fidelity: {bp.prototype_fidelity}"]
    return "\n".join(out)


def render_artifact(kind: str, payload: Any, *, idea: str = "") -> str:
    """Dispatch on artifact kind. `payload` is the parsed model for that kind."""
    if kind == "brief":
        return render_brief(payload.idea, payload.framing)
    if kind == "market_research":
        return render_research(payload)
    if kind == "ledger":
        return render_ledger(payload)
    if kind == "problem_validation":
        return render_problem_validation(payload)
    if kind == "pr_v1":
        d: DraftOutput = payload
        return render_press_release(1, d.press_release, None, None)
    if kind in ("pr_v2", "pr_v3"):
        r: RefinementOutput = payload
        return render_press_release(2 if kind == "pr_v2" else 3, r.press_release, r.edits, r.summary_of_changes)
    if kind == "internal_faq":
        return render_internal_faq(payload)
    if kind == "concept_validation":
        return render_concept_validation(payload)
    if kind == "external_faq":
        return render_external_faq(payload)
    if kind == "prfaq":
        return render_prfaq(payload)
    if kind == "bar_raiser":
        return render_bar_raiser(payload)
    if kind == "plan":
        return render_plan(payload)
    raise KeyError(kind)
