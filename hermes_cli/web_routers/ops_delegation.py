"""A4 read-only delegation projection (ops-panel P1-04): ``GET /api/ops/delegation?profile=``.

Contract: ``apps/desktop/docs/ops-panel/read-contracts.md`` section 7. Configured delegation
only: no child list, no session ids, no live sub-agents (those stay in the Desktop client store).
``api_key`` is never returned; ``api_key_set`` is a boolean. Empty ``model``/``provider`` means
inherit the parent; ``fallback_providers: null`` means inherit and ``[]`` means disabled.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter

from hermes_cli.web_routers._common import scoped_to_thread

router = APIRouter()


def project_delegation(profile: str, delegation: Any) -> Dict[str, Any]:
    d = delegation if isinstance(delegation, dict) else {}
    model = d.get("model") or None
    provider = d.get("provider") or None
    fallback = d.get("fallback_providers")
    if fallback is not None and not isinstance(fallback, list):
        fallback = None
    inherit_mcp = d.get("inherit_mcp_toolsets")
    return {
        "profile": profile,
        "model": model,
        "provider": provider,
        "inherit_model": model is None,
        "inherit_provider": provider is None,
        "fallback_providers": list(fallback) if isinstance(fallback, list) else None,
        "inherit_mcp_toolsets": inherit_mcp if isinstance(inherit_mcp, bool) else None,
        "api_key_set": bool(d.get("api_key")),
    }


def _launch_profile() -> str:
    from hermes_constants import get_process_hermes_home, profile_name_for_home
    return profile_name_for_home(get_process_hermes_home()) or "default"


@router.get("/api/ops/delegation")
async def get_delegation(profile: Optional[str] = None):
    from hermes_cli.config import load_config
    name = profile or _launch_profile()
    delegation = await scoped_to_thread(profile, lambda: (load_config() or {}).get("delegation"))
    return project_delegation(name, delegation)
