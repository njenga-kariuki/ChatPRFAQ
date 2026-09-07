from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Literal

from app.schemas.events import Usage
from app.schemas.research import Citation


@dataclass
class SeatRequest:
    seat_id: str
    model: str
    effort: str
    max_tokens: int
    system: list[dict]
    messages: list[dict]
    output_schema: dict | None
    uses_web: bool
    web_search_max_uses: int = 15
    web_fetch_max_uses: int = 8
    thinking_display: str = "summarized"
    attempt: int = 1
    # only the fake provider reads these
    context: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderEvent:
    kind: Literal["delta", "thinking", "tool"]
    text: str = ""
    tool_kind: str | None = None
    query: str | None = None
    url: str | None = None


OnEvent = Callable[[ProviderEvent], Awaitable[None]]


@dataclass
class SeatOutcome:
    text: str
    parsed: dict | None
    citations: list[Citation]
    usage: Usage
    stop_reason: str
    model_served: str
    fallback_used: bool
    request_id: str | None = None


class ProviderError(Exception):
    """A provider failure the runner may retry."""


class RefusalError(ProviderError):
    def __init__(self, category: str | None):
        super().__init__(f"the model declined this request (category: {category or 'unspecified'})")
        self.category = category


class OutputTruncated(ProviderError):
    def __init__(self, max_tokens: int):
        super().__init__(f"output hit max_tokens={max_tokens}")
        self.max_tokens = max_tokens
