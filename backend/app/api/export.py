from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, Response

from app.api.deps import get_store
from app.api.snapshot import build_snapshot
from app.db.store import Store
from app.export.markdown import plan_markdown, prfaq_markdown, redline_markdown, run_json

router = APIRouter(prefix="/api", tags=["export"])


@router.get("/runs/{run_id}/export")
async def export_run(
    run_id: str,
    format: str = Query(default="md", pattern="^(md|plan|redline|json)$"),
    from_version: int = Query(default=1, ge=1, le=4),
    to_version: int | None = Query(default=None, ge=1, le=4),
    store: Store = Depends(get_store),
):
    row = await store.get_run(run_id)
    if row is None:
        raise HTTPException(status_code=404, detail="run not found")
    snapshot = await build_snapshot(store, row)
    stem = (row.working_name or "prfaq").replace(" ", "-").lower()
    if format == "md":
        return PlainTextResponse(prfaq_markdown(snapshot), media_type="text/markdown", headers={"Content-Disposition": f'attachment; filename="{stem}-prfaq.md"'})
    if format == "plan":
        return PlainTextResponse(plan_markdown(snapshot), media_type="text/markdown", headers={"Content-Disposition": f'attachment; filename="{stem}-validation-plan.md"'})
    if format == "redline":
        return PlainTextResponse(redline_markdown(snapshot, from_version, to_version), media_type="text/markdown", headers={"Content-Disposition": f'attachment; filename="{stem}-redline.md"'})
    return Response(run_json(snapshot), media_type="application/json", headers={"Content-Disposition": f'attachment; filename="{stem}-run.json"'})
