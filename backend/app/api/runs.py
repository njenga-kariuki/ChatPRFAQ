from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query

from app.api.deps import get_runner, get_settings, get_store, require_owner
from app.api.snapshot import build_snapshot, roster_records, seat_records
from app.council.runner import CouncilRunner
from app.db.store import Store
from app.schemas.events import EventEnvelope
from app.schemas.framing import FramingFeedback
from app.schemas.run import (
    ConfirmFramingRequest,
    CreateRunRequest,
    CreateRunResponse,
    PersonaRecord,
    RefineFramingRequest,
    RunListItem,
    RunListResponse,
    RunSnapshot,
    SeatRecord,
)
from app.settings import Settings

router = APIRouter(prefix="/api", tags=["runs"])


@router.post("/runs", response_model=CreateRunResponse, dependencies=[Depends(require_owner)])
async def create_run(body: CreateRunRequest, runner: CouncilRunner = Depends(get_runner), settings: Settings = Depends(get_settings)):
    if not settings.provider_ready:
        raise HTTPException(status_code=503, detail="model provider is not configured: set ANTHROPIC_API_KEY or LLM_PROVIDER=fake")
    run_id = await runner.create_run(body.idea.strip())
    return CreateRunResponse(run_id=run_id)


@router.get("/runs", response_model=RunListResponse, dependencies=[Depends(require_owner)])
async def list_runs(limit: int = Query(default=25, ge=1, le=100), cursor: str | None = None, store: Store = Depends(get_store)):
    rows = await store.list_runs(limit=limit + 1, before=cursor)
    has_more = len(rows) > limit
    rows = rows[:limit]
    items = []
    for r in rows:
        framing = json.loads(r.framing_json) if r.framing_json else None
        items.append(
            RunListItem(
                id=r.id,
                idea=r.idea,
                status=r.status,  # type: ignore[arg-type]
                headline=r.headline,
                working_name=(framing or {}).get("working_name"),
                created_at=r.created_at,
                completed_at=r.completed_at,
                total_cost_usd=r.total_cost_usd or 0.0,
            )
        )
    return RunListResponse(runs=items, next_cursor=rows[-1].created_at if has_more and rows else None)


@router.get("/runs/{run_id}", response_model=RunSnapshot)
async def get_run(run_id: str, store: Store = Depends(get_store)):
    row = await store.get_run(run_id)
    if row is None:
        raise HTTPException(status_code=404, detail="run not found")
    return await build_snapshot(store, row)


@router.get("/share/{token}", response_model=RunSnapshot)
async def get_shared_run(token: str, store: Store = Depends(get_store)):
    row = await store.get_run_by_share_token(token)
    if row is None:
        raise HTTPException(status_code=404, detail="share link not found")
    return await build_snapshot(store, row, include_share_token=False)


@router.post("/runs/{run_id}/framing/refine", status_code=202, dependencies=[Depends(require_owner)])
async def refine_framing(run_id: str, body: RefineFramingRequest, runner: CouncilRunner = Depends(get_runner)):
    try:
        await runner.refine_framing(run_id, FramingFeedback(**body.model_dump()))
    except KeyError:
        raise HTTPException(status_code=404, detail="run not found")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"ok": True}


@router.post("/runs/{run_id}/framing/confirm", status_code=202, dependencies=[Depends(require_owner)])
async def confirm_framing(run_id: str, body: ConfirmFramingRequest, runner: CouncilRunner = Depends(get_runner)):
    try:
        await runner.confirm(run_id, body.framing)
    except KeyError:
        raise HTTPException(status_code=404, detail="run not found")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"ok": True}


@router.post("/runs/{run_id}/cancel", status_code=202, dependencies=[Depends(require_owner)])
async def cancel_run(run_id: str, runner: CouncilRunner = Depends(get_runner), store: Store = Depends(get_store)):
    if await store.get_run(run_id) is None:
        raise HTTPException(status_code=404, detail="run not found")
    await runner.cancel(run_id)
    return {"ok": True}


@router.post("/runs/{run_id}/resume", status_code=202, dependencies=[Depends(require_owner)])
async def resume_run(run_id: str, runner: CouncilRunner = Depends(get_runner)):
    try:
        await runner.resume(run_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="run not found")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"ok": True}


@router.get("/roster", response_model=list[PersonaRecord])
async def roster():
    return roster_records()


@router.get("/seats", response_model=list[SeatRecord])
async def seats():
    return seat_records()


@router.get("/schema/event", response_model=EventEnvelope, include_in_schema=True)
async def event_schema():
    """Exists so the RunEvent union is part of the OpenAPI document for type generation."""
    raise HTTPException(status_code=404, detail="schema-only endpoint")
