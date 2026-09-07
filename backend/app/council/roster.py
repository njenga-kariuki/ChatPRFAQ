"""The council roster: nine recurring colleagues plus the Bar Raiser.

Server-owned so the frontend never hardcodes names. `hue` is an index into the
persona hue ring in the design tokens.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.schemas.events import PersonaId, SeatId


@dataclass(frozen=True)
class Persona:
    id: PersonaId
    name: str
    title: str
    initials: str
    hue: int
    seats: tuple[SeatId, ...]
    how_i_review: str
    mandate: str


ROSTER: tuple[Persona, ...] = (
    Persona(
        id="strategist",
        name="Product Strategist",
        title="Product Strategy Expert",
        initials="ST",
        hue=0,
        seats=("0",),
        how_i_review="I turn a raw idea into a precise customer, problem and scope before anyone spends effort on it.",
        mandate="Frame the idea: who exactly it is for, the pain it removes, and the boundaries of the first product.",
    ),
    Persona(
        id="analyst",
        name="Market Analyst",
        title="Expert Market Research Analyst",
        initials="MA",
        hue=1,
        seats=("1", "1b"),
        how_i_review="I bring current numbers and named competitors, with sources, and I say plainly what the evidence does not support.",
        mandate="Research the market with live web sources and distil it into an evidence ledger the whole council cites.",
    ),
    Persona(
        id="researcher",
        name="User Researcher",
        title="Principal User Researcher",
        initials="UR",
        hue=2,
        seats=("2", "6"),
        how_i_review="I run simulated panels the way a real researcher would: past behaviour over promises, specifics over generalities, skeptics included.",
        mandate="Validate the problem before drafting (seat 2) and test the concept after the VP pass (seat 6).",
    ),
    Persona(
        id="pm",
        name="Principal PM",
        title="Principal Product Manager",
        initials="PM",
        hue=3,
        seats=("3", "7"),
        how_i_review="I write the press release from the customer backwards and make surgical edits when research tells me to.",
        mandate="Draft the press release (seat 3) and integrate concept-test feedback without expanding scope (seat 7).",
    ),
    Persona(
        id="vp_product",
        name="VP Product",
        title="VP of Product",
        initials="VP",
        hue=4,
        seats=("4",),
        how_i_review="I sharpen claims, tighten the customer, and refuse manufactured statistics.",
        mandate="Refine the draft for executive review: precision, credibility, differentiation, with word count held.",
    ),
    Persona(
        id="biz_eng",
        name="VP Business + Principal Engineer",
        title="VP Business Lead and Principal Engineer",
        initials="BE",
        hue=5,
        seats=("5",),
        how_i_review="We answer the hard internal questions together: unit economics, TAM, feasibility, guardrails, risk.",
        mandate="Write the internal FAQ with S-Team rigour: business model options, MLP scope, validation, legal.",
    ),
    Persona(
        id="customer_success",
        name="Customer Success Lead",
        title="Customer Success Lead",
        initials="CS",
        hue=6,
        seats=("8",),
        how_i_review="I turn the concerns real customers raised into the questions they will actually ask, and answer honestly.",
        mandate="Draft the customer-facing FAQ from concept-test concerns, in a customer's words.",
    ),
    Persona(
        id="editor",
        name="Senior Editor",
        title="Senior Editor and Writer",
        initials="ED",
        hue=7,
        seats=("9",),
        how_i_review="I make the document read like one voice, check every claim against the ledger, and cut hedging.",
        mandate="Synthesize the final PRFAQ: executive summary, polished press release, both FAQs, research synthesis.",
    ),
    Persona(
        id="bar_raiser",
        name="Bar Raiser",
        title="Bar Raiser",
        initials="BR",
        hue=8,
        seats=("9b",),
        how_i_review="I score the document against the bar an S-Team reader would apply and name the fixes that matter.",
        mandate="Independently review the PRFAQ against a fixed rubric and return the few fixes that would change the decision.",
    ),
    Persona(
        id="validation_lead",
        name="Head of Validation",
        title="Head of Product Validation and Research",
        initials="HV",
        hue=9,
        seats=("10",),
        how_i_review="I decompose the concept into testable hypotheses and sequence the cheapest tests that could kill it.",
        mandate="Design the hypothesis-driven validation plan: ICE-ranked hypotheses, phases, frugal tests.",
    ),
)

PERSONAS: dict[PersonaId, Persona] = {p.id: p for p in ROSTER}


def persona_for_seat(seat_id: SeatId) -> Persona:
    for p in ROSTER:
        if seat_id in p.seats:
            return p
    raise KeyError(seat_id)
