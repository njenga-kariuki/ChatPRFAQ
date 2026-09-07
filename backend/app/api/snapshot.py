"""Build the RunSnapshot the frontend loads on first paint."""

from __future__ import annotations

import json

from app.council.roster import ROSTER
from app.council.seats import SEATS
from app.db.models import RunRow
from app.db.store import Store
from app.schemas import BarRaiserOutput, Finding, Source, Usage
from app.schemas.run import ArtifactRecord, PersonaRecord, RunRecord, RunSnapshot, SeatRecord, StepRecord, VersionRecord


def run_record(row: RunRow) -> RunRecord:
    return RunRecord(
        id=row.id,
        idea=row.idea,
        status=row.status,  # type: ignore[arg-type]
        framing=json.loads(row.framing_json) if row.framing_json else None,
        created_at=row.created_at,
        updated_at=row.updated_at,
        completed_at=row.completed_at,
        total_cost_usd=row.total_cost_usd or 0.0,
        error=row.error,
        config=json.loads(row.config_json or "{}"),
        share_token=row.share_token,
        headline=row.headline,
    )


def roster_records() -> list[PersonaRecord]:
    return [PersonaRecord(id=p.id, name=p.name, title=p.title, initials=p.initials, hue=p.hue, seats=list(p.seats), how_i_review=p.how_i_review) for p in ROSTER]


def seat_records() -> list[SeatRecord]:
    return [SeatRecord(id=s.id, name=s.name, persona=s.persona, produces=s.produces, depends_on=list(s.depends_on), phase=s.phase, tier=s.tier) for s in SEATS]


async def build_snapshot(store: Store, row: RunRow, *, include_share_token: bool = True) -> RunSnapshot:
    steps = await store.list_steps(row.id)
    artifacts = await store.list_artifacts(row.id)
    versions = await store.list_versions(row.id)
    findings, sources = await store.list_ledger(row.id)
    review = None
    for a in artifacts:
        if a.kind == "bar_raiser":
            review = BarRaiserOutput.model_validate(json.loads(a.payload_json))
    record = run_record(row)
    if not include_share_token:
        record = record.model_copy(update={"share_token": None})
    return RunSnapshot(
        run=record,
        steps=[
            StepRecord(
                seat=s.seat,  # type: ignore[arg-type]
                name=s.name,
                persona=s.persona,  # type: ignore[arg-type]
                attempt=s.attempt,
                status=s.status,
                model=s.model,
                effort=s.effort,
                started_at=s.started_at,
                ended_at=s.ended_at,
                duration_s=s.duration_s,
                usage=Usage.model_validate(json.loads(s.usage_json or "{}")),
                cost_usd=s.cost_usd or 0.0,
                fallback_used=bool(s.fallback_used),
                error=s.error,
                key_insight=s.key_insight,
            )
            for s in steps
        ],
        artifacts=[
            ArtifactRecord(id=a.id, kind=a.kind, seat=a.seat, persona=a.persona, created_at=a.created_at, key_insight=a.key_insight, payload=json.loads(a.payload_json))  # type: ignore[arg-type]
            for a in artifacts
        ],
        versions=[
            VersionRecord(
                version=v.version,
                artifact_id=v.artifact_id,
                produced_by_seat=v.produced_by_seat,  # type: ignore[arg-type]
                persona=v.persona,  # type: ignore[arg-type]
                press_release=json.loads(v.press_release_json),
                edits=json.loads(v.edits_json or "[]"),
                caption=v.caption,
            )
            for v in versions
        ],
        findings=[Finding.model_validate(f) for f in findings],
        sources=[Source.model_validate(s) for s in sources],
        bar_raiser=review,
        last_seq=await store.last_seq(row.id),
        roster=roster_records(),
        seats=seat_records(),
    )
