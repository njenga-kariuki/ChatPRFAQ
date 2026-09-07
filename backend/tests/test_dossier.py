import re

from app.council.charter import charter_text
from app.council.dossier import CANONICAL_ORDER, build_prompt
from app.council.seat import SeatContext
from app.council.seats import SEATS, seat
from app.llm import fake_content as fc
from app.llm.citations import sources_from_citations
from app.schemas import Citation, DraftOutput, Framing, Ledger, LedgerOutput, ProblemValidationOutput, RefinementOutput, ResearchArtifact
from app.schemas.framing import Brief
from app.settings import Settings


def _artifacts():
    name = "Ledgerly"
    framing = Framing(working_name=name, target_customer="c", customer_problem="p", product_scope="s")
    citations = [Citation(**c) for c in fc.research_citations()]
    sources = sources_from_citations(citations)
    return framing, {
        "brief": Brief(idea="idea", framing=framing, key_insight=None),
        "market_research": ResearchArtifact(markdown=fc.research_markdown(name), citations=citations, searches=3, fetches=1),
        "ledger": Ledger(findings=LedgerOutput.model_validate(fc.ledger(name, [s.id for s in sources])).findings, sources=sources),
        "problem_validation": ProblemValidationOutput.model_validate(fc.problem_validation(name)),
        "pr_v1": DraftOutput.model_validate(fc.draft(name)),
        "pr_v2": RefinementOutput.model_validate(fc.refinement(name, 2)),
    }


def test_system_prompt_is_identical_for_every_seat():
    settings = Settings(llm_provider="fake", _env_file=None)
    framing, artifacts = _artifacts()
    systems = set()
    for s in SEATS:
        ctx = SeatContext(idea="idea", framing=framing, artifacts=dict(artifacts), settings=settings)
        p = build_prompt(s, ctx)
        systems.add(p.system[0]["text"])
        assert p.system[0]["cache_control"] == {"type": "ephemeral", "ttl": "1h"}
    assert systems == {charter_text()}


def test_consecutive_seats_share_a_byte_identical_prefix():
    settings = Settings(llm_provider="fake", _env_file=None)
    framing, artifacts = _artifacts()
    # seat 4 sees everything up to pr_v1; seat 5 sees pr_v2 as well
    ctx4 = SeatContext(idea="idea", framing=framing, artifacts={k: v for k, v in artifacts.items() if k != "pr_v2"}, settings=settings)
    ctx5 = SeatContext(idea="idea", framing=framing, artifacts=dict(artifacts), settings=settings)
    p4 = build_prompt(seat("4"), ctx4)
    p5 = build_prompt(seat("5"), ctx5)
    prefix4 = [b["text"] for b in p4.content_blocks[:-1]]
    prefix5 = [b["text"] for b in p5.content_blocks[:-1]]
    assert prefix5[: len(prefix4)] == prefix4
    assert p5.dossier_kinds == [k for k in CANONICAL_ORDER if k in artifacts]
    # exactly one cache marker in the dossier, on the last artifact block
    marked = [i for i, b in enumerate(p5.content_blocks) if "cache_control" in b]
    assert marked == [len(p5.content_blocks) - 2]


def test_parallel_seats_five_and_six_share_the_entire_prefix():
    settings = Settings(llm_provider="fake", _env_file=None)
    framing, artifacts = _artifacts()
    ctx = SeatContext(idea="idea", framing=framing, artifacts=dict(artifacts), settings=settings)
    p5 = build_prompt(seat("5"), ctx)
    p6 = build_prompt(seat("6"), ctx)
    assert p5.prefix_fingerprint() == p6.prefix_fingerprint()


def test_no_volatile_values_in_the_prefix():
    settings = Settings(llm_provider="fake", _env_file=None)
    framing, artifacts = _artifacts()
    ctx = SeatContext(idea="idea", framing=framing, artifacts=dict(artifacts), settings=settings)
    p = build_prompt(seat("5"), ctx)
    text = p.system[0]["text"] + "".join(b["text"] for b in p.content_blocks[:-1])
    assert not re.search(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}", text)  # no timestamps
    assert "run_" not in text and "art_" not in text  # no ids


def test_validation_error_is_appended_after_the_cached_prefix():
    settings = Settings(llm_provider="fake", _env_file=None)
    framing, artifacts = _artifacts()
    ctx = SeatContext(idea="idea", framing=framing, artifacts=dict(artifacts), settings=settings, validation_error="field x missing")
    p = build_prompt(seat("5"), ctx)
    assert "Correction required" in p.content_blocks[-1]["text"]
    assert "cache_control" not in p.content_blocks[-1]
