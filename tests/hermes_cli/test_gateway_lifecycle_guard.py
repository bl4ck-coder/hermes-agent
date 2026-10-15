"""HERMES_OPS_NO_GATEWAY / HERMES_DESKTOP_ISOLATED_BACKEND: a test or capture run never starts,
stops, restarts or replaces a gateway (the 2026-10-14 incident: a trial checkout replaced the
user's real gateway). Every lifecycle boundary is patched to fail loudly if reached."""
from types import SimpleNamespace

import pytest

from hermes_cli import gateway_lifecycle_guard as guard
from hermes_cli import gateway_runtime as runtime
from hermes_cli.gateway_runtime import GatewayDiscovery, GatewayEndpoint

GUARD_VARS = guard.GUARD_ENV_VARS


def _forbid_lifecycle(monkeypatch):
    from hermes_cli import gateway_runtime_replace, gateway_runtime_service, gateway_runtime_start

    def boom(*_a, **_k):
        raise AssertionError("gateway lifecycle action reached under the guard")

    monkeypatch.setattr(gateway_runtime_replace, "replace_incompatible_owner", boom)
    monkeypatch.setattr(gateway_runtime_service, "start_existing_gateway_service", boom)
    monkeypatch.setattr(gateway_runtime_service, "discover_existing_gateway_service", boom)
    monkeypatch.setattr(gateway_runtime_start, "spawn_unmanaged_gateway", boom)


@pytest.fixture
def clean_env(monkeypatch):
    for name in GUARD_VARS:
        monkeypatch.delenv(name, raising=False)
    return monkeypatch


def _arm(env, var):
    """Set *var*; the isolated flag only guards the native home, so point HERMES_HOME there."""
    env.setenv(var, "1")
    if var == "HERMES_DESKTOP_ISOLATED_BACKEND":
        from hermes_constants import _get_platform_default_hermes_home

        env.setenv("HERMES_HOME", str(_get_platform_default_hermes_home()))


@pytest.mark.parametrize("var", GUARD_VARS)
def test_guard_reads_either_variable(clean_env, var):
    assert guard.gateway_lifecycle_disabled() is None
    _arm(clean_env, var)
    assert guard.gateway_lifecycle_disabled() == var
    assert guard.gateway_lifecycle_disabled({var: "0"}) is None


@pytest.mark.parametrize("var", GUARD_VARS)
def test_ensure_never_spawns_an_absent_owner(clean_env, tmp_path, var):
    _arm(clean_env, var)
    _forbid_lifecycle(clean_env)
    clean_env.setattr(runtime, "discover_gateway_endpoint", lambda home, timeout: GatewayDiscovery("absent"))
    result = runtime.ensure_gateway_runtime(tmp_path, timeout=5)
    assert result.state == "absent"
    assert result.reason_code == guard.REASON_CODE
    assert var in (result.detail or "")


def test_ensure_never_replaces_an_incompatible_owner(clean_env, tmp_path):
    clean_env.setenv("HERMES_OPS_NO_GATEWAY", "1")
    _forbid_lifecycle(clean_env)
    clean_env.setattr(runtime, "discover_gateway_endpoint",
                      lambda home, timeout: GatewayDiscovery("incompatible", reason_code="runtime_protocol"))
    result = runtime.ensure_gateway_runtime(tmp_path, timeout=5)
    assert result.state == "incompatible" and result.reason_code == guard.REASON_CODE


def test_ensure_reports_a_ready_owner_read_only(clean_env, tmp_path):
    clean_env.setenv("HERMES_DESKTOP_ISOLATED_BACKEND", "1")
    _forbid_lifecycle(clean_env)
    endpoint = GatewayEndpoint(profile_id=str(tmp_path), instance_id="i", authority_epoch=1, runtime_protocol=1,
                               api_origin="http://127.0.0.1:8642", supervisor="none",
                               capabilities=frozenset({"session-authority-v1"}))
    ready = GatewayDiscovery("ready", endpoint)
    clean_env.setattr(runtime, "discover_gateway_endpoint", lambda home, timeout: ready)
    assert runtime.ensure_gateway_runtime(tmp_path, timeout=5) is ready


@pytest.mark.parametrize("verb", [None, "run", "start", "stop", "restart", "install", "uninstall", "setup", "migrate"])
def test_gateway_cli_refuses_lifecycle_verbs(clean_env, verb):
    from hermes_cli import gateway as gw

    clean_env.setenv("HERMES_OPS_NO_GATEWAY", "1")
    called = []
    clean_env.setitem(gw._GATEWAY_SUBCOMMANDS, verb, lambda args: called.append(verb))
    with pytest.raises(SystemExit) as exc:
        gw._gateway_command_inner(SimpleNamespace(gateway_command=verb))
    assert exc.value.code == 3 and called == []


def test_gateway_cli_keeps_read_only_verbs_and_unguarded_runs(clean_env):
    from hermes_cli import gateway as gw

    called = []
    for verb in ("status", "list", "restart"):
        clean_env.setitem(gw._GATEWAY_SUBCOMMANDS, verb, lambda args, v=verb: called.append(v))
    gw._gateway_command_inner(SimpleNamespace(gateway_command="restart"))  # no guard: unchanged behaviour
    clean_env.setenv("HERMES_OPS_NO_GATEWAY", "1")
    gw._gateway_command_inner(SimpleNamespace(gateway_command="status"))
    gw._gateway_command_inner(SimpleNamespace(gateway_command="list"))
    assert called == ["restart", "status", "list"]


def test_isolated_backend_only_guards_the_native_home(clean_env, tmp_path):
    """A sandbox home outside the user's Hermes root may own its gateway (hard-state captures);
    the native home stays guarded, and HERMES_OPS_NO_GATEWAY guards everything."""
    from hermes_constants import _get_platform_default_hermes_home

    native = _get_platform_default_hermes_home()
    sandbox = tmp_path / "ops-hard-home"
    iso = {"HERMES_DESKTOP_ISOLATED_BACKEND": "1"}
    assert guard.gateway_lifecycle_disabled({**iso, "HERMES_HOME": str(sandbox)}) is None
    assert guard.gateway_lifecycle_disabled({**iso, "HERMES_HOME": str(native)}) == "HERMES_DESKTOP_ISOLATED_BACKEND"
    assert guard.gateway_lifecycle_disabled({**iso, "HERMES_HOME": str(native / "profiles" / "x")}) == "HERMES_DESKTOP_ISOLATED_BACKEND"
    assert guard.gateway_lifecycle_disabled(iso) == "HERMES_DESKTOP_ISOLATED_BACKEND"
    assert guard.gateway_lifecycle_disabled({"HERMES_OPS_NO_GATEWAY": "1", "HERMES_HOME": str(sandbox)}) == "HERMES_OPS_NO_GATEWAY"
