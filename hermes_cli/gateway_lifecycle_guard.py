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


def gateway_lifecycle_disabled(env: Mapping[str, str] | None = None) -> str | None:
    """Name of the variable that disables gateway lifecycle actions, or None when allowed."""
    source = os.environ if env is None else env
    for name in GUARD_ENV_VARS:
        if str(source.get(name, "")).strip().lower() in {"1", "true", "yes"}:
            return name
    return None


def refusal_detail(var: str) -> str:
    return f"{var}=1: this process never starts, stops, restarts or replaces a Hermes gateway"
