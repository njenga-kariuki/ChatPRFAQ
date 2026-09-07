from __future__ import annotations

from sqlalchemy import Boolean, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class RunRow(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    idea: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), index=True)
    framing_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[str] = mapped_column(String(40), index=True)
    updated_at: Mapped[str] = mapped_column(String(40))
    completed_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    config_json: Mapped[str] = mapped_column(Text, default="{}")
    share_token: Mapped[str | None] = mapped_column(String(48), nullable=True, index=True)
    headline: Mapped[str | None] = mapped_column(Text, nullable=True)
    working_name: Mapped[str | None] = mapped_column(String(120), nullable=True)


class StepRow(Base):
    __tablename__ = "steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(32), ForeignKey("runs.id"), index=True)
    seat: Mapped[str] = mapped_column(String(4))
    name: Mapped[str] = mapped_column(String(80))
    persona: Mapped[str] = mapped_column(String(32))
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(16))
    model: Mapped[str] = mapped_column(String(64))
    effort: Mapped[str] = mapped_column(String(16))
    started_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    ended_at: Mapped[str | None] = mapped_column(String(40), nullable=True)
    duration_s: Mapped[float | None] = mapped_column(Float, nullable=True)
    usage_json: Mapped[str] = mapped_column(Text, default="{}")
    cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    fallback_used: Mapped[bool] = mapped_column(Boolean, default=False)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    key_insight: Mapped[str | None] = mapped_column(Text, nullable=True)


class ArtifactRow(Base):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    run_id: Mapped[str] = mapped_column(String(32), ForeignKey("runs.id"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    seat: Mapped[str] = mapped_column(String(4))
    persona: Mapped[str] = mapped_column(String(32))
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[str] = mapped_column(String(40))
    key_insight: Mapped[str | None] = mapped_column(Text, nullable=True)
    payload_json: Mapped[str] = mapped_column(Text)


class VersionRow(Base):
    __tablename__ = "document_versions"
    __table_args__ = (UniqueConstraint("run_id", "version", name="uq_run_version"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(32), ForeignKey("runs.id"), index=True)
    version: Mapped[int] = mapped_column(Integer)
    artifact_id: Mapped[str] = mapped_column(String(32))
    produced_by_seat: Mapped[str] = mapped_column(String(4))
    persona: Mapped[str] = mapped_column(String(32))
    press_release_json: Mapped[str] = mapped_column(Text)
    edits_json: Mapped[str] = mapped_column(Text, default="[]")
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)


class FindingRow(Base):
    __tablename__ = "findings"
    __table_args__ = (UniqueConstraint("run_id", "finding_id", name="uq_run_finding"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(32), ForeignKey("runs.id"), index=True)
    finding_id: Mapped[str] = mapped_column(String(8))
    payload_json: Mapped[str] = mapped_column(Text)


class SourceRow(Base):
    __tablename__ = "sources"
    __table_args__ = (UniqueConstraint("run_id", "source_id", name="uq_run_source"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(32), ForeignKey("runs.id"), index=True)
    source_id: Mapped[str] = mapped_column(String(8))
    payload_json: Mapped[str] = mapped_column(Text)


class EventRow(Base):
    __tablename__ = "events"
    __table_args__ = (UniqueConstraint("run_id", "seq", name="uq_run_seq"), Index("ix_events_run_seq", "run_id", "seq"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[str] = mapped_column(String(32), ForeignKey("runs.id"))
    seq: Mapped[int] = mapped_column(Integer)
    type: Mapped[str] = mapped_column(String(32))
    ts: Mapped[str] = mapped_column(String(40))
    payload_json: Mapped[str] = mapped_column(Text)
