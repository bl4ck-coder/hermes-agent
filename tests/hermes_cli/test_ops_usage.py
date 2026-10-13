"""A2 per-run usage provenance (read-contracts.md 5.2 / 10)."""

from __future__ import annotations

import pytest

import hermes_cli.web_routers.ops_usage as route
from hermes_cli.ops_usage import gateway_run_usage, kanban_run_usage, today_total


def test_kanban_run_is_always_null_unknown():
    assert kanban_run_usage({"id": 1, "metadata": '{"input_tokens": 50}'}) == {
        "input_tokens": None, "output_tokens": None, "provenance": "unknown", "session_id": None}


def test_absent_usage_key_is_null_not_zero():
    r = gateway_run_usage({"session_id": "s1", "status": "running"})
    assert (r["input_tokens"], r["output_tokens"], r["provenance"]) == (None, None, "unknown")


def test_empty_usage_object_is_null_with_counter_provenance():
    r = gateway_run_usage({"session_id": "s1", "usage": {}})
    assert (r["input_tokens"], r["provenance"]) == (None, "gateway.session_counters")


def test_counters_keep_counter_provenance_including_coerced_zero():
    r = gateway_run_usage({"session_id": "s1", "usage": {"input_tokens": 0, "output_tokens": 12}})
    assert (r["input_tokens"], r["output_tokens"], r["provenance"]) == (0, 12, "gateway.session_counters")


def test_shared_session_never_double_counts():
    st = {"session_id": "s1", "usage": {"input_tokens": 100, "output_tokens": 10}}
    r = gateway_run_usage(st, other_run_session_ids=["s1"])
    assert (r["input_tokens"], r["output_tokens"], r["provenance"]) == (None, None, "shared-session")


def test_today_total_nulls_stay_null():
    assert today_total({"total_input": None, "total_output": None})["input_tokens"] is None
    assert today_total({"total_input": 5, "total_output": 7}) == {
        "input_tokens": 5, "output_tokens": 7, "provenance": "analytics.usage:days=1"}


@pytest.fixture
def client():
    from starlette.testclient import TestClient
    from hermes_cli.web_server import app, _SESSION_HEADER_NAME, _SESSION_TOKEN
    c = TestClient(app)
    c.headers[_SESSION_HEADER_NAME] = _SESSION_TOKEN
    return c


def test_route_kanban_found_and_missing(monkeypatch, client):
    monkeypatch.setattr(route, "_read_kanban_run", lambda rid: {"id": rid} if rid == 7 else None)
    assert client.get("/api/ops/runs/kanban/7/usage").json()["provenance"] == "unknown"
    assert client.get("/api/ops/runs/kanban/8/usage").status_code == 404
    assert client.get("/api/ops/runs/kanban/x/usage").status_code == 400
    assert client.get("/api/ops/runs/other/1/usage").status_code == 400


def test_route_gateway_without_reader_is_unknown(monkeypatch, client):
    monkeypatch.setattr(route, "gateway_reader", None)
    r = client.get("/api/ops/runs/gateway/run_abc/usage").json()
    assert (r["input_tokens"], r["provenance"]) == (None, "unknown")


def test_route_gateway_reader_failure_is_unknown_not_zero(monkeypatch, client):
    def boom(rid):
        raise ConnectionError("gateway down")
    monkeypatch.setattr(route, "gateway_reader", boom)
    assert client.get("/api/ops/runs/gateway/r1/usage").json()["provenance"] == "unknown"


def test_route_gateway_reader_shared_session(monkeypatch, client):
    monkeypatch.setattr(route, "gateway_reader", lambda rid: {
        "status": {"session_id": "s", "usage": {"input_tokens": 9, "output_tokens": 1}},
        "other_run_session_ids": ["s"]})
    assert client.get("/api/ops/runs/gateway/r1/usage").json()["provenance"] == "shared-session"


def test_route_today_total_in_sandbox(client):
    r = client.get("/api/ops/usage/today")
    assert r.status_code == 200
    assert r.json()["provenance"] == "analytics.usage:days=1"


def test_requires_session_token():
    from starlette.testclient import TestClient
    from hermes_cli.web_server import app
    assert TestClient(app).get("/api/ops/usage/today").status_code == 401
