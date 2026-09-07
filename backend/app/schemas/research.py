"""Market research, citations, and the evidence ledger."""

from __future__ import annotations

import re
from typing import Literal

from .base import StrictModel


class Citation(StrictModel):
    url: str
    title: str
    cited_text: str


class ResearchArtifact(StrictModel):
    """Seat 1 output: free-form research with the citations the API attached."""

    markdown: str
    citations: list[Citation]
    searches: int
    fetches: int


class Source(StrictModel):
    id: str  # S-01
    url: str
    title: str
    cited_text: str


Topic = Literal[
    "market_size",
    "competition",
    "customer",
    "pricing",
    "trend",
    "regulation",
    "barrier",
    "success_factor",
    "other",
]

Confidence = Literal["high", "medium", "low"]


class Finding(StrictModel):
    id: str  # F-01
    claim: str
    metric: str | None
    topic: Topic
    source_ids: list[str]
    confidence: Confidence


class LedgerOutput(StrictModel):
    """Seat 1b output. Sources are assigned by code from the citations, so the model
    only returns findings that reference them."""

    findings: list[Finding]
    key_insight: str


class Ledger(StrictModel):
    findings: list[Finding]
    sources: list[Source]

    def finding(self, finding_id: str) -> Finding | None:
        return next((f for f in self.findings if f.id == finding_id), None)

    def markdown(self) -> str:
        lines = ["| id | claim | metric | topic | sources | confidence |", "|---|---|---|---|---|---|"]
        for f in self.findings:
            lines.append(
                f"| {f.id} | {f.claim} | {f.metric or ''} | {f.topic} | {', '.join(f.source_ids)} | {f.confidence} |"
            )
        lines.append("")
        lines.append("| id | source | url |")
        lines.append("|---|---|---|")
        for s in self.sources:
            lines.append(f"| {s.id} | {s.title} | {s.url} |")
        return "\n".join(lines)


_SENTENCE_END = re.compile(r"(?<=[.!?])\s+(?=[A-Z\"'(])")


def research_key_insight(markdown: str, limit: int = 220) -> str | None:
    """One line for the timeline: the first sentence of the Strategic Recommendations
    section, or of the report when that heading is missing.

    Seat 1 writes prose with citations, so it cannot also return a structured
    ``key_insight``; the line is derived by code instead of a second model call."""
    if not markdown or not markdown.strip():
        return None
    body: str | None = None
    for section in re.split(r"^##\s+", markdown, flags=re.MULTILINE):
        if section.lower().startswith("strategic recommendation"):
            body = section.split("\n", 1)[1] if "\n" in section else ""
            break
    for text in ([body] if body else []) + [markdown]:
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith(("|", "#", "```")):
                continue
            line = re.sub(r"^(?:[-*+]|\d+[.)])\s+", "", line)  # list markers
            line = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", line)  # links
            line = re.sub(r"[*_`]+", "", line)  # emphasis
            line = re.sub(r"\s*\[\d+\]", "", line)  # numeric citation markers
            line = re.sub(r"\s+", " ", line).strip()
            if len(line) < 40:
                continue
            sentence = _SENTENCE_END.split(line, 1)[0].strip()
            if len(sentence) > limit:
                sentence = sentence[:limit].rsplit(" ", 1)[0].rstrip(",;:") + "…"
            return sentence
    return None
