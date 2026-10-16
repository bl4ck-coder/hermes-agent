"""SPEC v2.1 3b: /api/status publishes Ops capability tokens; profile create/clone are not claimed."""

from hermes_cli.ops_capabilities import OPS_CAPABILITIES


def test_status_publishes_capabilities():
    from starlette.testclient import TestClient

    from hermes_cli.web_server import app

    body = TestClient(app).get("/api/status").json()
    caps = body["ops_capabilities"]
    assert caps["version"] == 1 and "ops.tx.op_status" in caps["tokens"] and "ops.origin_guard" in caps["tokens"]
    assert "ops.profiles.create" not in caps["tokens"] and "ops.profiles.clone" not in caps["tokens"]


def test_tokens_are_unique_and_namespaced():
    assert len(OPS_CAPABILITIES) == len(set(OPS_CAPABILITIES))
    assert all(t.startswith(("ops.", "kanban.")) for t in OPS_CAPABILITIES)
