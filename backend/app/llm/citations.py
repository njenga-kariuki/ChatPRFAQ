"""Turn the citations the research tools attach into ledger sources with stable ids."""

from __future__ import annotations

from urllib.parse import urlsplit, urlunsplit

from app.schemas.research import Citation, Source


def _normalise(url: str) -> str:
    parts = urlsplit(url.strip())
    path = parts.path.rstrip("/") or "/"
    return urlunsplit((parts.scheme.lower(), parts.netloc.lower(), path, parts.query, ""))


def sources_from_citations(citations: list[Citation]) -> list[Source]:
    seen: dict[str, Source] = {}
    order: list[str] = []
    for c in citations:
        if not c.url:
            continue
        key = _normalise(c.url)
        if key in seen:
            existing = seen[key]
            if len(c.cited_text) > len(existing.cited_text):
                seen[key] = existing.model_copy(update={"cited_text": c.cited_text})
            continue
        order.append(key)
        seen[key] = Source(id="", url=c.url, title=c.title or c.url, cited_text=c.cited_text)
    return [seen[k].model_copy(update={"id": f"S-{i:02d}"}) for i, k in enumerate(order, 1)]
