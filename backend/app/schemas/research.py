"""Market research, citations, and the evidence ledger."""

from __future__ import annotations

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
