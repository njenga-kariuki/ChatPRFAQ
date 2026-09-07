from __future__ import annotations

from typing import Protocol

from app.llm.types import OnEvent, SeatOutcome, SeatRequest
from app.settings import Settings


class Provider(Protocol):
    name: str

    async def run(self, request: SeatRequest, on_event: OnEvent) -> SeatOutcome: ...


def build_provider(settings: Settings) -> Provider:
    if settings.llm_provider == "fake":
        from app.llm.fake_provider import FakeProvider

        return FakeProvider(delay_s=settings.fake_stream_delay_s)
    from app.llm.anthropic_provider import AnthropicProvider

    return AnthropicProvider(settings)
