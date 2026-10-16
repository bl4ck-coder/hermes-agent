"""SPEC v2.1 must-folds verified in code (P8 B7): policy fail-closed + restrict-only (MF4),
op_id outcome reconcile + duplicate guard (MF3), Origin control separate from Host (MF5)."""

from __future__ import annotations

import secrets
from pathlib import Path

import pytest
import yaml

from hermes_cli import ops_policy as P
from hermes_cli import ops_tx
from hermes_cli.web_routers import ops_tx as R

LOCAL = {R.KIND_HEADER: "local", R.ID_HEADER: "local"}


class FakeProtector:
    def __init__(self):
        self._key = secrets.token_bytes(32)

    def available(self):
        return True

    def key(self):
        return self._key


@pytest.fixture
def root(monkeypatch):
    from hermes_constants import get_default_hermes_root

    monkeypatch.setattr(ops_tx, "acl", lambda *a, **k: None)
    monkeypatch.setattr(R, "protector", FakeProtector())
    r = Path(get_default_hermes_root())
    r.mkdir(parents=True, exist_ok=True)
    for f in ("SOUL.md", "config.yaml", P.POLICY_FILE):
        (r / f).unlink(missing_ok=True)
    yield r
    (r / P.POLICY_FILE).unlink(missing_ok=True)


@pytest.fixture
def client():
    from starlette.testclient import TestClient

    from hermes_cli.web_server import _SESSION_HEADER_NAME, _SESSION_TOKEN, app

    c = TestClient(app)
    c.headers[_SESSION_HEADER_NAME] = _SESSION_TOKEN
    return c


def url(node, suffix=""):
    return f"/api/ops/profiles/default/nodes/{node}{suffix}"


def h(client, node):
    return client.get(url(node)).json()["content_hash"]


def policy(**over):
    base = {"version": 2, "enabled": True, "deny_default": True, "allow": [{"provider": "anthropic", "models": ["claude-opus-*"]}]}
    base.update(over)
    return base


@pytest.mark.parametrize(
    "allow",
    [
        [{"provider": "openrouter", "models": ["claude-*"]}],  # new provider
        [{"provider": "anthropic", "models": ["*"]}],  # wider pattern
        [{"provider": "xai", "models": ["grok-5"]}],  # model outside builtin
    ],
)
def test_override_cannot_enlarge(tmp_path, allow):
    (tmp_path / P.POLICY_FILE).write_text(yaml.safe_dump(policy(allow=allow)), encoding="utf-8")
    load = P.load_policy(tmp_path)
    assert load.source == "invalid" and load.fail_closed and "restrict-only" in load.error


def test_override_may_restrict(tmp_path):
    (tmp_path / P.POLICY_FILE).write_text(yaml.safe_dump(policy()), encoding="utf-8")
    load = P.load_policy(tmp_path)
    assert load.source == "file" and not load.fail_closed


def test_invalid_policy_fails_closed_for_every_governed_write(client, root):
    (root / "SOUL.md").write_bytes(b"soul")
    (root / P.POLICY_FILE).write_text("version: 2\nallow: [\n", encoding="utf-8")
    body = client.get("/api/ops/policy").json()
    assert body["source"] == "invalid" and body["fail_closed"] is True and body["error"]
    r = client.put(url("prompt"), json={"expected_hash": h(client, "prompt"), "content": "x"}, headers=LOCAL)
    assert r.status_code == 423 and r.json()["detail"]["code"] == "policy_invalid"
    r = client.post(url("prompt", "/restore"), json={"backup": "x", "expected_hash": h(client, "prompt")}, headers=LOCAL)
    assert r.status_code == 423
    assert (root / "SOUL.md").read_bytes() == b"soul"
    (root / P.POLICY_FILE).unlink()
    r = client.put(url("prompt"), json={"expected_hash": h(client, "prompt"), "content": "x"}, headers=LOCAL)
    assert r.status_code == 200


def test_op_id_reconcile_and_duplicate(client, root):
    (root / "SOUL.md").write_bytes(b"a")
    assert client.get(url("prompt", "/ops/op-1")).json()["state"] == "not_found"
    r = client.put(url("prompt"), json={"expected_hash": h(client, "prompt"), "content": "b", "op_id": "op-1"}, headers=LOCAL)
    assert r.status_code == 200
    st = client.get(url("prompt", "/ops/op-1")).json()
    assert st["state"] == "applied" and st["backup"]
    again = client.put(url("prompt"), json={"expected_hash": h(client, "prompt"), "content": "c", "op_id": "op-1"}, headers=LOCAL)
    assert again.status_code == 409 and again.json()["detail"]["code"] == "duplicate_op"
    assert (root / "SOUL.md").read_bytes() == b"b"
    # a stale CAS never writes a manifest: not_found -> safe to retry with a new op_id
    bad = client.put(url("prompt"), json={"expected_hash": "stale", "content": "z", "op_id": "op-2"}, headers=LOCAL)
    assert bad.status_code == 409 and client.get(url("prompt", "/ops/op-2")).json()["state"] == "not_found"
    # different current hash alone is never "applied" for an unknown op
    (root / "SOUL.md").write_bytes(b"someone else")
    assert client.get(url("prompt", "/ops/op-3")).json()["state"] == "not_found"


def test_rejected_validation_is_reported(client, root):
    (root / "config.yaml").write_text(yaml.safe_dump({"model": {"provider": "anthropic", "default": "claude-opus-5-5"}}), encoding="utf-8")
    r = client.put(url("model"), json={"expected_hash": h(client, "model"), "provider": "openrouter", "model": "x", "op_id": "op-r"}, headers=LOCAL)
    assert r.status_code == 400
    assert client.get(url("model", "/ops/op-r")).json()["state"] == "rejected"


def test_origin_guard_is_separate_from_host(client, root):
    (root / "SOUL.md").write_bytes(b"a")
    body = {"expected_hash": h(client, "prompt"), "content": "x"}
    evil = client.put(url("prompt"), json=body, headers={**LOCAL, "Origin": "https://evil.example"})
    assert evil.status_code == 403 and evil.json()["detail"]["code"] == "origin_not_allowed"
    assert (root / "SOUL.md").read_bytes() == b"a"
    # reads are not origin-gated; kanban and approvals mutations are
    assert client.get(url("prompt"), headers={"Origin": "https://evil.example"}).status_code == 200
    assert client.post("/api/approvals/respond", json={}, headers={"Origin": "https://evil.example"}).status_code == 403
    assert client.post("/api/plugins/kanban/tasks", json={}, headers={"Origin": "https://evil.example"}).status_code == 403
    for ok in ("http://localhost:5173", "http://127.0.0.1:9119", "null", "app://hermes", "file://"):
        r = client.put(url("prompt"), json={"expected_hash": h(client, "prompt"), "content": ok}, headers={**LOCAL, "Origin": ok})
        assert r.status_code == 200, (ok, r.text)
