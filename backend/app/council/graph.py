"""Seat dependency graph and readiness."""

from __future__ import annotations

from app.council.seat import Seat
from app.council.seats import COUNCIL_SEATS, SEAT_BY_ID
from app.schemas.events import ArtifactKind, SeatId
from app.settings import Settings


def council_graph(settings: Settings) -> dict[SeatId, tuple[ArtifactKind, ...]]:
    """Dependencies for this run's configuration.

    - Seats 5 and 6 both depend only on pr_v2, so they run in parallel.
    - Seat 7 waits for both (it reads the internal FAQ's guardrails).
    - Seat 10 waits for the final PRFAQ (after the Bar Raiser loop) unless
      PARALLEL_VALIDATION_PLAN is set, in which case it runs alongside seat 9.
    """
    graph: dict[SeatId, tuple[ArtifactKind, ...]] = {s.id: s.depends_on for s in COUNCIL_SEATS}
    if not settings.bar_raiser_enabled:
        graph.pop("9b", None)
        graph["10"] = ("prfaq",)
    else:
        graph["10"] = ("prfaq", "bar_raiser")
    if settings.parallel_validation_plan:
        graph["10"] = ("external_faq",)
    return graph


def ready_seats(
    graph: dict[SeatId, tuple[ArtifactKind, ...]],
    completed_kinds: set[str],
    finished_seats: set[SeatId],
    running_seats: set[SeatId],
) -> list[Seat]:
    """Seats whose inputs exist and which are neither done nor running, in council order."""
    out: list[Seat] = []
    for seat_id, deps in graph.items():
        if seat_id in finished_seats or seat_id in running_seats:
            continue
        if all(d in completed_kinds for d in deps):
            out.append(SEAT_BY_ID[seat_id])
    return out


def run_is_complete(graph: dict[SeatId, tuple[ArtifactKind, ...]], finished_seats: set[SeatId]) -> bool:
    return all(seat_id in finished_seats for seat_id in graph)


def critical_path_length(graph: dict[SeatId, tuple[ArtifactKind, ...]]) -> int:
    """Number of sequential stages, for the design doc's claim and the tests."""
    produces = {SEAT_BY_ID[s].produces: s for s in graph}
    depth: dict[SeatId, int] = {}

    def d(seat_id: SeatId) -> int:
        if seat_id in depth:
            return depth[seat_id]
        deps = [produces[k] for k in graph[seat_id] if k in produces]
        depth[seat_id] = 1 + max((d(x) for x in deps), default=0)
        return depth[seat_id]

    return max(d(s) for s in graph)
