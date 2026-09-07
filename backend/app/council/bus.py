"""In-process fan-out of run events to SSE subscribers."""

from __future__ import annotations

import asyncio
from collections import defaultdict


class EventBus:
    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue]] = defaultdict(set)

    def subscribe(self, run_id: str) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        self._subs[run_id].add(q)
        return q

    def unsubscribe(self, run_id: str, q: asyncio.Queue) -> None:
        self._subs[run_id].discard(q)
        if not self._subs[run_id]:
            self._subs.pop(run_id, None)

    async def publish(self, run_id: str, event: dict) -> None:
        for q in list(self._subs.get(run_id, ())):
            q.put_nowait(event)

    def subscriber_count(self, run_id: str) -> int:
        return len(self._subs.get(run_id, ()))
