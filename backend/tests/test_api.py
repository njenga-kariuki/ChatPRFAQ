import asyncio
import json

import pytest

from tests.conftest import wait_for_status


async def _read_sse(client, url, stop_at=("end",), max_events=5000):
    events = []
    async with client.stream("GET", url) as resp:
        assert resp.status_code == 200
        assert resp.headers["content-type"].startswith("text/event-stream")
        buffer = ""
        async for chunk in resp.aiter_text():
            buffer += chunk
            while "\n\n" in buffer:
                frame, buffer = buffer.split("\n\n", 1)
                if frame.startswith(":"):
                    continue
                fields = dict(line.split(": ", 1) for line in frame.split("\n") if ": " in line)
                events.append(fields)
                if fields.get("event") in stop_at or len(events) >= max_events:
                    return events
    return events


@pytest.mark.asyncio
async def test_health(client):
    r = await client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] and body["provider"] == "fake" and body["models"]["judgment"] == "claude-fable-5-1"


@pytest.mark.asyncio
async def test_create_confirm_stream_snapshot_and_export(client):
    r = await client.post("/api/runs", json={"idea": "A bookkeeping service that closes the books for independent restaurants every month"})
    assert r.status_code == 200
    run_id = r.json()["run_id"]

    snap = await wait_for_status(client, run_id, "awaiting_confirmation")
    assert snap["run"]["framing"]["working_name"]
    assert snap["roster"] and snap["seats"]

    r = await client.post(f"/api/runs/{run_id}/framing/confirm", json={})
    assert r.status_code == 202
    snap = await wait_for_status(client, run_id, "completed", timeout=60)
    assert [v["version"] for v in snap["versions"]] == [1, 2, 3, 4]
    assert snap["findings"] and snap["sources"]
    assert snap["bar_raiser"]["verdict"] in ("pass", "revise")
    assert snap["last_seq"] > 100

    # replay from the beginning ends with the terminal event and an `end` frame
    events = await _read_sse(client, f"/api/runs/{run_id}/events")
    types = [e.get("event") for e in events]
    assert types[0] == "run.started"
    assert "framing.ready" in types and "document.version" in types
    assert types[-2] == "run.status" and types[-1] == "end"
    # replay from the middle returns only later sequence numbers
    mid = int(events[len(events) // 2]["id"])
    tail = await _read_sse(client, f"/api/runs/{run_id}/events?after={mid}")
    assert all(int(e["id"]) > mid for e in tail if "id" in e)
    # Last-Event-ID header works the same way
    async with client.stream("GET", f"/api/runs/{run_id}/events", headers={"Last-Event-ID": str(snap["last_seq"])}) as resp:
        text = "".join([c async for c in resp.aiter_text()])
    assert "event: end" in text and "run.started" not in text

    # exports
    md = await client.get(f"/api/runs/{run_id}/export?format=md")
    assert md.status_code == 200 and "### **Press Release**" in md.text and "**Question:**" in md.text
    red = await client.get(f"/api/runs/{run_id}/export?format=redline&from_version=1&to_version=4")
    assert red.status_code == 200 and "{++" in red.text and "{>>" in red.text
    plan = await client.get(f"/api/runs/{run_id}/export?format=plan")
    assert "Hypotheses" in plan.text
    js = await client.get(f"/api/runs/{run_id}/export?format=json")
    assert js.json()["run"]["id"] == run_id

    # history and sharing
    lst = await client.get("/api/runs")
    assert lst.status_code == 200 and lst.json()["runs"][0]["id"] == run_id
    token = snap["run"]["share_token"]
    shared = await client.get(f"/api/share/{token}")
    assert shared.status_code == 200 and shared.json()["run"]["share_token"] is None


@pytest.mark.asyncio
async def test_refine_endpoint_and_conflicts(client):
    r = await client.post("/api/runs", json={"idea": "A marketplace for renting professional cameras by the day"})
    run_id = r.json()["run_id"]
    await wait_for_status(client, run_id, "awaiting_confirmation")
    r = await client.post(f"/api/runs/{run_id}/framing/refine", json={"target_customer": "Wedding photographers only"})
    assert r.status_code == 202
    snap = await wait_for_status(client, run_id, "awaiting_confirmation")
    assert "Wedding photographers" in snap["run"]["framing"]["target_customer"]
    assert len([s for s in snap["steps"] if s["seat"] == "0"]) == 2
    r = await client.post(f"/api/runs/{run_id}/framing/confirm", json={})
    assert r.status_code == 202
    r = await client.post(f"/api/runs/{run_id}/framing/confirm", json={})
    assert r.status_code == 409
    await wait_for_status(client, run_id, "completed", timeout=60)


@pytest.mark.asyncio
async def test_validation_and_404s(client):
    assert (await client.post("/api/runs", json={"idea": "short"})).status_code == 422
    assert (await client.get("/api/runs/run_missing")).status_code == 404
    assert (await client.get("/api/runs/run_missing/events")).status_code == 404
    assert (await client.post("/api/runs/run_missing/framing/confirm", json={})).status_code == 404


@pytest.mark.asyncio
async def test_owner_token_guards_mutations(settings):
    from app.main import create_app
    import httpx

    settings.owner_token = "secret"
    application = create_app(settings)
    async with application.router.lifespan_context(application):
        transport = httpx.ASGITransport(app=application)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
            assert (await c.post("/api/runs", json={"idea": "An idea long enough to pass validation"})).status_code == 401
            r = await c.post("/api/runs", json={"idea": "An idea long enough to pass validation"}, headers={"Authorization": "Bearer secret"})
            assert r.status_code == 200
            run_id = r.json()["run_id"]
            assert (await c.get(f"/api/runs/{run_id}")).status_code == 200  # reads stay open
            await asyncio.sleep(0.3)
