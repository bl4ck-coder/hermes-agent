"""S5: reversible retirement of the legacy write routes that bypass the A5 transaction / A6 policy path.

Default OFF: the routes keep working, because the regular Desktop Settings/Skills/Toolsets/Bots UI still
uses them. Enable retirement with ``HERMES_RETIRE_LEGACY_WRITES=1`` (env wins, ``0`` forces off) or
``ops.retire_legacy_writes: true`` in config.yaml. Retired routes answer 410 with a pointer to the A5 path.
Flip the flag back to restore them; nothing is deleted."""

from __future__ import annotations

import os

from fastapi import HTTPException

ENV_FLAG = "HERMES_RETIRE_LEGACY_WRITES"
_TRUE = {"1", "true", "yes", "on"}
_FALSE = {"0", "false", "no", "off"}

LEGACY_WRITE_ROUTES = (
    "PUT /api/config/raw",
    "PUT /api/profiles/{name}/soul",
    "PUT /api/profiles/{name}/description",
    "PUT /api/profiles/{name}/model",
    "PUT /api/skills/toggle",
    "PUT /api/tools/toolsets/{name}",
    "PUT /api/tools/toolsets/{name}/model",
    "PUT /api/tools/toolsets/{name}/provider",
    "PUT /api/tools/toolsets/{name}/env",
)


def legacy_writes_retired() -> bool:
    raw = os.environ.get(ENV_FLAG, "").strip().lower()
    if raw in _TRUE:
        return True
    if raw in _FALSE:
        return False
    try:
        from hermes_cli.config import load_config

        ops = (load_config() or {}).get("ops") or {}
        return bool(ops.get("retire_legacy_writes", False)) if isinstance(ops, dict) else False
    except Exception:
        return False


def legacy_write_gate() -> None:
    """FastAPI dependency: 410 when legacy writes are retired, no-op otherwise."""
    if legacy_writes_retired():
        raise HTTPException(
            status_code=410,
            detail={
                "code": "legacy_write_retired",
                "message": "This legacy write route is retired; use the Ops A5 transaction routes.",
                "flag": ENV_FLAG,
            },
        )
