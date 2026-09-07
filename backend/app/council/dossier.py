"""The append-only dossier: how a seat's prompt is assembled.

Two invariants make prompt caching work across the run:

1. `system` is the frozen charter, byte-identical for every seat, cached for an hour.
2. The user message is a list of artifact blocks in CANONICAL_ORDER followed by the
   task block. Because artifacts only accumulate and the order never changes, seat
   N+1's prompt is seat N's prompt plus new blocks, so the 5-minute cache marker on
   the last artifact block turns the whole prior dossier into a cache read.

Nothing here may introduce a timestamp, id, or per-run value into a block.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field

from app.council.charter import charter_text
from app.council.render import render_artifact
from app.council.roster import PERSONAS
from app.council.seat import Seat, SeatContext
from app.schemas.events import ArtifactKind

CANONICAL_ORDER: tuple[ArtifactKind, ...] = (
    "brief",
    "market_research",
    "ledger",
    "problem_validation",
    "pr_v1",
    "pr_v2",
    "internal_faq",
    "concept_validation",
    "pr_v3",
    "external_faq",
    "prfaq",
    "bar_raiser",
    "plan",
)

PRODUCER: dict[ArtifactKind, tuple[str, str]] = {
    "brief": ("0", "strategist"),
    "market_research": ("1", "analyst"),
    "ledger": ("1b", "analyst"),
    "problem_validation": ("2", "researcher"),
    "pr_v1": ("3", "pm"),
    "pr_v2": ("4", "vp_product"),
    "internal_faq": ("5", "biz_eng"),
    "concept_validation": ("6", "researcher"),
    "pr_v3": ("7", "pm"),
    "external_faq": ("8", "customer_success"),
    "prfaq": ("9", "editor"),
    "bar_raiser": ("9b", "bar_raiser"),
    "plan": ("10", "validation_lead"),
}

SYSTEM_CACHE = {"type": "ephemeral", "ttl": "1h"}
DOSSIER_CACHE = {"type": "ephemeral"}


@dataclass
class Prompt:
    system: list[dict]
    messages: list[dict]
    task_text: str
    dossier_kinds: list[str] = field(default_factory=list)

    @property
    def content_blocks(self) -> list[dict]:
        return self.messages[0]["content"]

    def prefix_fingerprint(self) -> str:
        """Hash of everything before the task block, with cache markers stripped.

        Two consecutive seats' prompts must share this prefix for caching to work; the
        tests assert it.
        """
        blocks = []
        for b in self.content_blocks[:-1]:
            blocks.append({k: v for k, v in b.items() if k != "cache_control"})
        system = [{k: v for k, v in s.items() if k != "cache_control"} for s in self.system]
        raw = json.dumps({"system": system, "blocks": blocks}, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def approx_tokens(self) -> int:
        chars = sum(len(s["text"]) for s in self.system) + sum(len(b["text"]) for b in self.content_blocks)
        return chars // 4


def artifact_block(kind: ArtifactKind, payload, *, idea: str = "") -> str:
    seat_id, persona_id = PRODUCER[kind]
    persona = PERSONAS[persona_id].name
    body = render_artifact(kind, payload, idea=idea)
    return f'<artifact kind="{kind}" seat="{seat_id}" author="{persona}">\n{body}\n</artifact>'


def build_prompt(seat: Seat, ctx: SeatContext, *, cache: bool = True) -> Prompt:
    system_block: dict = {"type": "text", "text": charter_text()}
    if cache:
        system_block["cache_control"] = dict(SYSTEM_CACHE)

    blocks: list[dict] = []
    kinds: list[str] = []
    for kind in CANONICAL_ORDER:
        payload = ctx.artifacts.get(kind)
        if payload is None:
            continue
        blocks.append({"type": "text", "text": artifact_block(kind, payload, idea=ctx.idea)})
        kinds.append(kind)

    if blocks and cache:
        blocks[-1]["cache_control"] = dict(DOSSIER_CACHE)

    task_text = seat.task(ctx)
    if blocks:
        task_text = "The dossier above is complete up to your seat.\n\n" + task_text
    blocks.append({"type": "text", "text": task_text})

    return Prompt(
        system=[system_block],
        messages=[{"role": "user", "content": blocks}],
        task_text=task_text,
        dossier_kinds=kinds,
    )
