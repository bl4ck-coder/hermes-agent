"""S6 (Ops SPEC-v2): the dashboard backend rejects a foreign Host header (DNS rebinding)."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from hermes_cli import web_server as ws


@pytest.mark.parametrize(
    "host,bound,ok",
    [
        ("127.0.0.1:9119", "127.0.0.1", True),
        ("localhost:9119", "127.0.0.1", True),
        ("evil.example:9119", "127.0.0.1", False),
        ("127.0.0.1.evil.example", "127.0.0.1", False),
        ("", "127.0.0.1", False),
        ("anything.example", "0.0.0.0", True),
    ],
)
def test_is_accepted_host(host, bound, ok):
    assert ws._is_accepted_host(host, bound) is ok


def test_foreign_host_header_gets_400(monkeypatch):
    monkeypatch.setattr(ws.app.state, "bound_host", "127.0.0.1", raising=False)
    client = TestClient(ws.app, base_url="http://evil.example")
    r = client.get("/api/status")
    assert r.status_code == 400
    assert "Invalid Host header" in r.json()["detail"]
