"""Kanban plugin: Ops read aggregates (run stats per profile, board-wide attachment paging)."""

from __future__ import annotations

import importlib.util
import sys
import time
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from hermes_cli import kanban_db as kb
from hermes_cli import kanban_db_connect as kbc


def _load_plugin_router():
    repo_root = Path(__file__).resolve().parents[2]
    plugin_file = repo_root / "plugins" / "kanban" / "dashboard" / "plugin_api.py"
    spec = importlib.util.spec_from_file_location("hermes_kanban_plugin_ops_lists_test", plugin_file)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod.router


@pytest.fixture
def kanban_home(tmp_path, monkeypatch):
    home = tmp_path / ".hermes"
    home.mkdir()
    monkeypatch.setenv("HERMES_HOME", str(home))
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    kb.init_db()
    return home


@pytest.fixture
def api(kanban_home):
    app = FastAPI()
    app.include_router(_load_plugin_router(), prefix="/api/plugins/kanban")
    return TestClient(app)


def _run(conn, task_id, profile, started_at, ended_at=None, outcome=None):
    conn.execute(
        "INSERT INTO task_runs (task_id, profile, status, started_at, ended_at, outcome) VALUES (?, ?, ?, ?, ?, ?)",
        (task_id, profile, "done" if ended_at else "running", started_at, ended_at, outcome))
    conn.commit()


def test_run_stats_counts_runs_per_profile_since(kanban_home, api):
    now = int(time.time())
    conn = kbc.connect()
    try:
        a = kb.create_task(conn, title="A", assignee="builder")
        b = kb.create_task(conn, title="B", assignee="pixel")
        _run(conn, a, "builder", now - 100, now - 50, "completed")
        _run(conn, a, "builder", now - 40, now - 10, "crashed")
        _run(conn, a, "builder", now - 30 * 86400, now - 30 * 86400 + 5, "completed")
        _run(conn, b, None, now - 20)
    finally:
        conn.close()
    r = api.get(f"/api/plugins/kanban/runs/stats?since={now - 7 * 86400}")
    assert r.status_code == 200
    body = r.json()
    assert body["profiles"]["builder"] == {"runs": 2, "failed": 1, "last_started_at": now - 40}
    # A run without a profile is credited to the task assignee.
    assert body["profiles"]["pixel"]["runs"] == 1
    assert body["profiles"]["pixel"]["failed"] == 0
    assert body["total"] == 3
    assert api.get("/api/plugins/kanban/runs/stats?since=-1").status_code == 422


def test_attachments_are_listed_board_wide_newest_first_with_paging(kanban_home, api, tmp_path):
    conn = kbc.connect()
    try:
        t1 = kb.create_task(conn, title="Spec")
        t2 = kb.create_task(conn, title="Logo")
        ids = [kb.add_attachment(conn, t1 if i % 2 else t2, filename=f"f{i}.txt", stored_path=str(tmp_path / f"f{i}"), size=i, uploaded_by="ops")
               for i in range(5)]
    finally:
        conn.close()
    first = api.get("/api/plugins/kanban/attachments?limit=2").json()
    assert [a["id"] for a in first["attachments"]] == [ids[4], ids[3]]
    assert first["attachments"][0]["task_title"] == "Logo"
    assert first["next_before_id"] == ids[3]
    second = api.get(f"/api/plugins/kanban/attachments?limit=2&before_id={first['next_before_id']}").json()
    assert [a["id"] for a in second["attachments"]] == [ids[2], ids[1]]
    last = api.get(f"/api/plugins/kanban/attachments?limit=2&before_id={second['next_before_id']}").json()
    assert [a["id"] for a in last["attachments"]] == [ids[0]]
    assert last["next_before_id"] is None
    assert api.get("/api/plugins/kanban/attachments?limit=500").status_code == 422
