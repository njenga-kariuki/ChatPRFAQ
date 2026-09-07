"""Seat 10: the hypothesis-driven validation plan."""

from __future__ import annotations

from typing import Literal

from .base import StrictModel

Phase = Literal["foundation", "solution_fit", "scale"]


class Hypothesis(StrictModel):
    id: str  # H1
    statement: str
    impact: int  # 1-10
    confidence: int  # 1-10, where 10 = very uncertain (as in the original ICE adaptation)
    ease: int  # 1-10
    why_critical: str
    depends_on: list[str]
    phase: Phase

    @property
    def priority_score(self) -> float:
        return round(self.impact * (11 - self.confidence) / max(1, 11 - self.ease), 2)


class PhaseDecision(StrictModel):
    phase: Phase
    hypothesis_ids: list[str]
    rationale: str
    decision_point: str


class TestPlan(StrictModel):
    hypothesis_id: str
    method: str
    build: str
    success_criteria: str
    sample_size: str
    risks: str
    tools: list[str]


class Synthesis(StrictModel):
    proceed: str
    iterate: str
    stop: str


class Exclusion(StrictModel):
    aspect: str
    why: str


class BestPractices(StrictModel):
    biggest_pitfall: str
    first_test: str
    recruitment: str
    prototype_fidelity: str


class ValidationPlanOutput(StrictModel):
    executive_summary: str
    hypotheses: list[Hypothesis]
    sequence: list[PhaseDecision]
    test_plans: list[TestPlan]
    synthesis: Synthesis
    not_testing: list[Exclusion]
    best_practices: BestPractices
    key_insight: str

    def ranked(self) -> list[Hypothesis]:
        return sorted(self.hypotheses, key=lambda h: h.priority_score, reverse=True)
