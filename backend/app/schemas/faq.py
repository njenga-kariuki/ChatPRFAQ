from __future__ import annotations

from .base import StrictModel


class FAQItem(StrictModel):
    question: str
    answer: str
    evidence_finding_ids: list[str]


class FAQSection(StrictModel):
    title: str
    items: list[FAQItem]


class InternalFAQOutput(StrictModel):
    """Seat 5: five sections, sixteen questions, in the order the task lists them."""

    sections: list[FAQSection]
    key_insight: str

    def all_items(self) -> list[FAQItem]:
        return [i for s in self.sections for i in s.items]


class ExternalFAQOutput(StrictModel):
    """Seat 8: five customer questions."""

    items: list[FAQItem]
    key_insight: str
