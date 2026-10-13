"""A2 read routes (ops-panel P1-02).

``GET /api/ops/runs/{source}/{run_id}/usage`` (source = kanban | gateway) and
``GET /api/ops/usage/today``. No ``?profile=``/``?board=``/``?tenant=`` on the per-run route
(read-contracts.md 5.2). Decisions live in :mod:`hermes_cli.ops_usage`.
"""

from __future__ import annotations

import logging
from contextlib import closing
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from starlette.concurrency import run_in_threadpool

from hermes_cli.ops_usage import gateway_run_usage, kanban_run_usage, today_total

_log = logging.getLogger("hermes_cli.web_server")
router = APIRouter()

# Gateway run reader seam: run_id -> (status dict for that run or None, session_ids of OTHER
# known runs). The gateway's run table lives in the gateway process behind its Bearer key; the
# serve process has no sanctioned in-process reader, so the default reports "not observed" and
# A2 answers null/unknown rather than guessing. P1-06 (main-process proxy) can supply one.
GatewayReader = Callable[[str], Optional[Dict[str, Any]]]
gateway_reader: Optional[GatewayReader] = None


def _read_kanban_run(run_id: int) -> Optional[Dict[str, Any]]:
    from hermes_cli import kanban_db_connect as kbc
    with closing(kbc.connect()) as conn:
        row = conn.execute("SELECT id, task_id, profile FROM task_runs WHERE id = ?", (run_id,)).fetchone()
    return dict(row) if row else None


@router.get("/api/ops/runs/{source}/{run_id}/usage")
async def get_run_usage(source: str, run_id: str):
    if source == "kanban":
        try:
            rid = int(run_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="kanban run id must be an integer")
        row = await run_in_threadpool(_read_kanban_run, rid)
        if row is None:
            raise HTTPException(status_code=404, detail="run not found")
        return kanban_run_usage(row)
    if source == "gateway":
        reader = gateway_reader
        if reader is None:
            return gateway_run_usage(None)
        try:
            found = await run_in_threadpool(reader, run_id)
        except Exception:
            _log.debug("ops usage: gateway reader failed", exc_info=True)
            return gateway_run_usage(None)  # failed read: unknown, never 0
        if found is None:
            raise HTTPException(status_code=404, detail="run not found")
        others: List[Optional[str]] = list(found.get("other_run_session_ids") or [])
        return gateway_run_usage(found.get("status"), other_run_session_ids=others)
    raise HTTPException(status_code=400, detail="source must be 'kanban' or 'gateway'")


@router.get("/api/ops/usage/today")
async def get_usage_today(profile: Optional[str] = None):
    from hermes_cli.web_routers.analytics import _get_usage_analytics
    try:
        data = await run_in_threadpool(_get_usage_analytics, 1, profile)
    except Exception:
        _log.debug("ops usage: today-total read failed", exc_info=True)
        return today_total(None)
    return today_total((data or {}).get("totals"))
