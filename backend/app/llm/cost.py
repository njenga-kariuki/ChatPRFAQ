from __future__ import annotations

from app.schemas.events import Usage
from app.settings import MODEL_PRICES, WEB_SEARCH_PRICE_USD


def estimate_cost_usd(model: str, usage: Usage) -> float:
    prices = MODEL_PRICES.get(model)
    if prices is None:
        # unknown model: price it like Opus so cost is never silently zero
        prices = MODEL_PRICES["claude-opus-5"]
    inp, cache_write, cache_read, out = prices
    total = (
        usage.input_tokens * inp
        + usage.cache_creation_input_tokens * cache_write
        + usage.cache_read_input_tokens * cache_read
        + usage.output_tokens * out
    ) / 1_000_000
    total += usage.web_searches * WEB_SEARCH_PRICE_USD
    return round(total, 4)
