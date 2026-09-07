"""Seat 9b: the Bar Raiser review."""

from __future__ import annotations

from typing import Literal

from .base import StrictModel

Criterion = Literal[
    "customer_clarity",
    "problem_specificity",
    "anecdote_believability",
    "v1_feasibility",
    "differentiation",
    "evidence_coverage",
    "executive_readability",
]

CRITERIA: tuple[str, ...] = (
    "customer_clarity",
    "problem_specificity",
    "anecdote_believability",
    "v1_feasibility",
    "differentiation",
    "evidence_coverage",
    "executive_readability",
)

CRITERION_LABELS: dict[str, str] = {
    "customer_clarity": "Customer clarity",
    "problem_specificity": "Problem specificity",
    "anecdote_believability": "Anecdote believability",
    "v1_feasibility": "Feasibility of version 1",
    "differentiation": "Differentiation",
    "evidence_coverage": "Evidence coverage",
    "executive_readability": "Executive readability",
}


class Score(StrictModel):
    criterion: Criterion
    score: int  # 1-5
    note: str


class Fix(StrictModel):
    target: str  # e.g. "press_release.problem", "internal_faq.6", "executive_summary"
    instruction: str
    severity: Literal["blocking", "important"]


class BarRaiserOutput(StrictModel):
    scores: list[Score]
    overall: int  # 1-5
    verdict: Literal["pass", "revise"]
    required_fixes: list[Fix]
    key_insight: str

    def needs_revision(self) -> bool:
        return self.verdict == "revise" and bool(self.required_fixes)
