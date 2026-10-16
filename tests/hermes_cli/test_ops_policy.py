"""A6 policy P2 (ops-panel P2-01): SPEC 4.4 acceptance, D13 warn-vs-block, fail-closed override."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from hermes_cli import ops_policy as P

POL = P.BUILTIN_POLICY


def cfg(provider, model, **extra):
    m = {"provider": provider, "default": model}
    m.update(extra)
    return {"model": m}


@pytest.mark.parametrize(
    "provider,model,ok",
    [
        ("anthropic", "claude-opus-5-5", True),
        ("anthropic", "claude-haiku-5-5", True),
        ("openai-codex", "gpt-6.1-sol", True),
        ("openai-codex", "gpt-6.1-sol-900k", True),
        ("openai-codex", "gpt-6.1-sol-pro", True),
        ("xai-oauth", "grok-4.7", True),
        ("openrouter", "anthropic/claude-opus-5-5", False),
        ("openrouter", "claude-opus-5-5", False),
        ("xai-oauth", "grok-4.6", False),
        ("nous", "hermes-4", False),
        ("kimi-coding", "kimi-k2", False),
        ("custom", "claude-opus-5-5", False),
        ("bedrock", "claude-opus-5-5", False),
        ("openai-codex", "gpt-6.1", False),
        ("", "grok-4.7", False),
    ],
)
def test_spec_allowlist(provider, model, ok):
    assert (P.evaluate(POL, cfg(provider, model)) == []) is ok


def test_reasons_and_case_insensitive():
    assert P.evaluate(POL, cfg("OpenRouter", "claude-x"))[0].reason == "provider_not_allowed"
    assert P.evaluate(POL, cfg("xai-oauth", "grok-4.6"))[0].reason == "model_not_allowed"
    assert P.evaluate(POL, cfg("XAI-OAUTH", "Grok-4.7")) == []
    assert P.evaluate(POL, cfg("anthropic", ""))[0].reason == "missing_model"


def test_base_url_must_be_direct():
    assert P.evaluate(POL, cfg("anthropic", "claude-opus-5-5", base_url="https://api.anthropic.com")) == []
    assert P.evaluate(POL, cfg("xai-oauth", "grok-4.7", base_url="https://api.x.ai/v1")) == []
    assert P.evaluate(POL, cfg("xai-oauth", "grok-4.7", base_url="")) == []
    v = P.evaluate(POL, cfg("anthropic", "claude-opus-5-5", base_url="https://openrouter.ai/api/v1"))
    assert [x.reason for x in v] == ["base_url_proxy"]


def test_fallbacks_and_auxiliary_are_governed():
    c = cfg("xai-oauth", "grok-4.7")
    c["fallback_providers"] = [{"provider": "anthropic", "model": "claude-opus-5-5"}, "openrouter/laguna"]
    c["auxiliary"] = {
        "background_review": {"enabled": True, "provider": "opencode", "model": "mimo"},
        "vision": {"provider": "auto", "model": ""},
        "compression": {"provider": "main", "model": "grok-4.6"},
        "tts": "ignored",
    }
    fields = sorted(v.field for v in P.evaluate(POL, c))
    assert fields == ["auxiliary.background_review", "auxiliary.compression", "fallback_providers[1]"]


def test_d13_new_violation_blocks_existing_only_warns():
    violating = cfg("openrouter", "laguna")
    violating["agent"] = {"max_turns": 10}
    unrelated = dict(violating, agent={"max_turns": 20})
    r = P.check_change(POL, violating, unrelated)
    assert r["ok"] is True and r["blocked"] == [] and len(r["warnings"]) == 1
    r = P.check_change(POL, cfg("xai-oauth", "grok-4.7"), cfg("xai-oauth", "grok-4.6"))
    assert r["ok"] is False and r["blocked"][0]["reason"] == "model_not_allowed"
    # swapping one violation for another is a new selection: blocked
    r = P.check_change(POL, violating, cfg("openrouter", "other"))
    assert r["ok"] is False
    assert P.check_change(POL, violating, cfg("openai-codex", "gpt-6.1-sol-pro"))["ok"] is True


def write_policy(home: Path, data) -> None:
    (home / P.POLICY_FILE).write_text(data if isinstance(data, str) else yaml.safe_dump(data), encoding="utf-8")


def test_builtin_when_absent_and_override_when_valid(tmp_path):
    load = P.load_policy(tmp_path)
    assert (load.source, load.error, load.policy["enabled"]) == ("builtin", None, True)
    custom = {"version": 2, "enabled": True, "deny_default": True,
              "allow": [{"provider": "xai-oauth", "models": ["grok-4.7"]}]}
    write_policy(tmp_path, custom)
    load = P.load_policy(tmp_path)
    assert load.source == "file" and load.error is None
    assert P.evaluate(load.policy, cfg("anthropic", "claude-opus-5-5"))[0].reason == "provider_not_allowed"
    # SPEC v2.1 1.6 restrict-only: disabling enforcement would enlarge the allowlist -> invalid, fail closed.
    write_policy(tmp_path, dict(custom, enabled=False))
    load = P.load_policy(tmp_path)
    assert load.source == "invalid" and load.fail_closed and P.evaluate(load.policy, cfg("nous", "x"))


@pytest.mark.parametrize(
    "bad",
    [
        "version: 2\nenabled: true\nallow: [\n",
        {"version": 1, "enabled": True, "deny_default": True, "allow": [{"provider": "x", "models": ["y"]}]},
        {"version": 2, "enabled": True, "deny_default": False, "allow": [{"provider": "x", "models": ["y"]}]},
        {"version": 2, "enabled": "yes", "deny_default": True, "allow": [{"provider": "x", "models": ["y"]}]},
        {"version": 2, "enabled": True, "deny_default": True, "allow": []},
        {"version": 2, "enabled": True, "deny_default": True, "allow": [{"provider": "x", "models": ["y"]}],
         "enforcement": {"on_select_disallowed": "warn"}},
        {"version": 2, "enabled": True, "deny_default": True, "scope": "some", "allow": [{"provider": "x", "models": ["y"]}]},
    ],
)
def test_invalid_override_fails_closed_to_builtin(tmp_path, bad):
    write_policy(tmp_path, bad)
    load = P.load_policy(tmp_path)
    assert load.source == "invalid" and load.error and load.fail_closed and load.policy["enabled"] is True
    assert P.evaluate(load.policy, cfg("nous", "x"))


def test_production_baseline_shapes_are_compliant():
    # Shapes seen on the 2026-10-12 baseline (SPEC section 0): all compliant.
    base = [
        cfg("anthropic", "claude-opus-5-5", base_url="https://api.anthropic.com", api_mode="anthropic_messages"),
        cfg("xai-oauth", "grok-4.7", base_url="https://api.x.ai/v1", api_mode="codex_responses"),
        cfg("openai-codex", "gpt-6.1-sol"),
    ]
    base[0]["auxiliary"] = {"background_review": {"enabled": True, "provider": "anthropic", "model": "claude-opus-5-5"}}
    base[1]["fallback_providers"] = [{"provider": "anthropic", "model": "claude-opus-5-5"}]
    assert all(P.evaluate(POL, c) == [] for c in base)


# routes ----------------------------------------------------------------------------------

@pytest.fixture
def client():
    from starlette.testclient import TestClient

    from hermes_cli.web_server import _SESSION_HEADER_NAME, _SESSION_TOKEN, app

    c = TestClient(app)
    c.headers[_SESSION_HEADER_NAME] = _SESSION_TOKEN
    return c


@pytest.fixture
def root():
    from hermes_constants import get_default_hermes_root

    r = Path(get_default_hermes_root())
    r.mkdir(parents=True, exist_ok=True)
    yield r
    (r / P.POLICY_FILE).unlink(missing_ok=True)


def test_route_effective_policy_and_violations(client, root):
    (root / "config.yaml").write_text(yaml.safe_dump(cfg("openrouter", "laguna")), encoding="utf-8")
    body = client.get("/api/ops/policy", params={"profile": "default"}).json()
    assert body["source"] == "builtin" and body["enabled"] is True
    assert [v["reason"] for v in body["violations"]] == ["provider_not_allowed"]
    assert "violations" not in client.get("/api/ops/policy").json()


def test_route_check_pair_and_yaml(client, root):
    (root / "config.yaml").write_text(
        yaml.safe_dump(cfg("anthropic", "claude-opus-5-5", base_url="https://api.anthropic.com")), encoding="utf-8")
    ok = client.post("/api/ops/policy/check", json={"provider": "openai-codex", "model": "gpt-6.1-sol-pro"}).json()
    assert ok["ok"] is True  # provider switch drops the anthropic base_url
    bad = client.post("/api/ops/policy/check", json={"provider": "openrouter", "model": "claude-opus-5-5"}).json()
    assert bad["ok"] is False
    y = client.post("/api/ops/policy/check", json={"yaml_text": "model:\n  provider: xai-oauth\n  default: grok-4.6\n"})
    assert y.json()["ok"] is False
    assert client.post("/api/ops/policy/check", json={"yaml_text": "- a\n"}).status_code == 400
    assert client.post("/api/ops/policy/check", json={}).status_code == 400
    assert client.post("/api/ops/policy/check", json={"profile": "nope-missing", "provider": "a", "model": "b"}).status_code == 404
    # nothing was written
    assert yaml.safe_load((root / "config.yaml").read_text())["model"]["provider"] == "anthropic"
