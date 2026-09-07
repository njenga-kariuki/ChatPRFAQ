"""FastAPI application: API routers, SSE, and the built frontend."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api import events as events_api
from app.api import export as export_api
from app.api import runs as runs_api
from app.council.bus import EventBus
from app.council.runner import CouncilRunner
from app.db.store import Store
from app.llm.provider import build_provider
from app.schemas.run import HealthResponse
from app.settings import Settings, get_settings

log = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
        store = Store(settings.database_url)
        await store.init()
        try:
            provider = build_provider(settings)
        except Exception as e:  # provider misconfigured: keep the API up so /health explains
            log.error("model provider not available: %s", e)
            provider = None
        bus = EventBus()
        app.state.settings = settings
        app.state.store = store
        app.state.runner = CouncilRunner(store, provider, settings, bus) if provider else None
        app.state.provider_error = None if provider else "provider not configured"
        yield
        if app.state.runner:
            await app.state.runner.shutdown()
        await store.close()

    app = FastAPI(title="ChatPRFAQ council", version=__version__, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )
    app.include_router(runs_api.router)
    app.include_router(events_api.router)
    app.include_router(export_api.router)

    @app.get("/api/health", response_model=HealthResponse)
    async def health(request: Request):
        s: Settings = request.app.state.settings
        return HealthResponse(
            ok=request.app.state.runner is not None,
            provider=s.llm_provider,
            provider_ready=request.app.state.runner is not None,
            models={"judgment": s.council_model_default, "fast": s.council_model_fast, "reviewer": s.council_model_reviewer},
            database=s.database_url.split("://", 1)[0],
            version=__version__,
        )

    @app.middleware("http")
    async def provider_guard(request: Request, call_next):
        if request.url.path.startswith("/api/runs") and request.method == "POST" and request.app.state.runner is None:
            return JSONResponse(status_code=503, content={"detail": "model provider is not configured: set ANTHROPIC_API_KEY or LLM_PROVIDER=fake"})
        return await call_next(request)

    static_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", settings.static_dir))
    index_path = os.path.join(static_dir, "index.html")
    if os.path.isdir(os.path.join(static_dir, "assets")):
        app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

    if os.path.isfile(index_path):

        @app.get("/{path:path}", include_in_schema=False)
        async def spa(path: str):
            candidate = os.path.join(static_dir, path)
            if path and os.path.isfile(candidate) and os.path.commonpath([static_dir, os.path.abspath(candidate)]) == static_dir:
                return FileResponse(candidate)
            return FileResponse(index_path)

    return app


app = create_app()
