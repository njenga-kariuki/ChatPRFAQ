import pytest
from pydantic import ValidationError

from app.llm import fake_content as fc
from app.schemas import (
    SLOT_ORDER,
    BarRaiserOutput,
    ConceptValidationOutput,
    DraftOutput,
    Edit,
    ExternalFAQOutput,
    FramingOutput,
    InternalFAQOutput,
    LedgerOutput,
    PressRelease,
    ProblemValidationOutput,
    RefinementOutput,
    Slot,
    SynthesisOutput,
    ValidationPlanOutput,
    output_schema,
    reconcile_edits,
)

ALL_OUTPUT_MODELS = [
    FramingOutput,
    LedgerOutput,
    ProblemValidationOutput,
    DraftOutput,
    RefinementOutput,
    InternalFAQOutput,
    ConceptValidationOutput,
    ExternalFAQOutput,
    SynthesisOutput,
    BarRaiserOutput,
    ValidationPlanOutput,
]


def _walk(node, path, problems):
    if isinstance(node, dict):
        if node.get("type") == "object" and node.get("additionalProperties") is not False:
            problems.append((path, "additionalProperties must be false"))
        for key in ("minimum", "maximum", "minLength", "maxLength", "minItems", "maxItems", "pattern"):
            if key in node:
                problems.append((path, f"unsupported constraint {key}"))
        for k, v in node.items():
            _walk(v, f"{path}.{k}", problems)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            _walk(v, f"{path}[{i}]", problems)


@pytest.mark.parametrize("model", ALL_OUTPUT_MODELS)
def test_output_schemas_are_valid_for_structured_outputs(model):
    problems: list = []
    _walk(output_schema(model), model.__name__, problems)
    assert problems == []


def test_press_release_requires_exactly_eight_slots_in_order():
    with pytest.raises(ValidationError):
        PressRelease(slots=[Slot(id="headline", text="x", claims=[])])
    slots = [Slot(id=s, text=f"text {s}", claims=[]) for s in SLOT_ORDER]
    pr = PressRelease(slots=slots)
    assert pr.text_of("cta") == "text cta"
    assert pr.markdown().startswith("**text headline**\n\n*text subheading*")


def test_fake_content_validates_against_every_schema():
    name = "Ledgerly"
    FramingOutput.model_validate(fc.framing("a bookkeeping service"))
    LedgerOutput.model_validate(fc.ledger(name, ["S-01"]))
    ProblemValidationOutput.model_validate(fc.problem_validation(name))
    DraftOutput.model_validate(fc.draft(name))
    RefinementOutput.model_validate(fc.refinement(name, 2))
    RefinementOutput.model_validate(fc.refinement(name, 3))
    faq = InternalFAQOutput.model_validate(fc.internal_faq(name))
    assert len(faq.all_items()) == 16 and len(faq.sections) == 5
    cv = ConceptValidationOutput.model_validate(fc.concept_validation(name))
    assert len(cv.participants) == 10
    ExternalFAQOutput.model_validate(fc.external_faq(name))
    SynthesisOutput.model_validate(fc.synthesis(name))
    BarRaiserOutput.model_validate(fc.bar_raiser(name))
    plan = ValidationPlanOutput.model_validate(fc.validation_plan(name))
    assert plan.ranked()[0].priority_score >= plan.ranked()[-1].priority_score


def test_reconcile_edits_synthesizes_missing_and_drops_stale():
    v1 = DraftOutput.model_validate(fc.draft("Ledgerly")).press_release
    v2 = RefinementOutput.model_validate(fc.refinement("Ledgerly", 2)).press_release
    stale = Edit(slot_id="headline", new_text="unchanged", rationale="no-op", evidence_finding_ids=[], change_kind="polish")
    # pretend the model only reported one edit and one stale edit for an unchanged slot
    v2_same_headline = PressRelease(slots=[s if s.id != "headline" else v1.slot("headline") for s in v2.slots])
    edits = reconcile_edits(v1, v2_same_headline, [stale], "Unannotated change.")
    slot_ids = [e.slot_id for e in edits]
    assert "headline" not in slot_ids  # stale edit dropped: the headline did not change
    assert "problem" in slot_ids and all(e.rationale == "Unannotated change." for e in edits)
    assert all(e.new_text == v2_same_headline.text_of(e.slot_id) for e in edits)


def test_research_key_insight_takes_the_first_recommendation():
    from app.schemas.research import research_key_insight

    insight = research_key_insight(fc.research_markdown("Ledgerly"))
    assert insight is not None
    assert insight.startswith('Position Ledgerly as "the books, done by Monday"')
    assert insight.endswith("rather than the automation.")

    without_heading = "## Competitive Intelligence\n\n| a | b |\n|---|---|\n\nShort.\n\n- **A sentence** long enough to be used as the takeaway line [1]. Another one follows."
    assert research_key_insight(without_heading) == "A sentence long enough to be used as the takeaway line."

    long_sentence = "## Strategic Recommendations\n\n" + " ".join(["word"] * 80) + " end."
    clipped = research_key_insight(long_sentence)
    assert clipped is not None and clipped.endswith("…") and len(clipped) <= 221

    assert research_key_insight("") is None
    assert research_key_insight("## Heading only\n\n| table | only |\n") is None
