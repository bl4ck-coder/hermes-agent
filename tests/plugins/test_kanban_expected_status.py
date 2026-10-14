"""Ops MF7 (SPEC v2.1 §4c): PATCH /tasks/{id} expected_status guard for the review approve."""

from __future__ import annotations

from tests.plugins.test_kanban_dashboard_plugin import client, kanban_home  # noqa: F401


def _new(client):
    r = client.post("/api/plugins/kanban/tasks", json={"title": "guarded"})
    assert r.status_code == 200, r.text
    return r.json()["task"]


def test_stale_expected_status_is_409_and_changes_nothing(client):
    t = _new(client)
    r = client.patch(f"/api/plugins/kanban/tasks/{t['id']}", json={"status": "done", "expected_status": "review"})
    assert r.status_code == 409
    d = r.json()["detail"]
    assert d["code"] == "stale_status" and d["current_status"] == t["status"] and d["expected_status"] == "review"
    after = client.get(f"/api/plugins/kanban/tasks/{t['id']}").json()["task"]
    assert after["status"] == t["status"]


def test_matching_expected_status_applies(client):
    t = _new(client)
    r = client.patch(f"/api/plugins/kanban/tasks/{t['id']}", json={"priority": 3, "expected_status": t["status"]})
    assert r.status_code == 200, r.text
    assert r.json()["task"]["priority"] == 3


def test_without_expected_status_behaviour_is_unchanged(client):
    t = _new(client)
    r = client.patch(f"/api/plugins/kanban/tasks/{t['id']}", json={"priority": 2})
    assert r.status_code == 200 and r.json()["task"]["priority"] == 2
