"""S5: reversible retirement of the legacy write routes that bypass the A5 transaction / A6 policy path.

Default OFF: the routes keep working, because the regular Desktop Settings/Skills/Toolsets/Bots UI still
uses them. Enable retirement with ``HERMES_RETIRE_LEGACY_WRITES=1`` in the backend environment. Retired
routes answer 410 with a pointer to the A5 path. Unset it (or ``0``) to restore them; nothing is deleted.
Env-only on purpose: reading config.yaml per request would touch the profile config cache."""

from __future__ import annotations

import os

from fastapi import HTTPException

ENV_FLAG = "HERMES_RETIRE_LEGACY_WRITES"
_TRUE = {"1", "true", "yes", "on"}

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
    return os.environ.get(ENV_FLAG, "").strip().lower() in _TRUE


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
