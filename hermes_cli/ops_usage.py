"""A2 per-run usage with provenance (ops-panel P1-02).

Contract: ``apps/desktop/docs/ops-panel/read-contracts.md`` section 5.2 and section 10.
Rules: unknown is null, never 0; gateway session counters (zeros or ``usage={}``) keep
provenance ``gateway.session_counters`` and are never re-labelled as measured per-run tokens;
two runs sharing a session get ``shared-session`` with null tokens; a kanban run has no
per-run token store (O66 Cut), so it is always null / ``unknown``.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, Optional

PROV_UNKNOWN = "unknown"
PROV_GATEWAY_COUNTERS = "gateway.session_counters"
PROV_SHARED_SESSION = "shared-session"
PROV_TODAY = "analytics.usage:days=1"


def _tokens(value: Any) -> Optional[int]:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    return None


def usage_record(input_tokens: Optional[int], output_tokens: Optional[int], provenance: str,
                 session_id: Optional[str]) -> Dict[str, Any]:
    return {"input_tokens": input_tokens, "output_tokens": output_tokens,
            "provenance": provenance, "session_id": session_id}


def kanban_run_usage(run_row: Dict[str, Any]) -> Dict[str, Any]:
    """``task_runs`` has no token column and no session_id; ``metadata`` is not a usage
    contract. Always null tokens, provenance unknown."""
    return usage_record(None, None, PROV_UNKNOWN, None)


def gateway_run_usage(status: Optional[Dict[str, Any]], *,
                      other_run_session_ids: Iterable[Optional[str]] = ()) -> Dict[str, Any]:
    """Classify a gateway ``/v1/runs/{id}`` status dict.

    * no status / ``usage`` key absent -> null, ``unknown`` (absence is not 0)
    * ``session_id`` shared with another run -> null, ``shared-session``
    * ``usage == {}`` (live-owner settle) -> null, ``gateway.session_counters`` (do not sum)
    * ``usage`` with counters -> the counters, ``gateway.session_counters`` (unverified-measured;
      a coerced 0 is reported as the producer's 0 with that provenance, never as measured)
    """
    if not isinstance(status, dict):
        return usage_record(None, None, PROV_UNKNOWN, None)
    session_id = status.get("session_id") or None
    if session_id is not None and session_id in {s for s in other_run_session_ids if s}:
        return usage_record(None, None, PROV_SHARED_SESSION, session_id)
    if "usage" not in status or not isinstance(status.get("usage"), dict):
        return usage_record(None, None, PROV_UNKNOWN, session_id)
    usage = status["usage"]
    if not usage:
        return usage_record(None, None, PROV_GATEWAY_COUNTERS, session_id)
    return usage_record(_tokens(usage.get("input_tokens")), _tokens(usage.get("output_tokens")),
                        PROV_GATEWAY_COUNTERS, session_id)


def today_total(totals: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Status-bar today-total from ``/api/analytics/usage?days=1`` totals. A missing store or a
    NULL SUM (no sessions) stays null. Never added onto per-run figures."""
    t = totals or {}
    return {"input_tokens": _tokens(t.get("total_input")), "output_tokens": _tokens(t.get("total_output")),
            "provenance": PROV_TODAY}
