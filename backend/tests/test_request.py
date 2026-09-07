from app.llm.anthropic_provider import FALLBACK_BETA, WEB_FETCH_TOOL, WEB_SEARCH_TOOL, build_request_kwargs
from app.llm.cost import estimate_cost_usd
from app.llm.types import SeatRequest
from app.schemas import ExternalFAQOutput, Usage, output_schema
from app.settings import Settings

SYSTEM = [{"type": "text", "text": "charter", "cache_control": {"type": "ephemeral", "ttl": "1h"}}]
MESSAGES = [{"role": "user", "content": [{"type": "text", "text": "task"}]}]


def _req(**overrides):
    base = dict(seat_id="8", model="claude-fable-5-1", effort="high", max_tokens=16000, system=SYSTEM, messages=MESSAGES, output_schema=None, uses_web=False)
    base.update(overrides)
    return SeatRequest(**base)


def test_current_model_request_has_no_legacy_parameters():
    kwargs = build_request_kwargs(_req(output_schema=output_schema(ExternalFAQOutput)), Settings(llm_provider="fake", _env_file=None))
    for forbidden in ("temperature", "top_p", "top_k", "budget_tokens", "tool_choice"):
        assert forbidden not in kwargs
    assert kwargs["thinking"] == {"type": "adaptive", "display": "summarized"}
    assert kwargs["output_config"]["effort"] == "high"
    assert kwargs["output_config"]["format"]["type"] == "json_schema"
    assert kwargs["output_config"]["format"]["schema"]["additionalProperties"] is False


def test_fallbacks_only_on_models_that_support_them():
    settings = Settings(llm_provider="fake", _env_file=None)
    fable = build_request_kwargs(_req(model="claude-fable-5-1"), settings)
    assert fable["betas"] == [FALLBACK_BETA] and fable["fallbacks"] == "default"
    sonnet = build_request_kwargs(_req(model="claude-sonnet-5"), settings)
    assert "betas" not in sonnet and "fallbacks" not in sonnet
    off = build_request_kwargs(_req(model="claude-fable-5-1"), Settings(llm_provider="fake", enable_fallbacks=False, _env_file=None))
    assert "betas" not in off


def test_research_seat_declares_server_tools_and_no_format():
    kwargs = build_request_kwargs(_req(seat_id="1", uses_web=True, web_search_max_uses=7, web_fetch_max_uses=3), Settings(llm_provider="fake", _env_file=None))
    assert [t["type"] for t in kwargs["tools"]] == [WEB_SEARCH_TOOL, WEB_FETCH_TOOL]
    assert kwargs["tools"][0]["max_uses"] == 7 and kwargs["tools"][1]["max_uses"] == 3
    assert "format" not in kwargs["output_config"]


def test_cost_estimate_uses_cache_read_rate():
    usage = Usage(input_tokens=1000, cache_read_input_tokens=100_000, output_tokens=2000, web_searches=3)
    cost = estimate_cost_usd("claude-fable-5-1", usage)
    # 1000*10 + 100000*0.25 + 2000*50 = 0.01 + 0.025 + 0.1 per million... plus 3 searches
    assert abs(cost - (0.01 + 0.025 + 0.1 + 0.03)) < 1e-6
