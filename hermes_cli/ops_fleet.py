"""A1 fleet presence gate (ops-panel P1-01).

Pure, side-effect-free implementation of the presence gate frozen in
``apps/desktop/docs/ops-panel/read-contracts.md`` section 5.1. One gate, first
match, one output. The router in ``web_routers/ops_fleet.py`` gathers the
observations; this module only decides.

Clocks: ``observed_at`` is the completion time of a SUCCESSFUL read (never a
failed-read time, never the producer ``updated_at``); ``event_at`` is producer
write time and never enters the gate.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

FRESH_WINDOW_S = 5.0

# Work-bearing input keys (gateway-up is NOT work-bearing).
WORK_INPUTS = ("approvals", "kanban_workers", "gateway_runs", "blocked_tasks")
GATEWAY_UP = "gateway_up"
PRESENCE_INPUTS = WORK_INPUTS + (GATEWAY_UP,)

PRESENCE_VALUES = ("working", "needs_you", "blocked", "idle", "offline", "unknown", "stale")


@dataclass
class Observation:
    """One input for one profile.

    ``observed_at`` None means missing (no successful observation).
    For work-bearing inputs ``reports_work`` says whether the body of that
    successful read reports work (False = authoritative empty).
    For gateway-up, ``up`` is the liveness and ``platforms_unreachable`` is True
    when platforms are configured and the backend cannot reach them.
    """

    observed_at: Optional[float] = None
    event_at: Optional[float] = None
    reports_work: bool = False
    up: bool = False
    platforms_unreachable: bool = False
    detail: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Decision:
    presence: str
    precedence: str
    freshness_s: Optional[float]
    sub_state: Optional[str] = None
    deciding_input: Optional[str] = None
    event_at: Optional[float] = None
    observed_at: Optional[float] = None


def _age(obs: Observation, now: float) -> Optional[float]:
    return None if obs.observed_at is None else max(0.0, now - obs.observed_at)


def is_fresh(obs: Optional[Observation], now: float) -> bool:
    return obs is not None and obs.observed_at is not None and (now - obs.observed_at) <= FRESH_WINDOW_S


def is_old(obs: Optional[Observation], now: float) -> bool:
    return obs is not None and obs.observed_at is not None and (now - obs.observed_at) > FRESH_WINDOW_S


def decide_presence(inputs: Dict[str, Observation], now: float) -> Decision:
    """Apply rules 1-4 of read-contracts.md 5.1 and return exactly one output."""
    # A missing input is an Observation with observed_at=None (no successful observation).
    obs: Dict[str, Observation] = {k: inputs.get(k) or Observation() for k in PRESENCE_INPUTS}

    def mk(presence: str, precedence: str, key: Optional[str], sub: Optional[str] = None) -> Decision:
        o = obs[key] if key else None
        return Decision(presence=presence, precedence=precedence,
                        freshness_s=_age(o, now) if o else None, sub_state=sub, deciding_input=key,
                        event_at=o.event_at if o else None, observed_at=o.observed_at if o else None)

    # Rule 1: every presence input missing -> unknown (never idle).
    if all(o.observed_at is None for o in obs.values()):
        return mk("unknown", "missing", None)

    # Rule 2: an OLD work-bearing observation whose body still reports work -> stale.
    # A fresh gateway-up never overrides this. Deciding input = the oldest such observation.
    old_work = [k for k in WORK_INPUTS if is_old(obs[k], now) and obs[k].reports_work]
    if old_work:
        key = max(old_work, key=lambda k: _age(obs[k], now) or 0.0)
        return mk("stale", "stale", key)

    # Rule 3: only fresh inputs may select an operational state.
    def fresh_work(k: str) -> bool:
        return is_fresh(obs[k], now) and obs[k].reports_work

    if fresh_work("approvals"):
        return mk("needs_you", "needs_you", "approvals", "waiting_approval")
    for k in ("kanban_workers", "gateway_runs"):
        if fresh_work(k):
            return mk("working", "working", k, obs[k].detail.get("sub_state"))
    if fresh_work("blocked_tasks"):
        return mk("blocked", "blocked", "blocked_tasks")
    gw = obs[GATEWAY_UP]
    if is_fresh(gw, now) and gw.up and all(
            is_fresh(obs[k], now) and not obs[k].reports_work for k in WORK_INPUTS):
        # Deciding clock for idle: the oldest of the fresh inputs that licensed it.
        key = max(PRESENCE_INPUTS, key=lambda k: _age(obs[k], now) or 0.0)
        return mk("idle", "idle", key)
    if is_fresh(gw, now) and not gw.up and gw.platforms_unreachable:
        return mk("offline", "offline", GATEWAY_UP)

    # Rule 4: otherwise unknown (owns old gateway-up with no work and old authoritative empty).
    present = [k for k in PRESENCE_INPUTS if obs[k].observed_at is not None]
    key = max(present, key=lambda k: _age(obs[k], now) or 0.0) if present else None
    return mk("unknown", "unknown", key)


def profile_result(profile: str, inputs: Dict[str, Observation], now: float, *,
                   next_run_at: Optional[float], active_runs: List[Dict[str, Any]]) -> Dict[str, Any]:
    d = decide_presence(inputs, now)
    observed = [o.observed_at for o in inputs.values() if o is not None and o.observed_at is not None]
    return {
        "profile": profile,
        "presence": d.presence,
        "sub_state": d.sub_state,
        # Profile-level observed_at: the deciding input's successful observation, else the newest
        # successful observation of any input (still a successful read, never a failure time).
        "observed_at": d.observed_at if d.observed_at is not None else (max(observed) if observed else None),
        "event_at": d.event_at,
        "freshness_s": d.freshness_s,
        "next_run_at": next_run_at,
        "active_runs": active_runs,
        "precedence": d.precedence,
        "inputs": {k: ({"observed_at": o.observed_at, "event_at": o.event_at}
                       if o is not None and o.observed_at is not None else None)
                   for k, o in ((k, inputs.get(k)) for k in PRESENCE_INPUTS + ("cron",))},
    }
