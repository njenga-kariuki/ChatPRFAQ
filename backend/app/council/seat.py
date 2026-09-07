"""Seat definitions: what a seat consumes, produces, runs on, and asks for."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable

from app.schemas.base import StrictModel
from app.schemas.events import ArtifactKind, PersonaId, SeatId
from app.schemas.framing import Framing, FramingFeedback
from app.schemas.review import BarRaiserOutput
from app.settings import Settings, Tier

PHASES: dict[str, tuple[SeatId, ...]] = {
    "Frame & research": ("0", "1", "1b", "2"),
    "Draft & review": ("3", "4"),
    "Pressure-test": ("5", "6"),
    "Refine & finalise": ("7", "8", "9", "9b", "10"),
}


def phase_of(seat_id: SeatId) -> str:
    for name, seats in PHASES.items():
        if seat_id in seats:
            return name
    raise KeyError(seat_id)


@dataclass
class SeatContext:
    """Everything a seat's task builder may look at."""

    idea: str
    framing: Framing | None
    artifacts: dict[str, Any]  # kind -> parsed payload model
    settings: Settings
    attempt: int = 1
    validation_error: str | None = None
    feedback: FramingFeedback | None = None
    previous_framing: Framing | None = None
    bar_raiser_review: BarRaiserOutput | None = None

    def get(self, kind: ArtifactKind) -> Any:
        return self.artifacts.get(kind)

    @property
    def working_name(self) -> str:
        if self.framing and self.framing.working_name:
            return self.framing.working_name
        return "the product"


@dataclass(frozen=True)
class Seat:
    id: SeatId
    name: str
    persona: PersonaId
    produces: ArtifactKind
    depends_on: tuple[ArtifactKind, ...]
    tier: Tier
    effort: str
    max_tokens: int
    output_model: type[StrictModel] | None
    task_builder: Callable[[SeatContext], str]
    activity: tuple[str, ...] = field(default_factory=tuple)
    uses_web: bool = False
    optional: bool = False

    @property
    def phase(self) -> str:
        return phase_of(self.id)

    def task(self, ctx: SeatContext) -> str:
        text = self.task_builder(ctx)
        if ctx.validation_error:
            text += (
                "\n\n## Correction required\n\n"
                "Your previous answer did not validate against the required JSON structure. "
                f"The validator reported:\n\n{ctx.validation_error}\n\n"
                "Return the complete answer again with the structure corrected."
            )
        return text

    def model(self, settings: Settings) -> str:
        return settings.model_for(self.id, self.tier)

    def effort_for(self, settings: Settings) -> str:
        return settings.effort_for(self.id, self.effort)
