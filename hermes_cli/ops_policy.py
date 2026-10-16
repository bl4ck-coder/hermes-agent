"""A6 model policy P2 (ops-panel P2-01).

One validator for every governed write (SPEC 4.4, D8, D13): ``model.provider`` /
``model.default`` (+ ``model.base_url``), ``fallback_providers[*]`` and
``auxiliary.*.provider`` / ``model``.

Effective policy:
- ``HERMES_HOME/ops-policy.yaml`` when present and valid (it may set ``enabled: false``).
- Otherwise the built-in policy below, which is SPEC 4.4 verbatim: deny by default,
  enabled, all profiles. An unreadable or invalid override fails closed to the built-in
  policy and reports ``error`` (never to "no policy").

D13: introducing a disallowed selection is blocked; a violation that already exists in the
pre-image (same field, provider, model) only warns, so unrelated edits proceed.
"""

from __future__ import annotations

import copy
import fnmatch
import os
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional
from urllib.parse import urlparse

import yaml

POLICY_FILE = "ops-policy.yaml"

BUILTIN_POLICY: Dict[str, Any] = {
    "version": 2,
    "enabled": True,
    "scope": "all_profiles",
    "allow": [
        {"provider": ["anthropic"], "models": ["claude-*"]},
        {"provider": ["openai-codex", "openai"], "models": ["gpt-6.1-sol", "gpt-6.1-sol-900k", "gpt-6.1-sol-pro"]},
        {"provider": ["xai-oauth", "xai"], "models": ["grok-4.7"]},
    ],
    "deny_default": True,
    "enforcement": {"on_select_disallowed": "block", "on_existing_violation": "warn", "migrations": "manual"},
    "non_llm_services": "ignore",
}

# Direct-only (D8): a non-empty base_url must point at the provider family's own API host.
OFFICIAL_HOSTS: Dict[str, tuple] = {
    "anthropic": ("api.anthropic.com",),
    "openai": ("api.openai.com",),
    "openai-codex": ("api.openai.com", "chatgpt.com"),
    "xai": ("api.x.ai",),
    "xai-oauth": ("api.x.ai",),
}

# Auxiliary entries that mean "use the main model" carry no selection of their own.
_INHERIT = {"", "auto", "main"}


class PolicyFileError(ValueError):
    pass


@dataclass(frozen=True)
class Selection:
    field: str
    provider: str
    model: str
    base_url: str = ""


@dataclass(frozen=True)
class Violation:
    field: str
    provider: str
    model: str
    reason: str  # provider_not_allowed | model_not_allowed | base_url_proxy | missing_model

    def key(self) -> tuple:
        return (self.field, self.provider, self.model, self.reason)


@dataclass
class PolicyLoad:
    policy: Dict[str, Any]
    source: str  # builtin | file | invalid
    path: str
    error: Optional[str] = None

    @property
    def fail_closed(self) -> bool:
        """SPEC v2.1 1.6: a present-but-invalid override blocks every governed write (no silent fallback)."""
        return self.error is not None


def _as_list(value: Any) -> List[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list) and all(isinstance(v, str) for v in value):
        return list(value)
    raise PolicyFileError("provider/models must be a string or a list of strings")


def validate_policy(raw: Any) -> Dict[str, Any]:
    """Strict schema; anything unexpected is an error (the caller fails closed)."""
    if not isinstance(raw, dict):
        raise PolicyFileError("policy must be a mapping")
    if raw.get("version") != 2:
        raise PolicyFileError("version must be 2")
    if not isinstance(raw.get("enabled"), bool):
        raise PolicyFileError("enabled must be true or false")
    if raw.get("scope", "all_profiles") != "all_profiles":
        raise PolicyFileError("scope must be all_profiles (D8)")
    if raw.get("deny_default") is not True:
        raise PolicyFileError("deny_default must be true")
    allow = raw.get("allow")
    if not isinstance(allow, list) or not allow:
        raise PolicyFileError("allow must be a non-empty list")
    rules = []
    for rule in allow:
        if not isinstance(rule, dict):
            raise PolicyFileError("allow entries must be mappings")
        providers = [p.strip().lower() for p in _as_list(rule.get("provider"))]
        models = [m.strip().lower() for m in _as_list(rule.get("models"))]
        if not providers or not models or any(not p for p in providers) or any(not m for m in models):
            raise PolicyFileError("allow entries need provider and models")
        rules.append({"provider": providers, "models": models})
    enforcement = dict(BUILTIN_POLICY["enforcement"])
    enforcement.update(raw.get("enforcement") or {})
    if enforcement.get("on_select_disallowed") != "block":
        raise PolicyFileError("on_select_disallowed must be block (D13)")
    if enforcement.get("on_existing_violation") not in ("warn", "block"):
        raise PolicyFileError("on_existing_violation must be warn or block")
    # SPEC v2.1 1.6: an override may only restrict the builtin allowlist, never enlarge it.
    if raw["enabled"] is not True:
        raise PolicyFileError("enabled must be true (an override may only restrict the builtin policy)")
    for rule in rules:
        for prov in rule["provider"]:
            covering = [b for b in BUILTIN_POLICY["allow"] if prov in b["provider"]]
            if not covering:
                raise PolicyFileError(f"provider {prov!r} is not in the builtin allowlist (restrict-only)")
            for mdl in rule["models"]:
                if not any(fnmatch.fnmatchcase(mdl, pat) for b in covering for pat in b["models"]):
                    raise PolicyFileError(f"model {mdl!r} for {prov!r} widens the builtin allowlist (restrict-only)")
    out = copy.deepcopy(BUILTIN_POLICY)
    out.update({"enabled": True, "allow": rules, "enforcement": enforcement})
    return out


def _home(home: Optional[os.PathLike] = None) -> Path:
    """The policy is root-owned: always the default hermes root, never a profile home."""
    if home is not None:
        return Path(home)
    from hermes_constants import get_default_hermes_root

    return Path(get_default_hermes_root())


def profile_home(profile: Optional[str]) -> tuple:
    """``(canonical name, home)`` of an existing profile; ``None``/``""`` is ``default``.

    ValueError for an invalid name, FileNotFoundError for an unknown profile."""
    from hermes_cli.profiles import _existing_profile_dir

    name = (profile or "").strip() or "default"
    return _existing_profile_dir(name)


def load_policy(home: Optional[os.PathLike] = None) -> PolicyLoad:
    path = _home(home) / POLICY_FILE
    builtin = copy.deepcopy(BUILTIN_POLICY)
    if not path.exists():
        return PolicyLoad(builtin, "builtin", str(path))
    try:
        raw = yaml.safe_load(path.read_text(encoding="utf-8-sig"))
        return PolicyLoad(validate_policy(raw), "file", str(path))
    except (OSError, yaml.YAMLError, PolicyFileError) as exc:
        return PolicyLoad(builtin, "invalid", str(path), error=f"{type(exc).__name__}: {exc}")


def _norm(value: Any) -> str:
    return str(value or "").strip()


def selections(cfg: Any) -> List[Selection]:
    """Every governed (provider, model) pair in a config mapping."""
    if not isinstance(cfg, dict):
        return []
    out: List[Selection] = []
    main_provider = ""
    model = cfg.get("model")
    if isinstance(model, dict):
        main_provider = _norm(model.get("provider"))
        name = _norm(model.get("default") or model.get("model"))
        out.append(Selection("model", main_provider, name, _norm(model.get("base_url"))))
    elif isinstance(model, str) and model.strip():
        main_provider = _norm(cfg.get("provider"))
        out.append(Selection("model", main_provider, model.strip(), _norm(cfg.get("base_url"))))
    fallbacks = cfg.get("fallback_providers")
    if isinstance(fallbacks, dict):
        fallbacks = [fallbacks]
    if isinstance(fallbacks, list):
        for i, fb in enumerate(fallbacks):
            field = f"fallback_providers[{i}]"
            if isinstance(fb, dict):
                out.append(Selection(field, _norm(fb.get("provider")), _norm(fb.get("model")), _norm(fb.get("base_url"))))
            elif isinstance(fb, str) and fb.strip():
                prov, _, name = fb.strip().partition("/")
                out.append(Selection(field, prov, name))
    aux = cfg.get("auxiliary")
    if isinstance(aux, dict):
        for name, entry in aux.items():
            if not isinstance(entry, dict):
                continue
            prov = _norm(entry.get("provider"))
            mdl = _norm(entry.get("model"))
            if prov.lower() in _INHERIT:
                if not mdl:
                    continue
                prov = main_provider
            out.append(Selection(f"auxiliary.{name}", prov, mdl, _norm(entry.get("base_url"))))
    return out


def check_selection(policy: Dict[str, Any], sel: Selection) -> Optional[Violation]:
    prov = sel.provider.lower()
    mdl = sel.model.lower()
    if not mdl:
        return Violation(sel.field, sel.provider, sel.model, "missing_model")
    rules = [r for r in policy["allow"] if prov in r["provider"]]
    if not rules:
        return Violation(sel.field, sel.provider, sel.model, "provider_not_allowed")
    if not any(fnmatch.fnmatchcase(mdl, pat) for r in rules for pat in r["models"]):
        return Violation(sel.field, sel.provider, sel.model, "model_not_allowed")
    if sel.base_url:
        host = (urlparse(sel.base_url).hostname or "").lower()
        if host not in OFFICIAL_HOSTS.get(prov, ()):
            return Violation(sel.field, sel.provider, sel.model, "base_url_proxy")
    return None


def evaluate(policy: Dict[str, Any], cfg: Any) -> List[Violation]:
    if not policy.get("enabled"):
        return []
    return [v for v in (check_selection(policy, s) for s in selections(cfg)) if v is not None]


def check_change(policy: Dict[str, Any], before: Any, after: Any) -> Dict[str, Any]:
    """D13. ``blocked`` = violations the write introduces; ``warnings`` = ones already present."""
    existing = {v.key() for v in evaluate(policy, before)}
    blocked: List[Violation] = []
    warnings: List[Violation] = []
    strict = policy.get("enforcement", {}).get("on_existing_violation") == "block"
    for v in evaluate(policy, after):
        if v.key() in existing and not strict:
            warnings.append(v)
        else:
            blocked.append(v)
    return {
        "ok": not blocked,
        "blocked": [asdict(v) for v in blocked],
        "warnings": [asdict(v) for v in warnings],
    }


def allowed_pairs(policy: Dict[str, Any]) -> List[Dict[str, Any]]:
    return [{"provider": r["provider"], "models": r["models"]} for r in policy["allow"]]


def violations_json(items: Iterable[Violation]) -> List[Dict[str, str]]:
    return [asdict(v) for v in items]
