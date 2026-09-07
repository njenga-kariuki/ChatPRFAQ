from app.council.graph import council_graph, critical_path_length, ready_seats, run_is_complete
from app.settings import Settings


def test_five_and_six_become_ready_together_and_seven_waits_for_both():
    g = council_graph(Settings(llm_provider="fake", _env_file=None))
    have = {"brief", "market_research", "ledger", "problem_validation", "pr_v1", "pr_v2"}
    ready = [s.id for s in ready_seats(g, have, {"1", "1b", "2", "3", "4"}, set())]
    assert ready == ["5", "6"]
    have.add("internal_faq")
    assert [s.id for s in ready_seats(g, have, {"1", "1b", "2", "3", "4", "5"}, {"6"})] == []
    have.add("concept_validation")
    assert [s.id for s in ready_seats(g, have, {"1", "1b", "2", "3", "4", "5", "6"}, set())] == ["7"]


def test_bar_raiser_gates_the_validation_plan_by_default():
    g = council_graph(Settings(llm_provider="fake", _env_file=None))
    assert g["10"] == ("prfaq", "bar_raiser")
    g2 = council_graph(Settings(llm_provider="fake", bar_raiser_enabled=False, _env_file=None))
    assert "9b" not in g2 and g2["10"] == ("prfaq",)


def test_parallel_validation_plan_flag():
    g = council_graph(Settings(llm_provider="fake", parallel_validation_plan=True, _env_file=None))
    assert g["10"] == ("external_faq",)
    assert critical_path_length(g) < critical_path_length(council_graph(Settings(llm_provider="fake", _env_file=None)))


def test_run_is_complete_only_when_every_seat_finished():
    g = council_graph(Settings(llm_provider="fake", _env_file=None))
    assert not run_is_complete(g, set(g) - {"10"})
    assert run_is_complete(g, set(g))
