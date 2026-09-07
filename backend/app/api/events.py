"""Server-Sent Events with replay.

`GET /api/runs/{id}/events?after=<seq>` (or the `Last-Event-ID` header) replays
persisted events after that sequence number, then tails live events. The stream
closes on a terminal event, or immediately after replay if the run is already
finished, so a client never waits on a run that is over.
"""

from __future__ import annotations

import asyncio
import json

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.api.deps import get_runner, get_store
from app.council.runner import CouncilRunner
from app.db.store import Store

router = APIRouter(prefix="/api", tags=["events"])

TERMINAL = {"run.completed", "run.failed", "run.cancelled"}
TERMINAL_STATUS = {"completed", "failed", "cancelled"}


def sse(event: dict) -> str:
    return f"id: {event['seq']}\nevent: {event['type']}\ndata: {json.dumps(event, ensure_ascii=False)}\n\n"


@router.get("/runs/{run_id}/events")
async def run_events(
    request: Request,
    run_id: str,
    after: int = Query(default=0, ge=0),
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    store: Store = Depends(get_store),
    runner: CouncilRunner = Depends(get_runner),
):
    row = await store.get_run(run_id)
    if row is None:
        raise HTTPException(status_code=404, detail="run not found")
    start = after
    if last_event_id and last_event_id.isdigit():
        start = max(start, int(last_event_id))

    async def generate():
        queue = runner.bus.subscribe(run_id)
        last = start
        try:
            for event in await store.list_events(run_id, after_seq=start):
                last = event["seq"]
                yield sse(event)
            current = await store.get_run(run_id)
            terminal_seen = any(e["type"] in TERMINAL for e in await store.list_events(run_id, after_seq=start))
            if (current and current.status in TERMINAL_STATUS and not runner.is_active(run_id)) or terminal_seen:
                yield "event: end\ndata: {}\n\n"
                return
            while True:
                if await request.is_disconnected():
                    return
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                if event["seq"] <= last:
                    continue
                last = event["seq"]
                yield sse(event)
                if event["type"] in TERMINAL:
                    yield "event: end\ndata: {}\n\n"
                    return
        finally:
            runner.bus.unsubscribe(run_id, queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )
