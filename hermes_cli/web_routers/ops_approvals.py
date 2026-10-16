"""A3 routes (ops-panel P1-03): ``GET /api/approvals/pending``, ``POST /api/approvals/respond``,
``GET /api/approvals/resolved``. Logic in :mod:`hermes_cli.ops_approvals`."""

from __future__ import annotations

import logging
import time
from contextlib import closing
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from hermes_cli import ops_approvals as A
from hermes_cli.ops_fleet import Observation

_log = logging.getLogger("hermes_cli.web_server")
router = APIRouter()


class ApprovalRespond(BaseModel):
    origin: str
    id: str
    session_id: Optional[str] = None
    choice: str


def _process_profile() -> str:
    from hermes_constants import get_process_hermes_home, profile_name_for_home
    return profile_name_for_home(get_process_hermes_home()) or "default"


def _read_kanban_items(board: Optional[str]) -> List[Dict[str, Any]]:
    from hermes_cli import kanban_db_connect as kbc
    with closing(kbc.connect(board=board)) as conn:
        rows = conn.execute(
            "SELECT id, title, status, assignee, tenant, session_id, created_at FROM tasks "
            "WHERE status IN ('blocked', 'review') ORDER BY created_at ASC").fetchall()
    return [A.kanban_item(dict(r)) for r in rows]


def list_pending(profile: Optional[str] = None, board: Optional[str] = None) -> Dict[str, Any]:
    me = _process_profile()
    items: List[Dict[str, Any]] = []
    sources: Dict[str, Optional[float]] = {}
    try:
        for session_key, entries in A.snapshot_queues().items():
            items.extend(A.jsonrpc_item(me, session_key, d) for d in entries)
        sources["jsonrpc"] = time.time()
    except Exception:
        _log.debug("approvals: queue snapshot failed", exc_info=True)
        sources["jsonrpc"] = None  # failed read never stamps observed_at
    try:
        items.extend(_read_kanban_items(board))
        sources["kanban"] = time.time()
    except Exception:
        _log.debug("approvals: kanban read failed", exc_info=True)
        sources["kanban"] = None
    if profile:
        items = [i for i in items if i.get("profile") == profile]
    return {"items": items, "observed_at": sources}


@router.get("/api/approvals/pending")
async def get_pending(profile: Optional[str] = None, board: Optional[str] = None):
    return await run_in_threadpool(list_pending, profile, board or None)


@router.post("/api/approvals/respond")
async def post_respond(body: ApprovalRespond):
    if body.origin != "jsonrpc":
        # gateway_run approvals are answered on that run (POST /v1/runs/{id}/approval, Bearer key)
        # and kanban/cron items are not tool approvals: no side effect is invented here.
        raise HTTPException(status_code=400, detail=f"origin {body.origin!r} is not routable from this connection")
    if not body.session_id:
        raise HTTPException(status_code=400, detail="session_id is required")
    try:
        return await run_in_threadpool(A.respond_jsonrpc, body.session_id, body.id, body.choice,
                                       profile=_process_profile())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/api/approvals/resolved")
async def get_resolved(limit: int = 50):
    return {"items": A.resolved_history(min(max(limit, 0), 200))}


def fleet_approvals_provider(profiles: List[str], board: Optional[str]) -> Dict[str, Observation]:
    """A1 input: fresh pending tool approvals per profile (jsonrpc origin = this process's profile).
    A failed snapshot raises, so A1 leaves the input missing instead of reporting an empty."""
    queues = A.snapshot_queues()
    now = time.time()
    me = _process_profile()
    pending = sum(len(v) for v in queues.values())
    out: Dict[str, Observation] = {}
    if me in profiles:
        out[me] = Observation(observed_at=now, reports_work=pending > 0)
    return out
