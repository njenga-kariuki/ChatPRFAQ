"""The press release as a typed document: eight slots, claims, edits."""

from __future__ import annotations

from typing import Literal

from pydantic import model_validator

from .base import StrictModel

SlotId = Literal[
    "headline",
    "subheading",
    "summary",
    "problem",
    "solution",
    "benefits",
    "internal_quote",
    "cta",
]

SLOT_ORDER: tuple[str, ...] = (
    "headline",
    "subheading",
    "summary",
    "problem",
    "solution",
    "benefits",
    "internal_quote",
    "cta",
)

SLOT_LABELS: dict[str, str] = {
    "headline": "Headline",
    "subheading": "Sub-heading",
    "summary": "Summary paragraph",
    "problem": "Problem paragraph",
    "solution": "Solution paragraph",
    "benefits": "Benefits paragraph",
    "internal_quote": "Internal quote",
    "cta": "How to get started",
}

SLOT_PURPOSE: dict[str, str] = {
    "headline": "A compelling headline that reflects the market opportunity. One line, no period.",
    "subheading": "One sentence naming the product and the primary customer benefit.",
    "summary": "Opens with launch city and date (e.g. AUSTIN, Texas — March 15, 2027 —), then summarises "
    "the product with market insight in three to five sentences that make the reader want to continue.",
    "problem": "The customer problem, the market gap and the critical unmet need, grounded in research.",
    "solution": "The most important parts of the experience, how it works, and a detailed, believable "
    "customer anecdote showing the enduring problem being solved.",
    "benefits": "Secondary features and benefits with a second concrete customer anecdote.",
    "internal_quote": "A quote from a named team member explaining why the product was built, in strategic "
    "context, with one or two sentences of framing.",
    "cta": "A brief call to action informed by the customer research.",
}

ClaimKind = Literal["evidence", "assumption"]


class Claim(StrictModel):
    """A factual or quantitative statement inside a slot and where it comes from."""

    text: str
    kind: ClaimKind
    finding_ids: list[str]


class Slot(StrictModel):
    id: SlotId
    text: str
    claims: list[Claim]


class PressRelease(StrictModel):
    slots: list[Slot]

    @model_validator(mode="after")
    def _exactly_eight_in_order(self) -> "PressRelease":
        ids = [s.id for s in self.slots]
        if tuple(ids) != SLOT_ORDER:
            raise ValueError(
                f"press release must contain exactly the eight slots in order {list(SLOT_ORDER)}, got {ids}"
            )
        return self

    def slot(self, slot_id: str) -> Slot:
        for s in self.slots:
            if s.id == slot_id:
                return s
        raise KeyError(slot_id)

    def text_of(self, slot_id: str) -> str:
        return self.slot(slot_id).text

    def word_count(self) -> int:
        return sum(len(s.text.split()) for s in self.slots)

    def markdown(self, labelled: bool = False) -> str:
        parts: list[str] = []
        for s in self.slots:
            if s.id == "headline":
                parts.append(f"**{s.text.strip()}**")
            elif s.id == "subheading":
                parts.append(f"*{s.text.strip()}*")
            else:
                prefix = f"[{SLOT_LABELS[s.id]}] " if labelled else ""
                parts.append(prefix + s.text.strip())
        return "\n\n".join(parts)

    def assumptions(self) -> list[Claim]:
        return [c for s in self.slots for c in s.claims if c.kind == "assumption"]


class DraftOutput(StrictModel):
    """Seat 3: the first press release."""

    product_name: str
    press_release: PressRelease
    key_insight: str


ChangeKind = Literal["sharpen", "clarify", "reground", "cut", "restructure", "polish"]


class Edit(StrictModel):
    """One change to one slot, with the reason and the evidence behind it."""

    slot_id: SlotId
    new_text: str
    rationale: str
    evidence_finding_ids: list[str]
    change_kind: ChangeKind


class RefinementOutput(StrictModel):
    """Seats 4 and 7: surgical edits plus the complete new version."""

    edits: list[Edit]
    press_release: PressRelease
    summary_of_changes: str
    key_insight: str


def reconcile_edits(previous: PressRelease, new: PressRelease, edits: list[Edit], author_note: str) -> list[Edit]:
    """Make the edit list agree with the two versions.

    The new press release is the source of truth. Edits whose slot did not change are
    dropped; slots that changed without an edit get a synthesized entry so the
    provenance record is complete; `new_text` is normalised to the slot's final text.
    """
    changed = {s.id for s in new.slots if s.text.strip() != previous.text_of(s.id).strip()}
    seen: set[str] = set()
    result: list[Edit] = []
    for e in edits:
        if e.slot_id in changed and e.slot_id not in seen:
            seen.add(e.slot_id)
            result.append(e.model_copy(update={"new_text": new.text_of(e.slot_id)}))
    for slot_id in SLOT_ORDER:
        if slot_id in changed and slot_id not in seen:
            result.append(
                Edit(
                    slot_id=slot_id,  # type: ignore[arg-type]
                    new_text=new.text_of(slot_id),
                    rationale=author_note,
                    evidence_finding_ids=[],
                    change_kind="polish",
                )
            )
    return result
