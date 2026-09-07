"""Runtime configuration.

Every model, effort level and limit is an environment variable so a seat can be
re-tuned without a code change. Per-seat overrides use SEAT_<id>_MODEL and
SEAT_<id>_EFFORT, e.g. SEAT_4_MODEL=claude-opus-5, SEAT_1B_EFFORT=low.
"""

from __future__ import annotations

import os
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

Tier = Literal["judgment", "fast", "reviewer"]

# Anthropic first-party list prices, USD per million tokens (input, cache write 5m,
# cache read, output). Used for per-run cost accounting only.
MODEL_PRICES: dict[str, tuple[float, float, float, float]] = {
    "claude-fable-5-1": (10.0, 12.5, 0.25, 50.0),
    "claude-opus-5": (5.0, 6.25, 0.50, 25.0),
    "claude-opus-4-8": (5.0, 6.25, 0.50, 25.0),
    "claude-sonnet-5": (2.0, 2.5, 0.20, 10.0),
    "claude-haiku-4-5": (1.0, 1.25, 0.10, 5.0),
}
WEB_SEARCH_PRICE_USD = 0.01  # per search


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # provider
    anthropic_api_key: str | None = None
    llm_provider: Literal["anthropic", "fake"] = "anthropic"
    fake_stream_delay_s: float = 0.0  # >0 makes the fake provider stream at a human pace

    # models
    council_model_default: str = "claude-fable-5-1"
    council_model_fast: str = "claude-sonnet-5"
    council_model_reviewer: str = "claude-opus-5"
    council_effort_default: str = "high"
    thinking_display: Literal["summarized", "omitted", "updates"] = "summarized"
    enable_fallbacks: bool = True
    fallback_models_with_support: tuple[str, ...] = ("claude-fable-5-1", "claude-opus-5")
    web_search_max_uses: int = 15
    web_fetch_max_uses: int = 8

    # council behaviour
    bar_raiser_enabled: bool = True
    parallel_validation_plan: bool = False
    run_step_timeout_s: int = 900
    run_cost_ceiling_usd: float = 12.0
    max_schema_retries: int = 1

    # storage and web
    database_url: str = "sqlite+aiosqlite:///./data/chatprfaq.db"
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173", "http://localhost:8000"])
    owner_token: str | None = None
    static_dir: str = "../web/dist"
    public_base_url: str = "http://localhost:8000"

    def model_for(self, seat_id: str, tier: Tier) -> str:
        env = os.environ.get(f"SEAT_{seat_id.upper()}_MODEL")
        if env:
            return env
        return {
            "judgment": self.council_model_default,
            "fast": self.council_model_fast,
            "reviewer": self.council_model_reviewer,
        }[tier]

    def effort_for(self, seat_id: str, default: str) -> str:
        return os.environ.get(f"SEAT_{seat_id.upper()}_EFFORT", default)

    @property
    def provider_ready(self) -> bool:
        return self.llm_provider == "fake" or bool(self.anthropic_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
