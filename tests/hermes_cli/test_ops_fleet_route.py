"""A1 GET /api/ops/fleet route: attribution across many profiles, disconnect never idle."""

from __future__ import annotations

import pytest

import hermes_cli.web_routers.ops_fleet as fleet
from hermes_cli.ops_fleet import Observation


@pytest.fixture
def client(monkeypatch):
    from starlette.testclient import TestClient
    from hermes_cli.web_server import app, _SESSION_HEADER_NAME, _SESSION_TOKEN
    c = TestClient(app)
    c.headers[_SESSION_HEADER_NAME] = _SESSION_TOKEN
    return c


def _patch(monkeypatch, *, profiles, workers=(), blocked=None, kanban_fails=False, gateway=None):
    monkeypatch.setattr(fleet, "_profile_names", lambda: list(profiles))
    monkeypatch.setattr(fleet, "_clock", lambda: 1000.0)

    def kanban(board):
        if kanban_fails:
            raise OSError("db unavailable")
        return {"workers": list(workers), "blocked": dict(blocked or {}), "observed_at": 1000.0}

    async def gw(profile):
        return (gateway or {}).get(profile)

    monkeypatch.setattr(fleet, "_read_kanban", kanban)
    monkeypatch.setattr(fleet, "_read_gateway", gw)
    monkeypatch.setattr(fleet, "_read_cron", lambda p: {"observed_at": 1000.0, "next_run_at": None})


def test_requires_session_token():
    from starlette.testclient import TestClient
    from hermes_cli.web_server import app
    assert TestClient(app).get("/api/ops/fleet").status_code == 401


def test_concurrent_runs_attributed_per_profile_across_36(monkeypatch, client):
    profiles = [f"p{i:02d}" for i in range(36)]
    workers = [{"run_id": i, "task_id": f"t_{i}", "profile": f"p{i:02d}", "assignee": f"p{i:02d}",
                "started_at": 900 + i, "last_heartbeat_at": None} for i in (3, 7, 7 + 10)]
    workers.append({"run_id": 99, "task_id": "t_99", "profile": "p03", "assignee": "p03",
                    "started_at": 950, "last_heartbeat_at": 990})
    _patch(monkeypatch, profiles=profiles, workers=workers, blocked={"p05": 2})
    body = client.get("/api/ops/fleet").json()
    by = {p["profile"]: p for p in body["profiles"]}
    assert len(by) == 36
    assert {r["id"] for r in by["p03"]["active_runs"]} == {3, 99}
    assert [r["id"] for r in by["p07"]["active_runs"]] == [7]
    assert by["p03"]["presence"] == by["p17"]["presence"] == "working"
    assert by["p05"]["presence"] == "blocked"
    assert by["p00"]["active_runs"] == []
    # No gateway / approvals observed -> never idle.
    assert all(p["presence"] != "idle" for p in body["profiles"])


def test_kanban_disconnect_yields_unknown_never_idle(monkeypatch, client):
    gw = {"a": Observation(observed_at=1000.0, up=True)}
    _patch(monkeypatch, profiles=["a"], kanban_fails=True, gateway=gw)
    p = client.get("/api/ops/fleet").json()["profiles"][0]
    assert p["presence"] == "unknown"
    assert p["inputs"]["kanban_workers"] is None


def test_idle_only_with_every_work_input_fresh_empty(monkeypatch, client):
    gw = {"a": Observation(observed_at=1000.0, up=True)}
    _patch(monkeypatch, profiles=["a"], gateway=gw)
    monkeypatch.setattr(fleet, "EXTRA_INPUT_PROVIDERS", {
        "approvals": lambda ps, b: {"a": Observation(observed_at=1000.0)},
        "gateway_runs": lambda ps, b: {"a": Observation(observed_at=1000.0)},
    })
    p = client.get("/api/ops/fleet").json()["profiles"][0]
    assert (p["presence"], p["precedence"]) == ("idle", "idle")


def test_unpatched_readers_return_a_valid_aggregate_in_the_sandbox_home(client):
    """Real readers against the isolated test HERMES_HOME: no crash, every profile has a presence,
    and nothing reports idle without approvals/gateway-run observations."""
    r = client.get("/api/ops/fleet")
    assert r.status_code == 200
    body = r.json()
    assert "default" in {p["profile"] for p in body["profiles"]}
    for p in body["profiles"]:
        assert p["presence"] in {"working", "needs_you", "blocked", "idle", "offline", "unknown", "stale"}
        assert p["presence"] != "idle"
