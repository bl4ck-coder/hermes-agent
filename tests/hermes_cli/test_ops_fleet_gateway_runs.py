"""B10: the gateway-runs presence input comes from the gateway runtime heartbeat (active_agents)."""

from __future__ import annotations

import pytest

import hermes_cli.web_routers.ops_fleet as fleet
from hermes_cli.ops_fleet import Observation, decide_presence


def _gw(active, *, running=True, stale=None, home="H"):
    return {"gateway_running": running, "gateway_heartbeat_stale_s": stale,
            "gateway_updated_at": "2026-10-14T12:00:00+00:00",
            "runtime": {"active_agents": active, "hermes_home": home}}


@pytest.fixture
def home(monkeypatch):
    monkeypatch.setattr(fleet, "_same_home", lambda a, profile: a == "H" and profile == "default")


def test_zero_is_authoritative_empty_for_every_profile(home):
    for p in ("default", "other"):
        o = fleet.gateway_runs_observation(_gw(0), p, 1000.0)
        assert o is not None and o.observed_at == 1000.0 and o.reports_work is False


def test_positive_is_work_only_for_the_gateway_home_profile(home):
    o = fleet.gateway_runs_observation(_gw(2), "default", 1000.0)
    assert o.reports_work is True and o.detail["active_agents"] == 2
    assert fleet.gateway_runs_observation(_gw(2), "other", 1000.0) is None


@pytest.mark.parametrize("gw", [_gw(0, running=False), _gw(0, stale=42.0), {"gateway_running": True, "runtime": {}},
                                {"gateway_running": True}])
def test_stopped_stale_or_uncounted_is_missing(home, gw):
    assert fleet.gateway_runs_observation(gw, "default", 1000.0) is None


def test_idle_reachable_with_fresh_empties():
    now = 1000.0
    empty = Observation(observed_at=now)
    inputs = {"approvals": empty, "kanban_workers": empty, "blocked_tasks": empty, "gateway_runs": empty,
              "gateway_up": Observation(observed_at=now, up=True)}
    assert decide_presence(inputs, now).presence == "idle"
    inputs.pop("gateway_runs")
    assert decide_presence(inputs, now).presence == "unknown"


def test_build_fleet_uses_the_heartbeat_runs_input(monkeypatch):
    import asyncio

    monkeypatch.setattr(fleet, "_profile_names", lambda: ["default", "other"])
    monkeypatch.setattr(fleet, "_clock", lambda: 1000.0)
    monkeypatch.setattr(fleet, "_read_kanban", lambda b: {"workers": [], "blocked": {}, "observed_at": 1000.0})
    monkeypatch.setattr(fleet, "_read_cron", lambda p: {"observed_at": 1000.0, "next_run_at": None})
    monkeypatch.setattr(fleet, "EXTRA_INPUT_PROVIDERS", {
        "approvals": lambda ps, b: {p: Observation(observed_at=1000.0) for p in ps}})

    async def gw(profile):
        up = Observation(observed_at=1000.0, up=True)
        up.detail["gateway_runs"] = Observation(observed_at=1000.0, reports_work=profile == "default")
        return up

    monkeypatch.setattr(fleet, "_read_gateway", gw)
    by = {p["profile"]: p for p in asyncio.run(fleet.build_fleet())["profiles"]}
    assert by["default"]["presence"] == "working"
    assert by["other"]["presence"] == "idle"
    assert by["other"]["inputs"]["gateway_runs"] == {"observed_at": 1000.0, "event_at": None}


def test_registered_provider_still_wins(monkeypatch):
    import asyncio

    monkeypatch.setattr(fleet, "_profile_names", lambda: ["a"])
    monkeypatch.setattr(fleet, "_clock", lambda: 1000.0)
    monkeypatch.setattr(fleet, "_read_kanban", lambda b: {"workers": [], "blocked": {}, "observed_at": 1000.0})
    monkeypatch.setattr(fleet, "_read_cron", lambda p: {"observed_at": 1000.0, "next_run_at": None})
    monkeypatch.setattr(fleet, "EXTRA_INPUT_PROVIDERS", {
        "approvals": lambda ps, b: {"a": Observation(observed_at=1000.0)},
        "gateway_runs": lambda ps, b: {"a": Observation(observed_at=1000.0, reports_work=True)}})

    async def gw(profile):
        up = Observation(observed_at=1000.0, up=True)
        up.detail["gateway_runs"] = Observation(observed_at=1000.0)
        return up

    monkeypatch.setattr(fleet, "_read_gateway", gw)
    assert asyncio.run(fleet.build_fleet())["profiles"][0]["presence"] == "working"
