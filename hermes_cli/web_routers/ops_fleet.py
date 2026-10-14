"""A1 ``GET /api/ops/fleet`` (ops-panel P1-01): read-only per-profile presence aggregate.

Contract: ``apps/desktop/docs/ops-panel/read-contracts.md`` section 5.1. The decision lives
in :mod:`hermes_cli.ops_fleet`; this router only performs the reads and stamps each
SUCCESSFUL read with its completion time (``observed_at``). A failed read leaves that input
missing, so a disconnect yields ``unknown``/``stale``, never a false ``idle``.

Inputs this serve process can observe today: kanban ``workers/active`` rows, assigned
``blocked`` tasks, gateway liveness per profile, and cron ``next_run_at``. Gateway run status
and pending approvals live in the gateway process; until a reader for them is wired they are
reported missing, which by contract forbids ``idle`` (rule 3.4) but never invents work.
"""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import closing
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from hermes_cli.ops_fleet import Observation, profile_result

_log = logging.getLogger("hermes_cli.web_server")
router = APIRouter()

# Optional extra input providers: name -> callable(profiles, board) -> {profile: Observation}.
# A3 (approvals) and gateway-run readers register here; tests use it as a seam.
EXTRA_INPUT_PROVIDERS: Dict[str, Callable[[List[str], Optional[str]], Dict[str, Observation]]] = {}

_clock: Callable[[], float] = time.time


def _to_epoch(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def _profile_names() -> List[str]:
    from hermes_cli.web_server_cron import _cron_profile_dicts
    names = [str(p.get("name") or "") for p in _cron_profile_dicts()]
    return [n for n in dict.fromkeys(names) if n]


def _read_kanban(board: Optional[str]) -> Dict[str, Any]:
    """One successful read of active workers + assigned blocked tasks. Raises on failure."""
    from hermes_cli import kanban_db_connect as kbc
    with closing(kbc.connect(board=board)) as conn:
        workers = [dict(r) for r in conn.execute(
            "SELECT r.id AS run_id, r.task_id, r.profile, t.assignee, r.started_at, r.last_heartbeat_at "
            "FROM task_runs r JOIN tasks t ON t.id = r.task_id "
            "WHERE r.ended_at IS NULL AND r.worker_pid IS NOT NULL AND t.status = 'running' "
            "ORDER BY r.started_at ASC").fetchall()]
        blocked = {str(r[0]): int(r[1]) for r in conn.execute(
            "SELECT assignee, COUNT(*) FROM tasks WHERE status = 'blocked' AND assignee IS NOT NULL "
            "AND assignee != '' GROUP BY assignee").fetchall()}
    return {"workers": workers, "blocked": blocked, "observed_at": _clock()}


async def _read_gateway(profile: str) -> Optional[Observation]:
    from hermes_cli.profiles import get_profile_dir
    from hermes_cli.web_routers.status import _resolve_gateway_status
    try:
        gw = await _resolve_gateway_status(get_profile_dir(profile), None)
    except Exception:
        _log.debug("ops fleet: gateway read failed for %s", profile, exc_info=True)
        return None  # missing: a failed read never stamps observed_at
    running = bool(gw.get("gateway_running"))
    observed = _clock()
    up = Observation(observed_at=observed, event_at=_to_epoch(gw.get("gateway_updated_at")),
                     up=running, platforms_unreachable=(not running and bool(gw.get("gateway_platforms"))))
    runs = gateway_runs_observation(gw, profile, observed)
    if runs is not None:
        up.detail["gateway_runs"] = runs
    return up


def _same_home(a: Any, profile: str) -> bool:
    import os
    from hermes_cli.profiles import get_profile_dir
    try:
        norm = lambda v: os.path.normcase(os.path.realpath(str(v))).rstrip("\\/")
        return bool(a) and norm(a) == norm(get_profile_dir(profile))
    except Exception:
        return False


def gateway_runs_observation(gw: Dict[str, Any], profile: str, observed_at: float) -> Optional[Observation]:
    """B10: the gateway-runs presence input (read-contracts 5.1), read from the gateway's own runtime
    heartbeat (``runtime.active_agents``, the counter NAS ``derive_gateway_busy`` gates on).

    Zero active agents on a live, non-stale gateway is an authoritative empty for every profile it
    serves. A positive count is not partitioned by profile, so it reports work only for the profile
    whose home the gateway runs under; any other profile stays missing (unknown) instead of guessed.
    A stopped or stale gateway, or a runtime without the counter, is missing - never an empty."""
    if not gw.get("gateway_running") or gw.get("gateway_heartbeat_stale_s"):
        return None
    runtime = gw.get("runtime") or {}
    if not isinstance(runtime, dict) or "active_agents" not in runtime:
        return None
    try:
        from gateway.status import parse_active_agents
        count = parse_active_agents(runtime.get("active_agents"))
    except Exception:
        return None
    event_at = _to_epoch(gw.get("gateway_updated_at"))
    if count == 0:
        return Observation(observed_at=observed_at, event_at=event_at, reports_work=False)
    if _same_home(runtime.get("hermes_home"), profile):
        return Observation(observed_at=observed_at, event_at=event_at, reports_work=True,
                           detail={"active_agents": count})
    return None


def _read_cron(profile: str) -> Optional[Dict[str, Any]]:
    from hermes_cli.web_server_cron import _call_cron_for_profile
    try:
        jobs = _call_cron_for_profile(profile, "list_jobs", True) or []
    except Exception:
        _log.debug("ops fleet: cron read failed for %s", profile, exc_info=True)
        return None
    nexts = [t for t in (_to_epoch(j.get("next_run_at")) for j in jobs
                         if isinstance(j, dict) and j.get("enabled", True)) if t is not None]
    return {"observed_at": _clock(), "next_run_at": min(nexts) if nexts else None}


async def build_fleet(board: Optional[str] = None) -> Dict[str, Any]:
    profiles = await run_in_threadpool(_profile_names)
    try:
        kanban = await run_in_threadpool(_read_kanban, board)
    except Exception:
        _log.debug("ops fleet: kanban read failed", exc_info=True)
        kanban = None
    if kanban:
        for w in kanban["workers"]:
            for name in (w.get("profile"), w.get("assignee")):
                if name and name not in profiles:
                    profiles.append(str(name))

    gateways = await asyncio.gather(*(_read_gateway(p) for p in profiles))
    crons = await asyncio.gather(*(run_in_threadpool(_read_cron, p) for p in profiles))
    extras: Dict[str, Dict[str, Observation]] = {}
    for key, provider in EXTRA_INPUT_PROVIDERS.items():
        try:
            extras[key] = await run_in_threadpool(provider, list(profiles), board) or {}
        except Exception:
            _log.debug("ops fleet: provider %s failed", key, exc_info=True)

    now = _clock()
    out = []
    for name, gw, cron in zip(profiles, gateways, crons):
        inputs: Dict[str, Observation] = {}
        runs: List[Dict[str, Any]] = []
        if kanban:
            mine = [w for w in kanban["workers"] if (w.get("profile") or w.get("assignee")) == name]
            runs = [{"source": "kanban", "id": w["run_id"], "task_id": w.get("task_id"),
                     "started_at": w.get("started_at")} for w in mine]
            beats = [_to_epoch(w.get("last_heartbeat_at") or w.get("started_at")) for w in mine]
            beats = [b for b in beats if b is not None]
            inputs["kanban_workers"] = Observation(observed_at=kanban["observed_at"], reports_work=bool(mine),
                                                   event_at=max(beats) if beats else None)
            inputs["blocked_tasks"] = Observation(observed_at=kanban["observed_at"],
                                                  reports_work=kanban["blocked"].get(name, 0) > 0)
        if gw is not None:
            inputs["gateway_up"] = gw
            if isinstance(gw.detail.get("gateway_runs"), Observation):
                inputs["gateway_runs"] = gw.detail["gateway_runs"]
        if cron is not None:
            inputs["cron"] = Observation(observed_at=cron["observed_at"])
        for key, per_profile in extras.items():
            if name in per_profile:
                inputs[key] = per_profile[name]
                for r in per_profile[name].detail.get("active_runs", []):
                    runs.append(r)
        out.append(profile_result(name, inputs, now, next_run_at=cron["next_run_at"] if cron else None,
                                  active_runs=runs))
    return {"profiles": out, "board": board, "now": now}


@router.get("/api/ops/fleet")
async def get_ops_fleet(board: Optional[str] = None):
    return await build_fleet(board or None)


# --- Push channel: GET /api/ops/fleet/stream (ops-panel P1-05) ---------------------------------
# Server-sent fleet snapshots for the Office and the Needs-you badge (D12: push first, the 5s
# poll is fallback only). A ``fleet`` message is sent on connect and whenever any profile's
# presence/sub_state/precedence/active runs change; a ``needs_you`` message carries the sorted
# profile list whenever that set changes. Each message's SSE id is a per-connection sequence.
_FLEET_PUSH_INTERVAL_S = 2.0
_FLEET_KEEPALIVE_S = 15.0
_FLEET_MAX_TICKS: Optional[int] = None  # test seam


def _fleet_signature(snapshot: Dict[str, Any]) -> Any:
    return tuple(sorted(
        (p["profile"], p["presence"], p.get("sub_state"), p.get("precedence"),
         tuple(sorted(str(r.get("id")) for r in p.get("active_runs") or [])))
        for p in snapshot.get("profiles", [])))


async def _fleet_events(board: Optional[str], is_disconnected: Callable[[], Any]):
    import json as _json
    seq = 0
    last_sig: Any = None
    last_needs: Any = None
    ticks = 0
    idle = 0.0
    yield "retry: 2000\n\n"
    while True:
        if await is_disconnected():
            return
        try:
            snap = await build_fleet(board)
        except Exception:
            _log.debug("ops fleet stream: build failed", exc_info=True)
            snap = None
        if snap is not None:
            sig = _fleet_signature(snap)
            if sig != last_sig:
                last_sig = sig
                seq += 1
                idle = 0.0
                yield f"id: {seq}\nevent: fleet\ndata: {_json.dumps(snap, separators=(',', ':'))}\n\n"
            needs = sorted(p["profile"] for p in snap["profiles"] if p["presence"] == "needs_you")
            if needs != last_needs:
                last_needs = needs
                seq += 1
                yield f"id: {seq}\nevent: needs_you\ndata: {_json.dumps({'profiles': needs})}\n\n"
        ticks += 1
        if _FLEET_MAX_TICKS is not None and ticks >= _FLEET_MAX_TICKS:
            return
        idle += _FLEET_PUSH_INTERVAL_S
        if idle >= _FLEET_KEEPALIVE_S:
            idle = 0.0
            yield ": keepalive\n\n"
        await asyncio.sleep(_FLEET_PUSH_INTERVAL_S)


@router.get("/api/ops/fleet/stream")
async def stream_ops_fleet(request: Request, board: Optional[str] = None):
    return StreamingResponse(_fleet_events(board or None, request.is_disconnected),
                             media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})
