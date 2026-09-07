"""The council runner: framing gate, dependency-graph execution, persistence, events.

Design rules:
- Every event is persisted before it is published (replayable stream).
- A seat is one fresh request; retries are new requests with the error appended.
- Seats whose inputs exist run concurrently; to share the prompt cache, the second
  parallel seat starts once the first has begun streaming.
- The Bar Raiser loop runs at most once; the `bar_raiser` artifact only counts as
  complete after any revision it asked for has been applied.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any

from pydantic import ValidationError

from app.council.bus import EventBus
from app.council.dossier import build_prompt
from app.council.graph import council_graph, ready_seats, run_is_complete
from app.council.roster import PERSONAS
from app.council.seat import Seat, SeatContext
from app.council.seats import SEAT_BY_ID, seat as seat_by_id
from app.db.store import Store
from app.llm.citations import sources_from_citations
from app.llm.cost import estimate_cost_usd
from app.llm.provider import Provider
from app.llm.types import OutputTruncated, ProviderError, ProviderEvent, RefusalError, SeatRequest
from app.schemas import (
    ArtifactKind,
    BarRaiserOutput,
    DraftOutput,
    Edit,
    Framing,
    FramingFeedback,
    FramingOutput,
    Ledger,
    LedgerOutput,
    PressRelease,
    RefinementOutput,
    ResearchArtifact,
    SynthesisOutput,
    Usage,
    output_schema,
    reconcile_edits,
)
from app.schemas.framing import Brief
from app.settings import Settings

log = logging.getLogger(__name__)

PAYLOAD_MODELS: dict[str, type] = {
    "brief": Brief,
    "market_research": ResearchArtifact,
    "ledger": Ledger,
}


def parse_payload(kind: str, payload: dict) -> Any:
    """Parsed model for a stored artifact (used to rebuild the dossier)."""
    model = PAYLOAD_MODELS.get(kind)
    if model is None:
        producing_seat = next(s for s in SEAT_BY_ID.values() if s.produces == kind)
        model = producing_seat.output_model
    assert model is not None
    return model.model_validate(payload)


class DeltaBuffer:
    """Coalesces token deltas so the event log stays compact (one event per ~240 chars)."""

    def __init__(self, flush, limit: int = 240):
        self._flush = flush
        self._limit = limit
        self._buf: list[str] = []
        self._len = 0

    async def add(self, text: str) -> None:
        self._buf.append(text)
        self._len += len(text)
        if self._len >= self._limit:
            await self.flush()

    async def flush(self) -> None:
        if not self._buf:
            return
        text = "".join(self._buf)
        self._buf.clear()
        self._len = 0
        await self._flush(text)


@dataclass
class RunState:
    run_id: str
    task: asyncio.Task | None = None
    cancel: bool = False
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    budget_warned: bool = False


class CouncilRunner:
    def __init__(self, store: Store, provider: Provider, settings: Settings, bus: EventBus):
        self.store = store
        self.provider = provider
        self.settings = settings
        self.bus = bus
        self._runs: dict[str, RunState] = {}

    # events -----------------------------------------------------------------
    def _state(self, run_id: str) -> RunState:
        if run_id not in self._runs:
            self._runs[run_id] = RunState(run_id=run_id)
        return self._runs[run_id]

    async def emit(self, run_id: str, event_type: str, **payload: Any) -> dict:
        state = self._state(run_id)
        async with state.lock:
            seq, ts = await self.store.append_event(run_id, event_type, payload)
        event = dict(payload)
        event.update({"seq": seq, "run_id": run_id, "ts": ts, "type": event_type})
        await self.bus.publish(run_id, event)
        return event

    async def _set_status(self, run_id: str, status: str, **fields: Any) -> None:
        await self.store.update_run(run_id, status=status, **fields)
        await self.emit(run_id, "run.status", status=status)

    # public API -------------------------------------------------------------
    def run_config(self) -> dict[str, Any]:
        s = self.settings
        return {
            "models": {seat.id: seat.model(s) for seat in SEAT_BY_ID.values()},
            "efforts": {seat.id: seat.effort_for(s) for seat in SEAT_BY_ID.values()},
            "bar_raiser_enabled": s.bar_raiser_enabled,
            "parallel_validation_plan": s.parallel_validation_plan,
            "provider": s.llm_provider,
            "cost_ceiling_usd": s.run_cost_ceiling_usd,
            "bar_raiser_resolved": False,
        }

    async def create_run(self, idea: str) -> str:
        row = await self.store.create_run(idea=idea, config=self.run_config())
        await self.emit(row.id, "run.started", idea=idea)
        await self.emit(row.id, "run.status", status="framing")
        self._schedule(row.id, self._framing(row.id, attempt=1))
        return row.id

    async def refine_framing(self, run_id: str, feedback: FramingFeedback) -> None:
        run = await self.store.get_run(run_id)
        if run is None:
            raise KeyError(run_id)
        if run.status != "awaiting_confirmation":
            raise ValueError(f"run is {run.status}, not awaiting confirmation")
        previous = Framing.model_validate(json.loads(run.framing_json)) if run.framing_json else None
        attempts = len([s for s in await self.store.list_steps(run_id) if s.seat == "0"]) + 1
        await self._set_status(run_id, "framing")
        self._schedule(run_id, self._framing(run_id, attempt=attempts, feedback=feedback, previous=previous))

    async def confirm(self, run_id: str, framing_override: Framing | None) -> None:
        run = await self.store.get_run(run_id)
        if run is None:
            raise KeyError(run_id)
        if run.status != "awaiting_confirmation":
            raise ValueError(f"run is {run.status}, not awaiting confirmation")
        framing = framing_override or Framing.model_validate(json.loads(run.framing_json or "{}"))
        latest = await self.store.latest_artifacts(run_id)
        brief_row = latest.get("brief")
        if framing_override is not None or brief_row is None:
            brief = Brief(idea=run.idea, framing=framing, key_insight=None)
            await self.store.add_artifact(run_id, "brief", "0", "strategist", brief.model_dump(), None)
        await self.store.update_run(run_id, framing=framing.model_dump(), working_name=framing.working_name)
        await self._set_status(run_id, "running")
        self._schedule(run_id, self._council(run_id))

    async def cancel(self, run_id: str) -> None:
        state = self._state(run_id)
        state.cancel = True
        if state.task and not state.task.done():
            state.task.cancel()
            try:
                await state.task
            except (asyncio.CancelledError, Exception):
                pass
        run = await self.store.get_run(run_id)
        if run and run.status not in ("completed", "cancelled", "failed"):
            await self.store.update_run(run_id, status="cancelled")
            await self.emit(run_id, "run.cancelled")

    async def resume(self, run_id: str) -> None:
        run = await self.store.get_run(run_id)
        if run is None:
            raise KeyError(run_id)
        state = self._state(run_id)
        if state.task and not state.task.done():
            raise ValueError("run is already in progress")
        if run.status in ("completed",):
            raise ValueError("run is already complete")
        state.cancel = False
        if run.status in ("framing", "awaiting_confirmation") or run.framing_json is None:
            # framing never finished: run it again
            await self._set_status(run_id, "framing")
            self._schedule(run_id, self._framing(run_id, attempt=1))
            return
        await self._set_status(run_id, "running", error=None)
        self._schedule(run_id, self._council(run_id))

    def is_active(self, run_id: str) -> bool:
        state = self._runs.get(run_id)
        return bool(state and state.task and not state.task.done())

    async def shutdown(self) -> None:
        for state in self._runs.values():
            if state.task and not state.task.done():
                state.task.cancel()

    # scheduling -------------------------------------------------------------
    def _schedule(self, run_id: str, coro) -> None:
        state = self._state(run_id)
        state.cancel = False

        async def guarded():
            try:
                await coro
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001 - top-level guard for the run task
                log.exception("run %s failed", run_id)
                await self.store.update_run(run_id, status="failed", error=str(e))
                await self.emit(run_id, "run.failed", error=str(e))

        state.task = asyncio.create_task(guarded())

    # framing ----------------------------------------------------------------
    async def _framing(self, run_id: str, attempt: int, feedback: FramingFeedback | None = None, previous: Framing | None = None) -> None:
        run = await self.store.get_run(run_id)
        assert run is not None
        seat = seat_by_id("0")
        ctx = SeatContext(idea=run.idea, framing=previous, artifacts={}, settings=self.settings, attempt=attempt, feedback=feedback, previous_framing=previous)
        output = await self._execute_seat(run_id, seat, ctx, extra_context={"feedback": feedback.model_dump() if feedback else None})
        framing_out = FramingOutput.model_validate(output.parsed)
        brief = Brief(idea=run.idea, framing=framing_out.framing, key_insight=framing_out.key_insight)
        art = await self.store.add_artifact(run_id, "brief", "0", "strategist", brief.model_dump(), framing_out.key_insight, attempt=attempt)
        await self.store.update_run(run_id, framing=framing_out.framing.model_dump(), working_name=framing_out.framing.working_name)
        await self._complete_step(run_id, seat, output, art.id, "brief", framing_out.key_insight, attempt)
        # status first, so a client that reacts to framing.ready can confirm immediately
        await self.store.update_run(run_id, status="awaiting_confirmation")
        await self.emit(run_id, "framing.ready", framing=framing_out.framing.model_dump(), attempt=attempt, key_insight=framing_out.key_insight)
        await self.emit(run_id, "run.status", status="awaiting_confirmation")

    # council ----------------------------------------------------------------
    async def _load_artifacts(self, run_id: str) -> dict[str, Any]:
        latest = await self.store.latest_artifacts(run_id)
        return {kind: parse_payload(kind, json.loads(row.payload_json)) for kind, row in latest.items()}

    async def _council(self, run_id: str) -> None:
        run = await self.store.get_run(run_id)
        assert run is not None and run.framing_json is not None
        framing = Framing.model_validate(json.loads(run.framing_json))
        config = json.loads(run.config_json or "{}")
        state = self._state(run_id)
        graph = council_graph(self.settings)
        started = time.monotonic()

        artifacts = await self._load_artifacts(run_id)
        finished: set[str] = {s.id for s in SEAT_BY_ID.values() if s.id in graph and s.produces in artifacts}
        completed_kinds = set(artifacts.keys())
        # the Bar Raiser loop: the review only counts once its revision has been applied
        if "bar_raiser" in completed_kinds and not config.get("bar_raiser_resolved"):
            review: BarRaiserOutput = artifacts["bar_raiser"]
            if review.needs_revision():
                completed_kinds.discard("bar_raiser")
                finished.discard("9b")
            else:
                config["bar_raiser_resolved"] = True
                await self.store.update_run(run_id, config=config)

        running: dict[str, asyncio.Task] = {}
        pending_revision = False

        while True:
            if state.cancel:
                break
            ready = [] if pending_revision else ready_seats(graph, completed_kinds, finished, set(running))
            first_token: asyncio.Event | None = None
            for i, seat in enumerate(ready):
                if await self._over_budget(run_id):
                    raise RuntimeError(f"run cost reached the ceiling of ${self.settings.run_cost_ceiling_usd:.2f}")
                gate = first_token if i > 0 else None
                first_token = first_token or asyncio.Event()
                running[seat.id] = asyncio.create_task(
                    self._run_council_seat(run_id, seat, dict(artifacts), framing, gate_on=gate, signal_started=first_token if i == 0 else None)
                )
            if not running:
                break
            done, _ = await asyncio.wait(list(running.values()), return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                seat_id = next(sid for sid, t in running.items() if t is task)
                running.pop(seat_id)
                kind, payload = task.result()  # raises if the seat failed
                artifacts[kind] = payload
                completed_kinds.add(kind)
                if seat_id == "9b":
                    review = payload
                    if review.needs_revision() and not config.get("bar_raiser_resolved"):
                        # hold the review out of the completed set until the editor applies the fixes
                        completed_kinds.discard("bar_raiser")
                        pending_revision = True
                        revised = await self._run_council_seat(run_id, seat_by_id("9"), dict(artifacts), framing, attempt=2, bar_raiser_review=review)
                        artifacts["prfaq"] = revised[1]
                        pending_revision = False
                        completed_kinds.add("bar_raiser")
                    config["bar_raiser_resolved"] = True
                    await self.store.update_run(run_id, config=config)
                    finished.add("9b")
                else:
                    finished.add(seat_id)

        if state.cancel:
            return
        if not run_is_complete(graph, finished):
            raise RuntimeError("council stopped before every seat finished")

        latest = await self.store.latest_artifacts(run_id)
        review_row = latest.get("bar_raiser")
        review_payload = json.loads(review_row.payload_json) if review_row else None
        run = await self.store.get_run(run_id)
        assert run is not None
        await self.store.update_run(run_id, status="completed", completed_at=None)
        from app.db.store import now_iso

        await self.store.update_run(run_id, completed_at=now_iso())
        await self.emit(
            run_id,
            "run.completed",
            prfaq_artifact_id=latest["prfaq"].id,
            plan_artifact_id=latest["plan"].id,
            total_cost_usd=run.total_cost_usd,
            duration_s=round(time.monotonic() - started, 1),
            bar_raiser=review_payload,
        )
        await self.emit(run_id, "run.status", status="completed")

    async def _over_budget(self, run_id: str) -> bool:
        run = await self.store.get_run(run_id)
        assert run is not None
        ceiling = self.settings.run_cost_ceiling_usd
        state = self._state(run_id)
        if ceiling <= 0:
            return False
        if run.total_cost_usd >= 0.8 * ceiling and not state.budget_warned:
            state.budget_warned = True
            await self.emit(run_id, "run.budget_warning", spent_usd=run.total_cost_usd, ceiling_usd=ceiling)
        return run.total_cost_usd >= ceiling

    async def _run_council_seat(
        self,
        run_id: str,
        seat: Seat,
        artifacts: dict[str, Any],
        framing: Framing,
        *,
        attempt: int = 1,
        bar_raiser_review: BarRaiserOutput | None = None,
        gate_on: asyncio.Event | None = None,
        signal_started: asyncio.Event | None = None,
    ) -> tuple[str, Any]:
        if gate_on is not None:
            # share the cache prefix: wait until the sibling seat has begun streaming
            try:
                await asyncio.wait_for(gate_on.wait(), timeout=2.5)
            except asyncio.TimeoutError:
                pass
        run = await self.store.get_run(run_id)
        assert run is not None
        ctx = SeatContext(idea=run.idea, framing=framing, artifacts=artifacts, settings=self.settings, attempt=attempt, bar_raiser_review=bar_raiser_review)
        extra: dict[str, Any] = {}
        if seat.id == "1b":
            research: ResearchArtifact = artifacts["market_research"]
            sources = sources_from_citations(research.citations)
            ctx.artifacts["_sources"] = sources
            extra["source_ids"] = [s.id for s in sources]

        output = await self._execute_seat(run_id, seat, ctx, extra_context=extra, signal_started=signal_started)
        kind, payload, key_insight, version_info = await self._post_process(run_id, seat, ctx, output, attempt)
        art = await self.store.add_artifact(run_id, kind, seat.id, seat.persona, payload.model_dump(), key_insight, attempt=attempt)
        await self._complete_step(run_id, seat, output, art.id, kind, key_insight, attempt)
        if version_info is not None:
            version, pr, edits, caption = version_info
            await self.store.upsert_version(run_id, version, art.id, seat.id, seat.persona, pr.model_dump(), [e.model_dump() for e in edits], caption)
            await self.emit(run_id, "document.version", version=version, artifact_id=art.id, produced_by_seat=seat.id, persona=seat.persona, press_release=pr.model_dump(), edits=[e.model_dump() for e in edits], caption=caption)
            if version == 1:
                await self.store.update_run(run_id, headline=pr.text_of("headline"))
        return kind, payload

    # one seat, one request (plus bounded retries) ---------------------------
    async def _execute_seat(self, run_id: str, seat: Seat, ctx: SeatContext, *, extra_context: dict | None = None, signal_started: asyncio.Event | None = None):
        model = seat.model(self.settings)
        effort = seat.effort_for(self.settings)
        attempt = ctx.attempt
        step_id = await self.store.add_step(
            run_id,
            seat=seat.id,
            name=seat.name,
            persona=seat.persona,
            attempt=attempt,
            status="running",
            model=model,
            effort=effort,
            started_at=_now(),
        )
        await self.emit(run_id, "step.started", seat=seat.id, name=seat.name, persona=seat.persona, model=model, effort=effort, attempt=attempt, activity=list(seat.activity))
        t0 = time.monotonic()

        async def flush_delta(text: str) -> None:
            await self.emit(run_id, "step.delta", seat=seat.id, text=text)

        buffer = DeltaBuffer(flush_delta)

        async def on_event(ev: ProviderEvent) -> None:
            if signal_started is not None and not signal_started.is_set():
                signal_started.set()
            if ev.kind == "delta":
                await buffer.add(ev.text)
            elif ev.kind == "thinking":
                await buffer.flush()
                if ev.text:
                    event_type = "step.progress" if seat.uses_web else "step.thinking"
                    await self.emit(run_id, event_type, seat=seat.id, **({"note": ev.text} if seat.uses_web else {"text": ev.text}))
            elif ev.kind == "tool":
                await buffer.flush()
                await self.emit(run_id, "step.tool", seat=seat.id, kind=ev.tool_kind or "search", query=ev.query, url=ev.url)

        max_tokens = seat.max_tokens
        validation_error: str | None = None
        last_error: Exception | None = None
        for sub_attempt in range(1, 4):
            ctx.validation_error = validation_error
            prompt = build_prompt(seat, ctx)
            request = SeatRequest(
                seat_id=seat.id,
                model=model,
                effort=effort,
                max_tokens=max_tokens,
                system=prompt.system,
                messages=prompt.messages,
                output_schema=output_schema(seat.output_model) if seat.output_model else None,
                uses_web=seat.uses_web,
                web_search_max_uses=self.settings.web_search_max_uses,
                web_fetch_max_uses=self.settings.web_fetch_max_uses,
                thinking_display=self.settings.thinking_display,
                attempt=attempt,
                context={
                    "idea": ctx.idea,
                    "working_name": ctx.framing.working_name if ctx.framing else None,
                    "dossier_kinds": prompt.dossier_kinds,
                    **(extra_context or {}),
                },
            )
            try:
                outcome = await asyncio.wait_for(self.provider.run(request, on_event), timeout=self.settings.run_step_timeout_s)
                await buffer.flush()
                if seat.output_model is not None:
                    seat.output_model.model_validate(outcome.parsed)
                outcome.usage = outcome.usage or Usage()
                if signal_started is not None:
                    signal_started.set()
                return outcome
            except OutputTruncated as e:
                await buffer.flush()
                last_error = e
                if sub_attempt < 3 and max_tokens < 128000:
                    max_tokens = min(128000, max_tokens * 2)
                    await self.emit(run_id, "step.failed", seat=seat.id, error=f"{e}; retrying with max_tokens={max_tokens}", retryable=True, attempt=attempt)
                    continue
                break
            except ValidationError as e:
                await buffer.flush()
                last_error = e
                if sub_attempt <= self.settings.max_schema_retries:
                    validation_error = str(e)[:4000]
                    await self.emit(run_id, "step.failed", seat=seat.id, error="output did not match the schema; retrying with the validator message", retryable=True, attempt=attempt)
                    continue
                break
            except RefusalError as e:
                await buffer.flush()
                last_error = e
                break
            except asyncio.TimeoutError:
                await buffer.flush()
                last_error = ProviderError(f"seat {seat.id} exceeded {self.settings.run_step_timeout_s}s")
                break
            except ProviderError as e:
                await buffer.flush()
                last_error = e
                if sub_attempt < 3 and "rate limited" in str(e):
                    await asyncio.sleep(5 * sub_attempt)
                    continue
                break

        assert last_error is not None
        if signal_started is not None:
            signal_started.set()
        await self.store.update_step(step_id, status="failed", ended_at=_now(), duration_s=round(time.monotonic() - t0, 2), error=str(last_error))
        await self.emit(run_id, "step.failed", seat=seat.id, error=str(last_error), retryable=False, attempt=attempt)
        raise RuntimeError(f"seat {seat.id} ({seat.name}) failed: {last_error}")

    async def _complete_step(self, run_id: str, seat: Seat, outcome, artifact_id: str, kind: str, key_insight: str | None, attempt: int) -> None:
        steps = await self.store.list_steps(run_id)
        row = next((s for s in reversed(steps) if s.seat == seat.id and s.status == "running"), None)
        cost = estimate_cost_usd(outcome.model_served, outcome.usage)
        duration = None
        if row is not None:
            started = row.started_at
            duration = _seconds_since(started) if started else None
            await self.store.update_step(
                row.id,
                status="completed",
                ended_at=_now(),
                duration_s=duration,
                usage=outcome.usage.model_dump(),
                cost_usd=cost,
                fallback_used=outcome.fallback_used,
                key_insight=key_insight,
                model=outcome.model_served,
            )
        await self.store.add_cost(run_id, cost)
        await self.emit(
            run_id,
            "step.completed",
            seat=seat.id,
            artifact_id=artifact_id,
            kind=kind,
            key_insight=key_insight,
            usage=outcome.usage.model_dump(),
            duration_s=duration or 0.0,
            cost_usd=cost,
            model=outcome.model_served,
            fallback_used=outcome.fallback_used,
            attempt=attempt,
        )

    async def _post_process(self, run_id: str, seat: Seat, ctx: SeatContext, outcome, attempt: int):
        """Turn a seat's raw outcome into the artifact payload (plus version info for PR seats)."""
        kind: ArtifactKind = seat.produces
        ledger: Ledger | None = ctx.artifacts.get("ledger")
        known_findings = {f.id for f in ledger.findings} if ledger else set()

        if kind == "market_research":
            payload = ResearchArtifact(markdown=outcome.text, citations=outcome.citations, searches=outcome.usage.web_searches, fetches=0)
            return kind, payload, None, None

        if kind == "ledger":
            out = LedgerOutput.model_validate(outcome.parsed)
            sources = ctx.artifacts.get("_sources") or []
            source_ids = {s.id for s in sources}
            findings = [f.model_copy(update={"source_ids": [sid for sid in f.source_ids if sid in source_ids]}) for f in out.findings]
            payload = Ledger(findings=findings, sources=sources)
            await self.store.replace_ledger(run_id, [f.model_dump() for f in findings], [s.model_dump() for s in sources])
            return kind, payload, out.key_insight, None

        if kind == "pr_v1":
            out = DraftOutput.model_validate(outcome.parsed)
            pr = _scrub_claims(out.press_release, known_findings)
            out = out.model_copy(update={"press_release": pr})
            return kind, out, out.key_insight, (1, pr, [], None)

        if kind in ("pr_v2", "pr_v3"):
            out = RefinementOutput.model_validate(outcome.parsed)
            prev_kind = "pr_v1" if kind == "pr_v2" else "pr_v2"
            previous = _press_release_of(ctx.artifacts[prev_kind])
            pr = _scrub_claims(out.press_release, known_findings)
            edits = _scrub_edits(reconcile_edits(previous, pr, out.edits, f"Changed by the {PERSONAS[seat.persona].name} without a stated reason."), known_findings)
            out = out.model_copy(update={"press_release": pr, "edits": edits})
            return kind, out, out.key_insight, (2 if kind == "pr_v2" else 3, pr, edits, out.summary_of_changes)

        if kind == "prfaq":
            out = SynthesisOutput.model_validate(outcome.parsed)
            previous = _press_release_of(ctx.artifacts["pr_v3"])
            pr = _scrub_claims(out.press_release, known_findings)
            edits = _scrub_edits(reconcile_edits(previous, pr, out.edits, "Editorial polish."), known_findings)
            out = out.model_copy(update={"press_release": pr, "edits": edits})
            await self.store.update_run(run_id, headline=pr.text_of("headline"))
            caption = out.summary_of_changes if attempt == 1 else f"{out.summary_of_changes} (Bar Raiser revision)"
            return kind, out, out.key_insight, (4, pr, edits, caption)

        assert seat.output_model is not None
        out = seat.output_model.model_validate(outcome.parsed)
        return kind, out, getattr(out, "key_insight", None), None


def _press_release_of(payload: Any) -> PressRelease:
    return payload.press_release


def _scrub_claims(pr: PressRelease, known: set[str]) -> PressRelease:
    """Drop finding ids the ledger does not contain; a claim with none left becomes an assumption."""
    slots = []
    for s in pr.slots:
        claims = []
        for c in s.claims:
            ids = [i for i in c.finding_ids if i in known]
            kind = c.kind if ids or c.kind == "assumption" else "assumption"
            claims.append(c.model_copy(update={"finding_ids": ids, "kind": kind}))
        slots.append(s.model_copy(update={"claims": claims}))
    return PressRelease(slots=slots)


def _scrub_edits(edits: list[Edit], known: set[str]) -> list[Edit]:
    return [e.model_copy(update={"evidence_finding_ids": [i for i in e.evidence_finding_ids if i in known]}) for e in edits]


def _now() -> str:
    from app.db.store import now_iso

    return now_iso()


def _seconds_since(iso: str) -> float:
    from datetime import datetime

    try:
        started = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        from datetime import timezone

        return round((datetime.now(timezone.utc) - started).total_seconds(), 2)
    except ValueError:
        return 0.0
