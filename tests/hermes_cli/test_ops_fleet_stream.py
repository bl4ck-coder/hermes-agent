"""Fleet / Needs-you push channel (ops-panel P1-05)."""

from __future__ import annotations

import json

import pytest

import hermes_cli.web_routers.ops_fleet as fleet


def _snap(presence):
    return {"profiles": [{"profile": "a", "presence": presence, "sub_state": None, "precedence": presence,
                          "active_runs": []}], "board": None, "now": 1}


async def _never():
    return False


@pytest.mark.asyncio
async def test_push_only_on_change_and_needs_you_event(monkeypatch):
    seq = iter(["working", "working", "needs_you", "needs_you"])

    async def build(board):
        return _snap(next(seq))

    async def nosleep(s):
        return None

    monkeypatch.setattr(fleet, "build_fleet", build)
    monkeypatch.setattr(fleet.asyncio, "sleep", nosleep)
    monkeypatch.setattr(fleet, "_FLEET_MAX_TICKS", 4)
    chunks = [c async for c in fleet._fleet_events(None, _never)]
    events = [(c.split("\n")[1][7:], json.loads(c.split("\n")[2][6:])) for c in chunks if c.startswith("id: ")]
    kinds = [k for k, _ in events]
    assert kinds == ["fleet", "needs_you", "fleet", "needs_you"]
    assert events[1][1] == {"profiles": []} and events[3][1] == {"profiles": ["a"]}
    ids = [int(c.split("\n")[0][4:]) for c in chunks if c.startswith("id: ")]
    assert ids == sorted(ids) and len(set(ids)) == len(ids)


def test_route_is_sse_and_session_gated(monkeypatch):
    from starlette.testclient import TestClient
    from hermes_cli.web_server import app, _SESSION_HEADER_NAME, _SESSION_TOKEN

    async def build(board):
        return _snap("unknown")

    monkeypatch.setattr(fleet, "build_fleet", build)
    monkeypatch.setattr(fleet, "_FLEET_MAX_TICKS", 1)
    assert TestClient(app).get("/api/ops/fleet/stream").status_code == 401
    c = TestClient(app)
    c.headers[_SESSION_HEADER_NAME] = _SESSION_TOKEN
    r = c.get("/api/ops/fleet/stream")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/event-stream")
    assert "event: fleet" in r.text
