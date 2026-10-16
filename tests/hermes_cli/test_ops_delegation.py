"""A4 delegation projection: read-only, api_key stripped, inherit semantics, no child list."""

from __future__ import annotations

import pytest

import hermes_cli.web_routers.ops_delegation as R

KEYS = {"profile", "model", "provider", "inherit_model", "inherit_provider", "fallback_providers",
        "inherit_mcp_toolsets", "api_key_set"}


def test_projection_strips_api_key_and_has_exact_keys():
    p = R.project_delegation("alpha", {"model": "m", "provider": "x", "api_key": "sk-secret",
                                       "fallback_providers": ["a"], "inherit_mcp_toolsets": True,
                                       "base_url": "http://h", "max_iterations": 9})
    assert set(p) == KEYS
    assert p["api_key_set"] is True and "sk-secret" not in repr(p)
    assert (p["inherit_model"], p["inherit_provider"]) == (False, False)


def test_empty_model_provider_mean_inherit_and_fallback_null_vs_empty():
    p = R.project_delegation("a", {"model": "", "provider": "", "fallback_providers": None})
    assert (p["model"], p["inherit_model"], p["inherit_provider"], p["fallback_providers"]) == (None, True, True, None)
    assert R.project_delegation("a", {"fallback_providers": []})["fallback_providers"] == []
    assert R.project_delegation("a", None)["api_key_set"] is False


@pytest.fixture
def client():
    from starlette.testclient import TestClient
    from hermes_cli.web_server import app, _SESSION_HEADER_NAME, _SESSION_TOKEN
    c = TestClient(app)
    c.headers[_SESSION_HEADER_NAME] = _SESSION_TOKEN
    return c


def test_route_reads_config_and_never_leaks_key(monkeypatch, client):
    import hermes_cli.config as cfg
    monkeypatch.setattr(cfg, "load_config", lambda: {"delegation": {"model": "child", "api_key": "sk-x"}})
    body = client.get("/api/ops/delegation").json()
    assert set(body) == KEYS and body["model"] == "child" and body["api_key_set"] is True
    assert "sk-x" not in str(body)


def test_route_in_sandbox_returns_projection(client):
    r = client.get("/api/ops/delegation")
    assert r.status_code == 200 and set(r.json()) == KEYS


def test_read_only_no_write_methods(client):
    assert client.post("/api/ops/delegation", json={}).status_code == 405
    assert client.put("/api/ops/delegation", json={}).status_code == 405


def test_requires_session_token():
    from starlette.testclient import TestClient
    from hermes_cli.web_server import app
    assert TestClient(app).get("/api/ops/delegation").status_code == 401
