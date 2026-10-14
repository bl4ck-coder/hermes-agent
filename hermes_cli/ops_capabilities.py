"""Ops capability tokens this backend ships (SPEC v2.1 3b). Published on the public /api/status as
``ops_capabilities`` so Desktop can decide in-window / degraded / incompatible without guessing from
route 404s. Static, no secrets, no paths. Add a token only in the same change that ships the route."""

from __future__ import annotations

from typing import List

OPS_CAPABILITIES_VERSION = 1

OPS_CAPABILITIES: List[str] = [
    "ops.fleet",
    "ops.fleet.stream",
    "ops.usage",
    "ops.approvals",
    "ops.delegation",
    "ops.tx.nodes.prompt",
    "ops.tx.nodes.model",
    "ops.tx.nodes.raw_yaml",
    "ops.tx.op_status",
    "ops.policy",
    "ops.policy.fail_closed",
    "ops.origin_guard",
    "kanban.events",
    "kanban.runs.stats",
    "kanban.attachments.page",
]


def ops_capabilities() -> dict:
    return {"version": OPS_CAPABILITIES_VERSION, "tokens": list(OPS_CAPABILITIES)}
