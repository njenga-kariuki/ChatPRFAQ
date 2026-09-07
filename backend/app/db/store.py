"""The Store: every read and write the runner and API perform."""

from __future__ import annotations

import json
import os
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.db.models import ArtifactRow, Base, EventRow, FindingRow, RunRow, SourceRow, StepRow, VersionRow


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def new_id(prefix: str = "") -> str:
    return prefix + uuid.uuid4().hex[:16]


def dumps(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, ensure_ascii=False)


class Store:
    def __init__(self, database_url: str):
        if database_url.startswith("sqlite"):
            path = database_url.split("///", 1)[-1]
            if path and path != ":memory:":
                os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.engine: AsyncEngine = create_async_engine(database_url, future=True)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False, class_=AsyncSession)
        self.url = database_url

    async def init(self) -> None:
        async with self.engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    async def close(self) -> None:
        await self.engine.dispose()

    # runs -------------------------------------------------------------------
    async def create_run(self, idea: str, config: dict[str, Any]) -> RunRow:
        row = RunRow(
            id=new_id("run_"),
            idea=idea,
            status="framing",
            created_at=now_iso(),
            updated_at=now_iso(),
            config_json=dumps(config),
            share_token=secrets.token_urlsafe(12),
        )
        async with self.sessions() as s:
            s.add(row)
            await s.commit()
        return row

    async def get_run(self, run_id: str) -> RunRow | None:
        async with self.sessions() as s:
            return await s.get(RunRow, run_id)

    async def get_run_by_share_token(self, token: str) -> RunRow | None:
        async with self.sessions() as s:
            res = await s.execute(select(RunRow).where(RunRow.share_token == token))
            return res.scalar_one_or_none()

    async def list_runs(self, limit: int = 25, before: str | None = None) -> list[RunRow]:
        async with self.sessions() as s:
            q = select(RunRow).order_by(RunRow.created_at.desc()).limit(limit)
            if before:
                q = q.where(RunRow.created_at < before)
            res = await s.execute(q)
            return list(res.scalars().all())

    async def update_run(self, run_id: str, **fields: Any) -> None:
        fields["updated_at"] = now_iso()
        if "framing" in fields:
            fields["framing_json"] = dumps(fields.pop("framing"))
        if "config" in fields:
            fields["config_json"] = dumps(fields.pop("config"))
        async with self.sessions() as s:
            await s.execute(update(RunRow).where(RunRow.id == run_id).values(**fields))
            await s.commit()

    async def add_cost(self, run_id: str, cost: float) -> float:
        async with self.sessions() as s:
            row = await s.get(RunRow, run_id)
            assert row is not None
            row.total_cost_usd = round((row.total_cost_usd or 0.0) + cost, 4)
            row.updated_at = now_iso()
            await s.commit()
            return row.total_cost_usd

    # steps ------------------------------------------------------------------
    async def add_step(self, run_id: str, **fields: Any) -> int:
        row = StepRow(run_id=run_id, **fields)
        async with self.sessions() as s:
            s.add(row)
            await s.commit()
            return row.id

    async def update_step(self, step_id: int, **fields: Any) -> None:
        if "usage" in fields:
            fields["usage_json"] = dumps(fields.pop("usage"))
        async with self.sessions() as s:
            await s.execute(update(StepRow).where(StepRow.id == step_id).values(**fields))
            await s.commit()

    async def list_steps(self, run_id: str) -> list[StepRow]:
        async with self.sessions() as s:
            res = await s.execute(select(StepRow).where(StepRow.run_id == run_id).order_by(StepRow.id))
            return list(res.scalars().all())

    # artifacts --------------------------------------------------------------
    async def add_artifact(self, run_id: str, kind: str, seat: str, persona: str, payload: dict, key_insight: str | None, attempt: int = 1) -> ArtifactRow:
        row = ArtifactRow(
            id=new_id("art_"),
            run_id=run_id,
            kind=kind,
            seat=seat,
            persona=persona,
            attempt=attempt,
            created_at=now_iso(),
            key_insight=key_insight,
            payload_json=dumps(payload),
        )
        async with self.sessions() as s:
            s.add(row)
            await s.commit()
        return row

    async def list_artifacts(self, run_id: str) -> list[ArtifactRow]:
        async with self.sessions() as s:
            res = await s.execute(select(ArtifactRow).where(ArtifactRow.run_id == run_id).order_by(ArtifactRow.created_at, ArtifactRow.id))
            return list(res.scalars().all())

    async def latest_artifacts(self, run_id: str) -> dict[str, ArtifactRow]:
        latest: dict[str, ArtifactRow] = {}
        for row in await self.list_artifacts(run_id):
            latest[row.kind] = row  # ordered ascending, so the last write wins
        return latest

    # versions ---------------------------------------------------------------
    async def upsert_version(self, run_id: str, version: int, artifact_id: str, seat: str, persona: str, press_release: dict, edits: list[dict], caption: str | None) -> None:
        async with self.sessions() as s:
            res = await s.execute(select(VersionRow).where(VersionRow.run_id == run_id, VersionRow.version == version))
            row = res.scalar_one_or_none()
            if row is None:
                row = VersionRow(run_id=run_id, version=version)
                s.add(row)
            row.artifact_id = artifact_id
            row.produced_by_seat = seat
            row.persona = persona
            row.press_release_json = dumps(press_release)
            row.edits_json = dumps(edits)
            row.caption = caption
            await s.commit()

    async def list_versions(self, run_id: str) -> list[VersionRow]:
        async with self.sessions() as s:
            res = await s.execute(select(VersionRow).where(VersionRow.run_id == run_id).order_by(VersionRow.version))
            return list(res.scalars().all())

    # ledger -----------------------------------------------------------------
    async def replace_ledger(self, run_id: str, findings: list[dict], sources: list[dict]) -> None:
        async with self.sessions() as s:
            await s.execute(delete(FindingRow).where(FindingRow.run_id == run_id))
            await s.execute(delete(SourceRow).where(SourceRow.run_id == run_id))
            for f in findings:
                s.add(FindingRow(run_id=run_id, finding_id=f["id"], payload_json=dumps(f)))
            for src in sources:
                s.add(SourceRow(run_id=run_id, source_id=src["id"], payload_json=dumps(src)))
            await s.commit()

    async def list_ledger(self, run_id: str) -> tuple[list[dict], list[dict]]:
        async with self.sessions() as s:
            fr = await s.execute(select(FindingRow).where(FindingRow.run_id == run_id).order_by(FindingRow.finding_id))
            sr = await s.execute(select(SourceRow).where(SourceRow.run_id == run_id).order_by(SourceRow.source_id))
            return [json.loads(r.payload_json) for r in fr.scalars()], [json.loads(r.payload_json) for r in sr.scalars()]

    # events -----------------------------------------------------------------
    async def append_event(self, run_id: str, event_type: str, payload: dict) -> tuple[int, str]:
        """Assign the next seq for the run and persist. Callers serialise per run."""
        ts = now_iso()
        async with self.sessions() as s:
            res = await s.execute(select(func.max(EventRow.seq)).where(EventRow.run_id == run_id))
            seq = int(res.scalar() or 0) + 1
            s.add(EventRow(run_id=run_id, seq=seq, type=event_type, ts=ts, payload_json=dumps(payload)))
            await s.commit()
        return seq, ts

    async def list_events(self, run_id: str, after_seq: int = 0, limit: int | None = None) -> list[dict]:
        async with self.sessions() as s:
            q = select(EventRow).where(EventRow.run_id == run_id, EventRow.seq > after_seq).order_by(EventRow.seq)
            if limit:
                q = q.limit(limit)
            res = await s.execute(q)
            out = []
            for r in res.scalars():
                payload = json.loads(r.payload_json)
                payload.update({"seq": r.seq, "run_id": r.run_id, "ts": r.ts, "type": r.type})
                out.append(payload)
            return out

    async def last_seq(self, run_id: str) -> int:
        async with self.sessions() as s:
            res = await s.execute(select(func.max(EventRow.seq)).where(EventRow.run_id == run_id))
            return int(res.scalar() or 0)
