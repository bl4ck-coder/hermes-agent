"""A3 approvals list + routed respond + resolved history (ops-panel P1-03).

Contract: ``apps/desktop/docs/ops-panel/read-contracts.md`` section 6.

Sources this serve process can read authoritatively:
* ``jsonrpc``: the in-process gateway approval queue (``tools.approval._gateway_queues``) used by
  this backend's chat sessions. Entries carry no pending clock, so ``expires_at``/``age_s`` are
  null (contract: do not guess).
* ``kanban_blocked`` / ``kanban_review``: kanban tasks, siblings in the list with ``[Review]``.

Dedupe: identity ``(connection, profile, session_id or run_id, request_id)``. The server count
from ``resolve_gateway_approval`` is the idempotency: a duplicate approve resolves 0 entries and
is reported ``resolved_elsewhere``; it never produces a second resolution. An ACK is never a
resolution.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional

REASON_NOT_RECORDED = "reason not recorded"
VALID_CHOICES = ("once", "session", "always", "deny")
CHOICE_ALIASES = {"approve": "once", "approved": "once", "allow": "once"}

_history_lock = threading.Lock()
_history: Deque[Dict[str, Any]] = deque(maxlen=200)


def normalize_choice(choice: str) -> Optional[str]:
    c = (choice or "").strip().lower()
    c = CHOICE_ALIASES.get(c, c)
    return c if c in VALID_CHOICES else None


def jsonrpc_item(profile: str, session_key: str, data: Dict[str, Any]) -> Dict[str, Any]:
    command = data.get("command") or None
    description = data.get("description") or None
    exact = ({"command": command, "pattern_keys": list(data.get("pattern_keys") or
                                                       ([data["pattern_key"]] if data.get("pattern_key") else []))}
             if command else None)
    return {
        "origin": "jsonrpc", "id": data.get("request_id"), "profile": profile,
        "session_id": session_key, "run_id": None, "tenant": None,
        "exact_request": exact,
        "why": description if (exact and description) else REASON_NOT_RECORDED,
        "what_for": description or REASON_NOT_RECORDED,
        "status": "pending", "expires_at": None, "age_s": None,
        "actions": ["approve", "deny"] if exact else ["review"],
    }


def kanban_item(row: Dict[str, Any]) -> Dict[str, Any]:
    status = row.get("status")
    created = row.get("created_at")
    return {
        "origin": "kanban_blocked" if status == "blocked" else "kanban_review",
        "id": row.get("id"), "profile": row.get("assignee") or None, "session_id": row.get("session_id"),
        "run_id": None, "tenant": row.get("tenant"), "exact_request": None,
        "why": REASON_NOT_RECORDED, "what_for": row.get("title") or REASON_NOT_RECORDED,
        "status": "pending", "expires_at": None,
        "age_s": (max(0.0, time.time() - float(created)) if isinstance(created, (int, float)) else None),
        "actions": ["review"],
    }


def snapshot_queues() -> Dict[str, List[Dict[str, Any]]]:
    """Copy of every in-process pending approval by session key (read under the approval lock)."""
    from tools import approval as _approval
    with _approval._lock:
        return {k: [dict(e.data) for e in q] for k, q in _approval._gateway_queues.items() if q}


def respond_jsonrpc(session_key: str, request_id: str, choice: str, *, profile: str) -> Dict[str, Any]:
    """Resolve exactly one pending approval by ``request_id`` (never FIFO, never ``all``). The
    returned ``resolved`` is the server count; 0 means it was already settled elsewhere."""
    from tools import approval as _approval
    norm = normalize_choice(choice)
    if norm is None:
        raise ValueError(f"invalid choice {choice!r}")
    if not request_id:
        raise ValueError("request_id is required")
    resolved = _approval.resolve_gateway_approval(session_key, norm, request_id=request_id)
    outcome = "resolved" if resolved > 0 else "resolved_elsewhere"
    if resolved > 0:
        with _history_lock:
            _history.appendleft({"origin": "jsonrpc", "id": request_id, "profile": profile,
                                 "session_id": session_key, "choice": norm, "resolved_at": time.time(),
                                 "status": "resolved"})
    return {"resolved": resolved, "outcome": outcome, "choice": norm}


def resolved_history(limit: int = 50) -> List[Dict[str, Any]]:
    with _history_lock:
        return list(_history)[: max(0, limit)]


def _reset_history_for_tests() -> None:
    with _history_lock:
        _history.clear()
