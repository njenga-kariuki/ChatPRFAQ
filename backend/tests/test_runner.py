import asyncio
import json

import pytest

from app.council.bus import EventBus
from app.council.runner import CouncilRunner
from app.db.store import Store
from app.llm.provider import build_provider
from app.schemas.framing import Framing, FramingFeedback


async def _runner(settings):
    store = Store(settings.database_url)
    await store.init()
    bus = EventBus()
    return store, bus, CouncilRunner(store, build_provider(settings), settings, bus)


async def _wait_for(bus_queue, event_type, timeout=30):
    while True:
        ev = await asyncio.wait_for(bus_queue.get(), timeout)
        if ev["type"] == event_type:
            return ev
        if ev["type"] == "run.failed":
            raise AssertionError(ev["error"])


@pytest.mark.asyncio
async def test_full_run_produces_four_versions_and_a_ledger(settings):
    store, bus, runner = await _runner(settings)
    run_id = await runner.create_run("A bookkeeping service that closes the books for independent restaurants every month")
    q = bus.subscribe(run_id)
    framing = await _wait_for(q, "framing.ready")
    assert framing["framing"]["working_name"]
    await runner.confirm(run_id, None)
    done = await _wait_for(q, "run.completed")
    assert done["total_cost_usd"] > 0

    versions = await store.list_versions(run_id)
    assert [v.version for v in versions] == [1, 2, 3, 4]
    v2 = json.loads(versions[1].edits_json)
    assert v2 and all(e["rationale"] for e in v2)
    findings, sources = await store.list_ledger(run_id)
    assert len(findings) >= 10 and len(sources) >= 3
    kinds = set((await store.latest_artifacts(run_id)).keys())
    assert {"brief", "market_research", "ledger", "problem_validation", "pr_v1", "pr_v2", "internal_faq", "concept_validation", "pr_v3", "external_faq", "prfaq", "bar_raiser", "plan"} <= kinds
    steps = await store.list_steps(run_id)
    assert [(s.seat, s.attempt) for s in steps if s.seat == "9"] == [("9", 1), ("9", 2)]  # the Bar Raiser asked for a revision
    events = await store.list_events(run_id)
    assert [e["seq"] for e in events] == list(range(1, len(events) + 1))
    assert (await store.get_run(run_id)).status == "completed"
    await store.close()


@pytest.mark.asyncio
async def test_refine_then_confirm_with_override(settings):
    store, bus, runner = await _runner(settings)
    run_id = await runner.create_run("A marketplace for renting professional cameras by the day")
    q = bus.subscribe(run_id)
    await _wait_for(q, "framing.ready")
    await runner.refine_framing(run_id, FramingFeedback(target_customer="Wedding photographers only"))
    second = await _wait_for(q, "framing.ready")
    assert second["attempt"] == 2
    assert "Wedding photographers" in second["framing"]["target_customer"]
    override = Framing(**{**second["framing"], "working_name": "LensLoop"})
    await runner.confirm(run_id, override)
    await _wait_for(q, "run.completed")
    run = await store.get_run(run_id)
    assert run.working_name == "LensLoop"
    latest = await store.latest_artifacts(run_id)
    assert json.loads(latest["brief"].payload_json)["framing"]["working_name"] == "LensLoop"
    await store.close()


@pytest.mark.asyncio
async def test_cancel_and_resume_continues_from_completed_seats(settings):
    settings.fake_stream_delay_s = 0.01
    store, bus, runner = await _runner(settings)
    run_id = await runner.create_run("A subscription for freshly roasted coffee delivered to small offices")
    q = bus.subscribe(run_id)
    await _wait_for(q, "framing.ready")
    await runner.confirm(run_id, None)
    # let a few seats finish, then cancel
    for _ in range(3):
        await _wait_for(q, "step.completed")
    await runner.cancel(run_id)
    assert (await store.get_run(run_id)).status == "cancelled"
    finished_before = {s.seat for s in await store.list_steps(run_id) if s.status == "completed"}
    assert "1" in finished_before

    await runner.resume(run_id)
    await _wait_for(q, "run.completed", timeout=60)
    steps = await store.list_steps(run_id)
    seat1_runs = [s for s in steps if s.seat == "1" and s.status == "completed"]
    assert len(seat1_runs) == 1  # research was not repeated
    assert (await store.get_run(run_id)).status == "completed"
    await store.close()
