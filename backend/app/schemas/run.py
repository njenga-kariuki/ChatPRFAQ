"""API request/response models: the run snapshot the frontend loads on first paint."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from .document import Edit, PressRelease
from .events import ArtifactKind, PersonaId, RunStatus, SeatId, Usage
from .framing import Framing
from .research import Finding, Source
from .review import BarRaiserOutput


class CreateRunRequest(BaseModel):
    idea: str = Field(min_length=10, max_length=8000)


class CreateRunResponse(BaseModel):
    run_id: str


class ConfirmFramingRequest(BaseModel):
    framing: Framing | None = None


class RefineFramingRequest(BaseModel):
    target_customer: str = ""
    customer_problem: str = ""
    product_scope: str = ""


class RunRecord(BaseModel):
    id: str
    idea: str
    status: RunStatus
    framing: Framing | None
    created_at: str
    updated_at: str
    completed_at: str | None
    total_cost_usd: float
    error: str | None
    config: dict[str, Any]
    share_token: str | None
    headline: str | None


class StepRecord(BaseModel):
    seat: SeatId
    name: str
    persona: PersonaId
    attempt: int
    status: str
    model: str
    effort: str
    started_at: str | None
    ended_at: str | None
    duration_s: float | None
    usage: Usage
    cost_usd: float
    fallback_used: bool
    error: str | None
    key_insight: str | None


class ArtifactRecord(BaseModel):
    id: str
    kind: ArtifactKind
    seat: SeatId
    persona: PersonaId
    created_at: str
    key_insight: str | None
    payload: dict[str, Any]


class VersionRecord(BaseModel):
    version: int
    artifact_id: str
    produced_by_seat: SeatId
    persona: PersonaId
    press_release: PressRelease
    edits: list[Edit]
    caption: str | None


class PersonaRecord(BaseModel):
    id: PersonaId
    name: str
    title: str
    initials: str
    hue: int
    seats: list[SeatId]
    how_i_review: str


class SeatRecord(BaseModel):
    id: SeatId
    name: str
    persona: PersonaId
    produces: ArtifactKind
    depends_on: list[ArtifactKind]
    phase: str
    tier: str


class RunSnapshot(BaseModel):
    run: RunRecord
    steps: list[StepRecord]
    artifacts: list[ArtifactRecord]
    versions: list[VersionRecord]
    findings: list[Finding]
    sources: list[Source]
    bar_raiser: BarRaiserOutput | None
    last_seq: int
    roster: list[PersonaRecord]
    seats: list[SeatRecord]


class RunListItem(BaseModel):
    id: str
    idea: str
    status: RunStatus
    headline: str | None
    working_name: str | None
    created_at: str
    completed_at: str | None
    total_cost_usd: float


class RunListResponse(BaseModel):
    runs: list[RunListItem]
    next_cursor: str | None


class HealthResponse(BaseModel):
    ok: bool
    provider: str
    provider_ready: bool
    models: dict[str, str]
    database: str
    version: str
