"""A3 approvals: envelope, one-click dedupe (duplicate approve = one resolution), history."""

from __future__ import annotations

import threading

import pytest

from hermes_cli import ops_approvals as A


@pytest.fixture(autouse=True)
def _clean():
    from tools import approval as ap
    with ap._lock:
        ap._gateway_queues.clear()
    A._reset_history_for_tests()
    yield
    with ap._lock:
        for q in ap._gateway_queues.values():
            for e in q:
                e.event.set()
        ap._gateway_queues.clear()


def _enqueue(session_key, request_id, command="rm -rf build", description="delete build dir"):
    from tools import approval as ap
    from tools.approval_gateway_wait import _ApprovalEntry
    entry = _ApprovalEntry({"command": command, "description": description, "pattern_key": "rm",
                            "pattern_keys": ["rm"], "request_id": request_id})
    with ap._lock:
        ap._gateway_queues.setdefault(session_key, []).append(entry)
    return entry


@pytest.fixture
def client():
    from starlette.testclient import TestClient
    from hermes_cli.web_server import app, _SESSION_HEADER_NAME, _SESSION_TOKEN
    c = TestClient(app)
    c.headers[_SESSION_HEADER_NAME] = _SESSION_TOKEN
    return c


def test_envelope_fields_and_actions():
    item = A.jsonrpc_item("alpha", "s1", {"command": "ls", "description": "list", "pattern_key": "ls",
                                         "request_id": "r1"})
    assert item["origin"] == "jsonrpc" and item["id"] == "r1" and item["profile"] == "alpha"
    assert item["exact_request"] == {"command": "ls", "pattern_keys": ["ls"]}
    assert item["actions"] == ["approve", "deny"]
    assert item["expires_at"] is None and item["age_s"] is None  # no source clock: never guessed


def test_redacted_request_is_review_only_and_reason_not_recorded():
    item = A.jsonrpc_item("alpha", "s1", {"request_id": "r2"})
    assert item["exact_request"] is None
    assert item["why"] == item["what_for"] == "reason not recorded"
    assert item["actions"] == ["review"]


def test_choice_aliases():
    assert A.normalize_choice("approve") == "once"
    assert A.normalize_choice("deny") == "deny"
    assert A.normalize_choice("all") is None


def test_pending_lists_queue_and_kanban(monkeypatch, client):
    import hermes_cli.web_routers.ops_approvals as R
    _enqueue("sess-a", "req-1")
    monkeypatch.setattr(R, "_read_kanban_items", lambda board: [A.kanban_item(
        {"id": "t_1", "title": "fix", "status": "blocked", "assignee": "builder", "tenant": "ops-panel",
         "session_id": None, "created_at": 1})])
    items = client.get("/api/approvals/pending").json()["items"]
    origins = {(i["origin"], i["id"]) for i in items}
    assert ("jsonrpc", "req-1") in origins and ("kanban_blocked", "t_1") in origins
    k = next(i for i in items if i["id"] == "t_1")
    assert k["actions"] == ["review"] and k["tenant"] == "ops-panel"


def test_duplicate_approve_produces_one_resolution(client):
    entry = _enqueue("sess-a", "req-1")
    body = {"origin": "jsonrpc", "id": "req-1", "session_id": "sess-a", "choice": "approve"}
    first = client.post("/api/approvals/respond", json=body).json()
    second = client.post("/api/approvals/respond", json=body).json()
    assert (first["resolved"], first["outcome"]) == (1, "resolved")
    assert (second["resolved"], second["outcome"]) == (0, "resolved_elsewhere")
    assert entry.result == "once" and entry.event.is_set()
    hist = client.get("/api/approvals/resolved").json()["items"]
    assert len(hist) == 1 and hist[0]["id"] == "req-1"
    assert client.get("/api/approvals/pending").json()["items"] == [] or all(
        i["id"] != "req-1" for i in client.get("/api/approvals/pending").json()["items"])


def test_concurrent_duplicate_approves_resolve_once():
    _enqueue("sess-a", "req-9")
    results = []
    def go():
        results.append(A.respond_jsonrpc("sess-a", "req-9", "once", profile="p")["resolved"])
    ts = [threading.Thread(target=go) for _ in range(8)]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert sorted(results) == [0] * 7 + [1]
    assert len(A.resolved_history()) == 1


def test_respond_targets_request_id_only_never_fifo(client):
    _enqueue("sess-a", "req-1")
    e2 = _enqueue("sess-a", "req-2", command="echo 2")
    r = client.post("/api/approvals/respond", json={"origin": "jsonrpc", "id": "req-2", "session_id": "sess-a",
                                                    "choice": "deny"}).json()
    assert r["resolved"] == 1 and e2.result == "deny"
    assert [i["id"] for i in client.get("/api/approvals/pending").json()["items"] if i["origin"] == "jsonrpc"] == ["req-1"]


def test_respond_rejects_unroutable_origin_and_bad_choice(client):
    assert client.post("/api/approvals/respond", json={"origin": "gateway_run", "id": "x", "choice": "once"}).status_code == 400
    _enqueue("sess-a", "req-1")
    assert client.post("/api/approvals/respond", json={"origin": "jsonrpc", "id": "req-1", "session_id": "sess-a",
                                                       "choice": "all"}).status_code == 400


def test_fleet_provider_marks_needs_you_for_process_profile(monkeypatch):
    import hermes_cli.web_routers.ops_approvals as R
    monkeypatch.setattr(R, "_process_profile", lambda: "alpha")
    assert R.fleet_approvals_provider(["alpha", "beta"], None)["alpha"].reports_work is False
    _enqueue("s", "r")
    obs = R.fleet_approvals_provider(["alpha", "beta"], None)
    assert obs["alpha"].reports_work is True and "beta" not in obs


def test_requires_session_token():
    from starlette.testclient import TestClient
    from hermes_cli.web_server import app
    assert TestClient(app).get("/api/approvals/pending").status_code == 401
