"""Opt-out of every gateway lifecycle action for test, capture and isolated-Desktop runs.

A checkout used for tests or screenshot captures (``apps/desktop/scripts/ops-live``) can see
the user's REAL ``HERMES_HOME``. Without this guard ``hermes gateway ensure`` from that checkout
replaces an "incompatible" owner and starts a new one, and the Desktop restarts an owner whose
``code_sha`` differs from the checkout: the real gateway ends up running the checkout's code.

When any variable below is ``1`` this process (and the ``hermes`` children it spawns, which
inherit the environment) never starts, stops, restarts or replaces a gateway. Discovery stays
read-only: a ready owner is still reported, nothing else changes.
"""

from __future__ import annotations

import os
from typing import Mapping

GUARD_ENV_VARS = ("HERMES_OPS_NO_GATEWAY", "HERMES_DESKTOP_ISOLATED_BACKEND")
REASON_CODE = "gateway_lifecycle_disabled"

# ``hermes gateway <verb>`` verbs that only read state; every other verb (run, start, stop,
# restart, install, uninstall, setup, migrate...) can change which process owns a home.
READ_ONLY_VERBS = frozenset({"status", "list"})

_TRUE = {"1", "true", "yes"}


def _targets_native_home(source: Mapping[str, str]) -> bool:
    """True when HERMES_HOME is unset or lives under the user's real Hermes root.

    A sandbox home elsewhere (hard-state captures) owns its own gateway on its own port, so an
    isolated backend may manage that one; the user's real home is never touched.
    """
    from pathlib import Path

    from hermes_constants import _get_platform_default_hermes_home

    raw = str(source.get("HERMES_HOME", "")).strip()
    if not raw:
        return True
    native = _get_platform_default_hermes_home().resolve()
    try:
        Path(os.path.expandvars(os.path.expanduser(raw))).resolve().relative_to(native)
    except ValueError:
        return False
    return True


def gateway_lifecycle_disabled(env: Mapping[str, str] | None = None) -> str | None:
    """Name of the variable that disables gateway lifecycle actions, or None when allowed.

    ``HERMES_OPS_NO_GATEWAY=1`` always disables. ``HERMES_DESKTOP_ISOLATED_BACKEND=1`` disables only
    when the process targets the user's real Hermes home (the 2026-10-14 incident).
    """
    source = os.environ if env is None else env
    if str(source.get("HERMES_OPS_NO_GATEWAY", "")).strip().lower() in _TRUE:
        return "HERMES_OPS_NO_GATEWAY"
    if str(source.get("HERMES_DESKTOP_ISOLATED_BACKEND", "")).strip().lower() in _TRUE and _targets_native_home(source):
        return "HERMES_DESKTOP_ISOLATED_BACKEND"
    return None


def refusal_detail(var: str) -> str:
    return f"{var}=1: this process never starts, stops, restarts or replaces a Hermes gateway"
