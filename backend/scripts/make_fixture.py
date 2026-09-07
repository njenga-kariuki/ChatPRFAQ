"""Record a complete fake run as a fixture: snapshot JSON plus the event log as JSONL.

    python scripts/make_fixture.py ../web/fixtures

The frontend uses these to render every screen without a backend (tests, Storybook-style
development, the demo route).
"""

from __future__ import annotations

import os as _os
import sys as _sys

_sys.path.insert(0, _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))))

import asyncio
import json
import os
import sys
import tempfile

from app.api.snapshot import build_snapshot
from app.council.bus import EventBus
from app.council.runner import CouncilRunner
from app.db.store import Store
from app.llm.provider import build_provider
from app.settings import Settings

IDEA = "A bookkeeping service that closes the books for independent restaurants every month, with a reviewed close and a short exception list the owner clears from a phone."


async def main(out_dir: str) -> None:
    os.makedirs(out_dir, exist_ok=True)
    tmp = tempfile.mkdtemp()
    settings = Settings(llm_provider="fake", database_url=f"sqlite+aiosqlite:///{tmp}/fixture.db", _env_file=None)
    store = Store(settings.database_url)
    await store.init()
    bus = EventBus()
    runner = CouncilRunner(store, build_provider(settings), settings, bus)
    run_id = await runner.create_run(IDEA)
    q = bus.subscribe(run_id)
    while (await q.get())["type"] != "framing.ready":
        pass
    await runner.confirm(run_id, None)
    while (await q.get())["type"] != "run.completed":
        pass
    await asyncio.sleep(0.05)
    row = await store.get_run(run_id)
    snapshot = await build_snapshot(store, row)
    with open(os.path.join(out_dir, "run.snapshot.json"), "w", encoding="utf-8") as f:
        json.dump(snapshot.model_dump(), f, indent=2, ensure_ascii=False)
    events = await store.list_events(run_id)
    with open(os.path.join(out_dir, "run.events.jsonl"), "w", encoding="utf-8") as f:
        for e in events:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
    print(f"wrote {out_dir}/run.snapshot.json ({len(snapshot.artifacts)} artifacts, {len(snapshot.versions)} versions) and run.events.jsonl ({len(events)} events)")
    await store.close()


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "fixtures"))
