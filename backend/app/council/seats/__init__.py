"""The council's seats, in council order."""

from __future__ import annotations

from app.council.seat import Seat
from app.schemas.events import SeatId

from . import (
    s00_framing,
    s01_research,
    s01b_ledger,
    s02_problem_validation,
    s03_draft,
    s04_vp_refine,
    s05_internal_faq,
    s06_concept_validation,
    s07_solution_refine,
    s08_external_faq,
    s09_synthesis,
    s09b_bar_raiser,
    s10_validation_plan,
)

SEATS: tuple[Seat, ...] = (
    s00_framing.SEAT,
    s01_research.SEAT,
    s01b_ledger.SEAT,
    s02_problem_validation.SEAT,
    s03_draft.SEAT,
    s04_vp_refine.SEAT,
    s05_internal_faq.SEAT,
    s06_concept_validation.SEAT,
    s07_solution_refine.SEAT,
    s08_external_faq.SEAT,
    s09_synthesis.SEAT,
    s09b_bar_raiser.SEAT,
    s10_validation_plan.SEAT,
)

SEAT_BY_ID: dict[SeatId, Seat] = {s.id: s for s in SEATS}
COUNCIL_SEATS: tuple[Seat, ...] = tuple(s for s in SEATS if s.id != "0")


def seat(seat_id: SeatId) -> Seat:
    return SEAT_BY_ID[seat_id]
