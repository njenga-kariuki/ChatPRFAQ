from __future__ import annotations

from fastapi import Depends, Header, HTTPException, Request

from app.council.runner import CouncilRunner
from app.db.store import Store
from app.settings import Settings


def get_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_store(request: Request) -> Store:
    return request.app.state.store


def get_runner(request: Request) -> CouncilRunner:
    runner = request.app.state.runner
    if runner is None:
        raise HTTPException(status_code=503, detail="model provider is not configured: set ANTHROPIC_API_KEY or LLM_PROVIDER=fake")
    return runner


def require_owner(settings: Settings = Depends(get_settings), authorization: str | None = Header(default=None)) -> None:
    """When OWNER_TOKEN is configured, mutating and listing endpoints need it."""
    if not settings.owner_token:
        return
    if authorization != f"Bearer {settings.owner_token}":
        raise HTTPException(status_code=401, detail="owner token required")
