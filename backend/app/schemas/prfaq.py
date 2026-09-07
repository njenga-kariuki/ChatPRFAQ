"""Seat 9: the synthesized PRFAQ."""

from __future__ import annotations

from .base import StrictModel
from .document import Edit, PressRelease
from .faq import FAQItem, FAQSection


class SynthesisOutput(StrictModel):
    title: str
    product_name: str
    executive_summary: str
    edits: list[Edit]
    press_release: PressRelease
    customer_faq: list[FAQItem]
    internal_faq: list[FAQSection]
    research_faq: FAQItem
    summary_of_changes: str
    key_insight: str

    def markdown(self) -> str:
        out: list[str] = [f"### **{self.title}**", "", "### **Executive Summary**", "", self.executive_summary, ""]
        out += ["### **Press Release**", "", self.press_release.markdown(), ""]
        out += ["### **Customer FAQ**", ""]
        for i, item in enumerate(self.customer_faq, 1):
            out += [f"{i}. **Question:** {item.question}", f"**Answer:** {item.answer}", ""]
        out += ["### **Internal FAQ**", ""]
        n = 1
        for section in self.internal_faq:
            out += [f"**{section.title}**", ""]
            for item in section.items:
                out += [f"{n}. **Question:** {item.question}", f"**Answer:** {item.answer}", ""]
                n += 1
        out += [f"{n}. **Question:** {self.research_faq.question}", f"**Answer:** {self.research_faq.answer}", ""]
        return "\n".join(out).rstrip() + "\n"
