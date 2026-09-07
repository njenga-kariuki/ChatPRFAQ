from __future__ import annotations

import json
from difflib import SequenceMatcher

from app.council.render import render_plan
from app.council.roster import PERSONAS
from app.schemas import Edit, PressRelease, SynthesisOutput, ValidationPlanOutput
from app.schemas.document import SLOT_LABELS
from app.schemas.run import RunSnapshot


def prfaq_markdown(snapshot: RunSnapshot) -> str:
    prfaq_row = next((a for a in reversed(snapshot.artifacts) if a.kind == "prfaq"), None)
    if prfaq_row is None:
        return "# PRFAQ not available yet\n"
    prfaq = SynthesisOutput.model_validate(prfaq_row.payload)
    return prfaq.markdown()


def plan_markdown(snapshot: RunSnapshot) -> str:
    row = next((a for a in reversed(snapshot.artifacts) if a.kind == "plan"), None)
    if row is None:
        return "# Validation plan not available yet\n"
    return render_plan(ValidationPlanOutput.model_validate(row.payload)) + "\n"


def _word_diff(a: str, b: str) -> str:
    """CriticMarkup-style inline diff at word granularity."""
    aw, bw = a.split(), b.split()
    sm = SequenceMatcher(a=aw, b=bw, autojunk=False)
    out: list[str] = []
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal":
            out.append(" ".join(aw[i1:i2]))
        elif op == "delete":
            out.append("{--" + " ".join(aw[i1:i2]) + "--}")
        elif op == "insert":
            out.append("{++" + " ".join(bw[j1:j2]) + "++}")
        else:
            out.append("{--" + " ".join(aw[i1:i2]) + "--}{++" + " ".join(bw[j1:j2]) + "++}")
    return " ".join(x for x in out if x)


def redline_markdown(snapshot: RunSnapshot, from_version: int = 1, to_version: int | None = None) -> str:
    versions = {v.version: v for v in snapshot.versions}
    if not versions:
        return "# No press release versions yet\n"
    to_version = to_version or max(versions)
    if from_version not in versions or to_version not in versions:
        return f"# Versions {from_version} and {to_version} are not both available\n"
    src = PressRelease.model_validate(versions[from_version].press_release)
    dst = PressRelease.model_validate(versions[to_version].press_release)
    edits_by_slot: dict[str, list[tuple[int, Edit, str]]] = {}
    for v in range(from_version + 1, to_version + 1):
        vr = versions[v]
        for e in vr.edits:
            edit = Edit.model_validate(e)
            edits_by_slot.setdefault(edit.slot_id, []).append((v, edit, PERSONAS[vr.persona].name))
    out = [f"# Press release redline v{from_version} → v{to_version}", "", "CriticMarkup: {++inserted++} {--deleted--} {>>comment<<}", ""]
    for slot in dst.slots:
        before = src.text_of(slot.id)
        after = slot.text
        out.append(f"## {SLOT_LABELS[slot.id]}")
        out.append("")
        out.append(after if before == after else _word_diff(before, after))
        for v, edit, author in edits_by_slot.get(slot.id, []):
            ev = f" Evidence: {', '.join(edit.evidence_finding_ids)}." if edit.evidence_finding_ids else ""
            out.append(f"{{>>{author} (v{v}, {edit.change_kind}): {edit.rationale}{ev}<<}}")
        out.append("")
    return "\n".join(out)


def run_json(snapshot: RunSnapshot) -> str:
    return json.dumps(snapshot.model_dump(), indent=2, ensure_ascii=False)
