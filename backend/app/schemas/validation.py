"""The two simulated customer panels: problem validation (seat 2) and concept validation (seat 6)."""

from __future__ import annotations

from typing import Literal

from .base import StrictModel
from .faq import FAQItem

Archetype = Literal["acute", "moderate", "edge", "skeptic"]


class Participant(StrictModel):
    id: str  # P-01
    name: str
    role: str
    archetype: Archetype
    context: str
    problem_frequency: str
    current_solution: str


class Quote(StrictModel):
    participant_id: str
    text: str


class SeverityFindings(StrictModel):
    high_priority: list[str]
    moderate: list[str]
    edge_cases: list[str]


class SolutionLandscape(StrictModel):
    what_they_use: list[str]
    where_it_fails: list[str]
    workaround_costs: list[str]


class AppetiteSignals(StrictModel):
    quotes: list[Quote]
    price_sensitivity: str
    must_haves: list[str]


class Implications(StrictModel):
    core_capabilities: list[str]
    approaches_to_avoid: list[str]
    performance_thresholds: list[str]
    acceptable_tradeoffs: list[str]


class Risks(StrictModel):
    segments_unlikely_to_adopt: list[str]
    competing_priorities: list[str]


class ProblemValidationOutput(StrictModel):
    research_questions: list[str]
    participants: list[Participant]
    severity: SeverityFindings
    current_solutions: SolutionLandscape
    appetite: AppetiteSignals
    implications: Implications
    risks: Risks
    key_insight: str


SeanEllis = Literal["very_disappointed", "somewhat_disappointed", "not_disappointed"]
Verdict = Literal["adopt", "maybe", "reject"]


class ConceptParticipant(StrictModel):
    id: str  # C-01
    name: str
    segment: str
    context: str
    current_solution: str
    sean_ellis: SeanEllis
    verdict: Verdict


class Reaction(StrictModel):
    theme: str
    participant_ids: list[str]
    quotes: list[Quote]


class Polarizing(StrictModel):
    aspect: str
    loved_by: list[str]
    questioned_by: list[str]
    why: str


class ConceptValidationOutput(StrictModel):
    research_questions: list[str]
    participants: list[ConceptParticipant]
    resonated: list[Reaction]
    concerns: list[Reaction]
    surprising_insights: list[str]
    polarizing: list[Polarizing]
    recommended_refinements: list[str]
    synthesized_faq: FAQItem
    key_insight: str

    def very_disappointed_share(self) -> float:
        if not self.participants:
            return 0.0
        return sum(1 for p in self.participants if p.sean_ellis == "very_disappointed") / len(self.participants)
