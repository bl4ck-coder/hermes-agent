"""A5/A6 Ops write routes (ops-panel P2-03): SOUL byte-exact restore over HTTP, 409, 403 (D11),
policy P2 on model + raw YAML, D13 warn on unrelated edits, no secrets in responses."""

from __future__ import annotations

import hashlib
import secrets
from pathlib import Path

import pytest
import yaml

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
    for f in ("SOUL.md", "config.yaml"):
        (r / f).unlink(missing_ok=True)
    return r


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


def test_soul_save_then_restore_is_byte_exact(client, root):
    original = b"\xef\xbb\xbf# Soul\r\nkeep CRLF and BOM\r\n"
    (root / "SOUL.md").write_bytes(original)
    sha = hashlib.sha256(original).hexdigest()
    r = client.put(url("prompt"), json={"expected_hash": h(client, "prompt"), "content": "new soul\n", "note": "tone"},
                   headers=LOCAL)
    assert r.status_code == 200 and r.json()["outcome"] == "committed"
    assert (root / "SOUL.md").read_bytes() == b"new soul\n"
    hist = client.get(url("prompt", "/history")).json()["items"]
    assert hist[0]["note"] == "tone" and hist[0]["files"][0]["before_hash"] == sha
    r = client.post(url("prompt", "/restore"), json={"backup": hist[0]["backup"], "expected_hash": h(client, "prompt")},
                    headers=LOCAL)
    assert r.status_code == 200
    assert hashlib.sha256((root / "SOUL.md").read_bytes()).hexdigest() == sha
    # restore itself was backed up first (D10): two committed entries now
    assert len(client.get(url("prompt", "/history")).json()["items"]) == 2


def test_conflict_409_and_remote_403(client, root):
    (root / "SOUL.md").write_bytes(b"a")
    stale = h(client, "prompt")
    (root / "SOUL.md").write_bytes(b"changed elsewhere")
    r = client.put(url("prompt"), json={"expected_hash": stale, "content": "x"}, headers=LOCAL)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "conflict"
    for headers in ({R.KIND_HEADER: "remote", R.ID_HEADER: "r1"}, {}, {R.KIND_HEADER: "ssh", R.ID_HEADER: "s"}):
        r = client.put(url("prompt"), json={"expected_hash": h(client, "prompt"), "content": "x"}, headers=headers)
        assert r.status_code == 403
    assert (root / "SOUL.md").read_bytes() == b"changed elsewhere"
    r = client.post(url("prompt", "/restore"), json={"backup": "x", "expected_hash": "y"})
    assert r.status_code == 403


BASE = {"model": {"provider": "anthropic", "default": "claude-opus-5-5", "base_url": "https://api.anthropic.com"},
        "api_key": "sk-SECRET-should-never-leave", "agent": {"max_turns": 10}}


def test_model_policy_acceptance(client, root):
    (root / "config.yaml").write_text(yaml.safe_dump(BASE), encoding="utf-8")
    bad = client.put(url("model"), json={"expected_hash": h(client, "model"), "provider": "openrouter",
                                         "model": "claude-opus-5-5"}, headers=LOCAL)
    assert bad.status_code == 400 and bad.json()["detail"]["code"] == "policy_blocked"
    bad = client.put(url("model"), json={"expected_hash": h(client, "model"), "provider": "xai-oauth",
                                         "model": "grok-4.6"}, headers=LOCAL)
    assert bad.status_code == 400
    assert yaml.safe_load((root / "config.yaml").read_text())["model"]["provider"] == "anthropic"
    ok = client.put(url("model"), json={"expected_hash": h(client, "model"), "provider": "openai-codex",
                                        "model": "gpt-6.1-sol-pro"}, headers=LOCAL)
    assert ok.status_code == 200, ok.text
    cfg = yaml.safe_load((root / "config.yaml").read_text())
    assert cfg["model"] == {"provider": "openai-codex", "default": "gpt-6.1-sol-pro"}
    assert cfg["api_key"] == BASE["api_key"] and cfg["agent"] == {"max_turns": 10}
    got = client.get(url("model")).json()
    assert (got["provider"], got["model"]) == ("openai-codex", "gpt-6.1-sol-pro")
    # resource-specific restore puts the old model section back, leaves other keys
    hist = client.get(url("model", "/history")).json()["items"]
    r = client.post(url("model", "/restore"), json={"backup": hist[0]["backup"], "expected_hash": h(client, "model")},
                    headers=LOCAL)
    assert r.status_code == 200
    assert yaml.safe_load((root / "config.yaml").read_text())["model"] == BASE["model"]
    for resp in (got, hist, r.json()):
        assert "sk-SECRET" not in str(resp)


def test_raw_yaml_policy_and_d13_warning(client, root):
    violating = dict(BASE, model={"provider": "openrouter", "default": "laguna"})
    (root / "config.yaml").write_text(yaml.safe_dump(violating), encoding="utf-8")
    # unrelated edit on a violating profile: saved with a warning
    edited = yaml.safe_dump(dict(violating, agent={"max_turns": 25}))
    r = client.put(url("raw_yaml"), json={"expected_hash": h(client, "raw_yaml"), "content": edited}, headers=LOCAL)
    assert r.status_code == 200 and r.json()["warnings"][0]["reason"] == "provider_not_allowed"
    assert (root / "config.yaml").read_text(encoding="utf-8") == edited  # exact bytes
    # introducing a new disallowed selection is blocked
    worse = yaml.safe_dump(dict(violating, fallback_providers=[{"provider": "nous", "model": "hermes-4"}]))
    r = client.put(url("raw_yaml"), json={"expected_hash": h(client, "raw_yaml"), "content": worse}, headers=LOCAL)
    assert r.status_code == 400 and r.json()["detail"]["blocked"][0]["field"] == "fallback_providers[0]"
    r = client.put(url("raw_yaml"), json={"expected_hash": h(client, "raw_yaml"), "content": "- not a map\n"},
                   headers=LOCAL)
    assert r.status_code == 400 and r.json()["detail"]["code"] == "invalid_yaml"
    assert (root / "config.yaml").read_text(encoding="utf-8") == edited
    body = client.get(url("raw_yaml")).json()
    assert set(body) == {"profile", "node", "content_hash", "exists"}
    # the config backup is an envelope: the secret is not in any artifact
    for f in ops_tx.backup_root(root).rglob("*"):
        if f.is_file():
            assert b"sk-SECRET" not in f.read_bytes()


def test_unknown_node_and_profile(client, root):
    assert client.get("/api/ops/profiles/default/nodes/channels").status_code == 404
    assert client.get("/api/ops/profiles/no-such-profile/nodes/prompt").status_code == 404
    assert client.get("/api/ops/profiles/..%2F..%2Fx/nodes/prompt").status_code in (400, 404)
