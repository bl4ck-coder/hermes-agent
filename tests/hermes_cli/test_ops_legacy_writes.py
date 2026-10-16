"""S5: legacy write routes retire behind a reversible flag (default off)."""

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from hermes_cli import legacy_writes
from hermes_cli.legacy_writes import ENV_FLAG, LEGACY_WRITE_ROUTES, legacy_write_gate, legacy_writes_retired


@pytest.fixture
def no_config(monkeypatch):
    monkeypatch.delenv(ENV_FLAG, raising=False)
    import hermes_cli.config as cfg

    monkeypatch.setattr(cfg, "load_config", lambda *a, **k: {})


def _app():
    app = FastAPI()

    @app.put("/x", dependencies=[Depends(legacy_write_gate)])
    def x():
        return {"ok": True}

    return TestClient(app)


def test_default_off(no_config):
    assert legacy_writes_retired() is False
    assert _app().put("/x").status_code == 200


@pytest.mark.parametrize("v", ["1", "true", "YES", "on"])
def test_env_on_retires(no_config, monkeypatch, v):
    monkeypatch.setenv(ENV_FLAG, v)
    r = _app().put("/x")
    assert r.status_code == 410
    assert r.json()["detail"]["code"] == "legacy_write_retired"


def test_reversible(no_config, monkeypatch):
    c = _app()
    monkeypatch.setenv(ENV_FLAG, "1")
    assert c.put("/x").status_code == 410
    monkeypatch.setenv(ENV_FLAG, "0")
    assert c.put("/x").status_code == 200


@pytest.mark.parametrize("v", ["", "0", "false", "off", "nope"])
def test_falsy_values_keep_routes(no_config, monkeypatch, v):
    monkeypatch.setenv(ENV_FLAG, v)
    assert legacy_writes_retired() is False


def test_gate_never_reads_config(monkeypatch):
    import hermes_cli.config as cfg

    monkeypatch.setenv(ENV_FLAG, "0")

    def boom(*a, **k):
        raise AssertionError("gate must not read config")

    monkeypatch.setattr(cfg, "load_config", boom)
    assert _app().put("/x").status_code == 200


def test_every_legacy_route_is_gated():
    from hermes_cli.web_server import app

    gated = set()
    for route in app.routes:
        deps = [d.call for d in getattr(getattr(route, "dependant", None), "dependencies", [])]
        if legacy_write_gate in deps:
            for m in route.methods:
                gated.add(f"{m} {route.path}")
    assert set(LEGACY_WRITE_ROUTES) <= gated
    # read routes and A5 transaction routes stay ungated
    assert not any(g.startswith("GET ") for g in gated)


def test_capability_token():
    from hermes_cli.ops_capabilities import ops_capabilities

    caps = ops_capabilities()
    assert "ops.legacy_writes.flag" in caps["tokens"]
    assert isinstance(caps["legacy_writes_retired"], bool)
