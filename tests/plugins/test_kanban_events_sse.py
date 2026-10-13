"""A7 SSE kanban stream (ops-panel P1-05): Last-Event-ID resume loses and repeats nothing."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest


def _load():
    plugin_file = Path(__file__).resolve().parents[2] / "plugins" / "kanban" / "dashboard" / "plugin_api.py"
    spec = importlib.util.spec_from_file_location("hermes_dashboard_plugin_kanban_sse_test", plugin_file)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


class _Tail:
    """Events 1..N on disk; ``grow`` more land after each poll."""

    def __init__(self, n=5, grow=0):
        self.n, self.grow, self.polled = n, grow, []

    async def latest(self):
        return self.n

    async def poll(self, cursor):
        self.polled.append(cursor)
        rows = [{"id": i, "task_id": "t", "run_id": None, "kind": "k", "payload": None, "created_at": i}
                for i in range(cursor + 1, self.n + 1)][:200]
        self.n += self.grow
        return (rows[-1]["id"] if rows else cursor), rows

    async def shutdown(self):
        pass


async def _never():
    return False


async def _collect(mod, tail, cursor, polls):
    mod._SSE_MAX_POLLS = polls
    out = []
    async for chunk in mod._sse_kanban_events(tail, cursor, _never):
        out.append(chunk)
    return out


def _ids(chunks):
    return [int(c.split("\n")[0][4:]) for c in chunks if c.startswith("id: ")]


@pytest.mark.asyncio
async def test_no_cursor_starts_at_tail(monkeypatch):
    mod = _load()
    monkeypatch.setattr(mod.asyncio, "sleep", lambda s: _never())
    tail = _Tail(n=5, grow=1)
    chunks = await _collect(mod, tail, None, polls=2)
    assert tail.polled[0] == 5 and _ids(chunks) == [6]


@pytest.mark.asyncio
async def test_reconnect_with_last_event_id_has_no_gap_and_no_duplicate(monkeypatch):
    mod = _load()
    monkeypatch.setattr(mod.asyncio, "sleep", lambda s: _never())
    tail = _Tail(n=3, grow=2)
    first = _ids(await _collect(mod, tail, 0, polls=2))       # 1..3, then 4..5
    # disconnect; events 6..7 land meanwhile (grow ran on last poll); reconnect with last id
    second = _ids(await _collect(mod, tail, first[-1], polls=1))
    assert first == [1, 2, 3, 4, 5]
    assert second[0] == first[-1] + 1
    assert sorted(set(first + second)) == list(range(1, max(second) + 1))


@pytest.mark.asyncio
async def test_frames_carry_task_event_id_and_row(monkeypatch):
    mod = _load()
    monkeypatch.setattr(mod.asyncio, "sleep", lambda s: _never())
    chunks = await _collect(mod, _Tail(n=1), 0, polls=1)
    frame = next(c for c in chunks if c.startswith("id: "))
    lines = frame.strip().split("\n")
    assert lines[0] == "id: 1" and lines[1] == "event: kanban"
    assert json.loads(lines[2][6:]) == {"id": 1, "task_id": "t", "run_id": None, "kind": "k",
                                        "payload": None, "created_at": 1}


def test_cursor_parsing_header_wins_and_garbage_is_none():
    mod = _load()
    assert mod._sse_cursor("42", "7") == 42
    assert mod._sse_cursor(None, "7") == 7
    assert mod._sse_cursor("latest", None) is None
    assert mod._sse_cursor("", "") is None


def test_route_streams_real_board_events_with_resume(monkeypatch):
    """End to end on the sandbox kanban.db through the plugin router (bare FastAPI harness)."""
    from contextlib import closing

    from fastapi import FastAPI
    from starlette.testclient import TestClient

    from hermes_cli import kanban_db
    from hermes_cli import kanban_db_connect as kbc

    mod = _load()
    monkeypatch.setattr(mod, "_SSE_MAX_POLLS", 1)
    kanban_db.init_db()
    with closing(kbc.connect()) as conn:
        kanban_db.create_task(conn, title="sse one")
        kanban_db.create_task(conn, title="sse two")
        ids = [int(r[0]) for r in conn.execute("SELECT id FROM task_events ORDER BY id").fetchall()]
    assert len(ids) >= 2
    app = FastAPI()
    app.include_router(mod.router, prefix="/api/plugins/kanban")
    c = TestClient(app)
    r = c.get("/api/plugins/kanban/events/stream", headers={"Last-Event-ID": str(ids[0])})
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/event-stream")
    got = _ids(r.text.split("\n\n"))
    assert got == ids[1:]
    # Reconnect from the last delivered id: nothing repeated, nothing new.
    r2 = c.get("/api/plugins/kanban/events/stream?last_event_id=" + str(got[-1]))
    assert _ids(r2.text.split("\n\n")) == []
