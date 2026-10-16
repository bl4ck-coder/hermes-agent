"""A1 presence gate (read-contracts.md 5.1): every table row and counterexample."""

from __future__ import annotations

import pytest

from hermes_cli.ops_fleet import Observation as O, decide_presence, profile_result

NOW = 100.0


def empties(at=NOW):
    return {k: O(observed_at=at, reports_work=False)
            for k in ("approvals", "kanban_workers", "gateway_runs", "blocked_tasks")}


def test_all_missing_is_unknown_never_idle():
    d = decide_presence({}, NOW)
    assert (d.presence, d.precedence, d.freshness_s) == ("unknown", "missing", None)


def test_fresh_running_is_working():
    d = decide_presence({"kanban_workers": O(observed_at=99, reports_work=True)}, NOW)
    assert (d.presence, d.precedence) == ("working", "working")


def test_fresh_pending_is_needs_you_with_waiting_sub_state():
    d = decide_presence({"approvals": O(observed_at=99, reports_work=True),
                         "kanban_workers": O(observed_at=99, reports_work=True)}, NOW)
    assert (d.presence, d.sub_state) == ("needs_you", "waiting_approval")


def test_fresh_gateway_up_and_fresh_authoritative_empties_is_idle():
    d = decide_presence({**empties(), "gateway_up": O(observed_at=99, up=True)}, NOW)
    assert d.presence == "idle"


def test_fresh_gateway_up_with_missing_work_reads_is_unknown_not_idle():
    d = decide_presence({"gateway_up": O(observed_at=99, up=True),
                         "kanban_workers": O(observed_at=99, reports_work=False)}, NOW)
    assert d.presence == "unknown"


def test_counterexample_old_running_plus_fresh_gateway_up_is_stale_30s():
    d = decide_presence({"gateway_runs": O(observed_at=70, reports_work=True),
                         "gateway_up": O(observed_at=99, up=True)}, NOW)
    assert (d.presence, d.precedence, d.freshness_s) == ("stale", "stale", 30)


def test_old_pending_plus_fresh_gateway_up_is_stale():
    d = decide_presence({"approvals": O(observed_at=70, reports_work=True),
                         "gateway_up": O(observed_at=99, up=True)}, NOW)
    assert d.presence == "stale"


def test_old_gateway_up_no_work_is_unknown_not_stale():
    d = decide_presence({"gateway_up": O(observed_at=70, up=True)}, NOW)
    assert (d.presence, d.precedence) == ("unknown", "unknown")


def test_old_authoritative_empty_plus_fresh_gateway_up_is_unknown_not_idle():
    d = decide_presence({**empties(at=70), "gateway_up": O(observed_at=99, up=True)}, NOW)
    assert d.presence == "unknown"


def test_fresh_blocked_task_is_blocked():
    d = decide_presence({"blocked_tasks": O(observed_at=99, reports_work=True)}, NOW)
    assert d.presence == "blocked"


def test_fresh_gateway_down_with_unreachable_platforms_is_offline():
    d = decide_presence({"gateway_up": O(observed_at=99, up=False, platforms_unreachable=True)}, NOW)
    assert d.presence == "offline"


def test_boundary_exactly_5s_is_fresh_and_5_1_is_old():
    assert decide_presence({"kanban_workers": O(observed_at=95, reports_work=True)}, NOW).presence == "working"
    assert decide_presence({"kanban_workers": O(observed_at=94.9, reports_work=True)}, NOW).presence == "stale"


def test_event_at_never_enters_the_gate():
    # Quiet run: producer updated_at is ancient, but the observation is fresh -> working.
    d = decide_presence({"gateway_runs": O(observed_at=99, event_at=1, reports_work=True)}, NOW)
    assert d.presence == "working"


@pytest.mark.parametrize("validity,expected", [("fresh", "working"), ("old", "stale"), ("missing", "unknown")])
def test_single_input_table_running_column(validity, expected):
    at = {"fresh": 99, "old": 70, "missing": None}[validity]
    assert decide_presence({"kanban_workers": O(observed_at=at, reports_work=True)}, NOW).presence == expected


def test_profile_result_shape():
    r = profile_result("alpha", {"kanban_workers": O(observed_at=99, reports_work=True)}, NOW,
                       next_run_at=200.0, active_runs=[{"source": "kanban", "id": 1, "task_id": "t_1",
                                                        "started_at": 90}])
    assert set(r) >= {"profile", "presence", "sub_state", "observed_at", "event_at", "freshness_s",
                      "next_run_at", "active_runs", "precedence"}
    assert r["observed_at"] == 99 and r["freshness_s"] == 1 and r["next_run_at"] == 200.0
