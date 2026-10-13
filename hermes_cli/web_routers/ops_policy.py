"""A6 routes (ops-panel P2-01): effective policy read + dry-run check.

``GET /api/ops/policy[?profile=]`` returns the effective policy, its source, any override
error, and the profile's current violations (D13 Policy chip).
``POST /api/ops/policy/check`` validates a candidate config (``yaml_text``) or a single
``provider``/``model`` pair against the profile's current config without writing anything.
"""

from __future__ import annotations

from typing import Optional

import yaml
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from hermes_cli import ops_policy


def _norm(value) -> str:
    return str(value or "").strip()

router = APIRouter()


class PolicyCheck(BaseModel):
    profile: Optional[str] = None
    yaml_text: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None


def _profile_home(profile: Optional[str]):
    try:
        return ops_policy.profile_home(profile)[1]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="profile not found")


def _read_cfg(home) -> dict:
    path = home / "config.yaml"
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8-sig"))
    return data if isinstance(data, dict) else {}


@router.get("/api/ops/policy")
async def get_policy(profile: Optional[str] = None):
    def _run():
        load = ops_policy.load_policy()
        out = {
            "source": load.source,
            "error": load.error,
            "enabled": load.policy["enabled"],
            "deny_default": load.policy["deny_default"],
            "allow": ops_policy.allowed_pairs(load.policy),
            "enforcement": load.policy["enforcement"],
        }
        if profile is not None:
            home = _profile_home(profile)
            try:
                cfg = _read_cfg(home)
            except yaml.YAMLError:
                out["violations"] = None
                out["config_error"] = "config.yaml does not parse"
                return out
            out["violations"] = ops_policy.violations_json(ops_policy.evaluate(load.policy, cfg))
        return out

    return await run_in_threadpool(_run)


@router.post("/api/ops/policy/check")
async def check_policy(body: PolicyCheck):
    def _run():
        policy = ops_policy.load_policy().policy
        home = _profile_home(body.profile)
        try:
            before = _read_cfg(home)
        except yaml.YAMLError:
            before = {}
        if body.yaml_text is not None:
            try:
                after = yaml.safe_load(body.yaml_text)
            except yaml.YAMLError as exc:
                raise HTTPException(status_code=400, detail=f"Invalid YAML: {exc}")
            if not isinstance(after, dict):
                raise HTTPException(status_code=400, detail="YAML must be a mapping")
        elif body.provider is not None and body.model is not None:
            after = dict(before)
            model = dict(before.get("model") or {}) if isinstance(before.get("model"), dict) else {}
            if _norm(model.get("provider")) != body.provider.strip():
                # A provider switch drops the old endpoint settings (same as the P2-03 model write).
                model.pop("base_url", None)
                model.pop("api_mode", None)
            model.update({"provider": body.provider.strip(), "default": body.model.strip()})
            after["model"] = model
        else:
            raise HTTPException(status_code=400, detail="yaml_text or provider+model required")
        return ops_policy.check_change(policy, before, after)

    return await run_in_threadpool(_run)
