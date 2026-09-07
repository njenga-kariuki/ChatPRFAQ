"""The typed event stream. One discriminated union shared with the frontend.

Every event is persisted before it is published, and the SSE endpoint replays
from any `seq`, so a client can reconstruct a run from events alone.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import Field

from .base import StrictModel
from .document import Edit, PressRelease
from .framing import Framing
from .review import BarRaiserOutput

SeatId = Literal["0", "1", "1b", "2", "3", "4", "5", "6", "7", "8", "9", "9b", "10"]

ArtifactKind = Literal[
    "brief",
    "market_research",
    "ledger",
    "problem_validation",
    "pr_v1",
    "pr_v2",
    "internal_faq",
    "concept_validation",
    "pr_v3",
    "external_faq",
    "prfaq",
    "bar_raiser",
    "plan",
]

RunStatus = Literal[
    "framing",
    "awaiting_confirmation",
    "running",
    "completed",
    "failed",
    "cancelled",
]

PersonaId = Literal[
    "strategist",
    "analyst",
    "researcher",
    "pm",
    "vp_product",
    "biz_eng",
    "customer_success",
    "editor",
    "bar_raiser",
    "validation_lead",
]


class Usage(StrictModel):
    input_tokens: int = 0
    cache_creation_input_tokens: int = 0
    cache_read_input_tokens: int = 0
    output_tokens: int = 0
    web_searches: int = 0


class _Base(StrictModel):
    seq: int
    run_id: str
    ts: str


class RunStarted(_Base):
    type: Literal["run.started"] = "run.started"
    idea: str


class FramingReady(_Base):
    type: Literal["framing.ready"] = "framing.ready"
    framing: Framing
    attempt: int
    key_insight: str | None


class RunStatusChanged(_Base):
    type: Literal["run.status"] = "run.status"
    status: RunStatus


class StepStarted(_Base):
    type: Literal["step.started"] = "step.started"
    seat: SeatId
    name: str
    persona: PersonaId
    model: str
    effort: str
    attempt: int
    activity: list[str]


class StepProgress(_Base):
    type: Literal["step.progress"] = "step.progress"
    seat: SeatId
    note: str


class StepTool(_Base):
    type: Literal["step.tool"] = "step.tool"
    seat: SeatId
    kind: Literal["search", "fetch"]
    query: str | None
    url: str | None


class StepDelta(_Base):
    type: Literal["step.delta"] = "step.delta"
    seat: SeatId
    text: str


class StepThinking(_Base):
    type: Literal["step.thinking"] = "step.thinking"
    seat: SeatId
    text: str


class StepCompleted(_Base):
    type: Literal["step.completed"] = "step.completed"
    seat: SeatId
    artifact_id: str
    kind: ArtifactKind
    key_insight: str | None
    usage: Usage
    duration_s: float
    cost_usd: float
    model: str
    fallback_used: bool
    attempt: int


class StepFailed(_Base):
    type: Literal["step.failed"] = "step.failed"
    seat: SeatId
    error: str
    retryable: bool
    attempt: int


class DocumentVersionEvent(_Base):
    type: Literal["document.version"] = "document.version"
    version: int
    artifact_id: str
    produced_by_seat: SeatId
    persona: PersonaId
    press_release: PressRelease
    edits: list[Edit]
    caption: str | None


class RunBudgetWarning(_Base):
    type: Literal["run.budget_warning"] = "run.budget_warning"
    spent_usd: float
    ceiling_usd: float


class RunCompleted(_Base):
    type: Literal["run.completed"] = "run.completed"
    prfaq_artifact_id: str
    plan_artifact_id: str
    total_cost_usd: float
    duration_s: float
    bar_raiser: BarRaiserOutput | None


class RunFailed(_Base):
    type: Literal["run.failed"] = "run.failed"
    error: str


class RunCancelled(_Base):
    type: Literal["run.cancelled"] = "run.cancelled"


RunEvent = Annotated[
    Union[
        RunStarted,
        FramingReady,
        RunStatusChanged,
        StepStarted,
        StepProgress,
        StepTool,
        StepDelta,
        StepThinking,
        StepCompleted,
        StepFailed,
        DocumentVersionEvent,
        RunBudgetWarning,
        RunCompleted,
        RunFailed,
        RunCancelled,
    ],
    Field(discriminator="type"),
]


class EventEnvelope(StrictModel):
    """Wrapper so the union appears in the OpenAPI components for type generation."""

    event: RunEvent
