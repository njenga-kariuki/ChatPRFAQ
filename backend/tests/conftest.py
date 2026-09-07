from __future__ import annotations

import asyncio

import httpx
import pytest

from app.main import create_app
from app.settings import Settings


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        llm_provider="fake",
        database_url=f"sqlite+aiosqlite:///{tmp_path}/test.db",
        anthropic_api_key=None,
        run_cost_ceiling_usd=50.0,
        static_dir=str(tmp_path / "no-static"),
        _env_file=None,
    )


@pytest.fixture
async def app(settings):
    application = create_app(settings)
    async with application.router.lifespan_context(application):
        yield application


@pytest.fixture
async def client(app):
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


async def wait_for_status(client: httpx.AsyncClient, run_id: str, status: str, timeout: float = 30.0) -> dict:
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        r = await client.get(f"/api/runs/{run_id}")
        snap = r.json()
        if snap["run"]["status"] == status:
            return snap
        if snap["run"]["status"] in ("failed",) and status != "failed":
            raise AssertionError(f"run failed: {snap['run']['error']}")
        await asyncio.sleep(0.05)
    raise AssertionError(f"run did not reach {status} in {timeout}s")
