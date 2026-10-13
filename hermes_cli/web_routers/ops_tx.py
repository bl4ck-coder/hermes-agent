"""A5/A6 Ops write routes (ops-panel P2-03).

``GET  /api/ops/profiles/{name}/nodes/{node}``          content hash (+ SOUL text / model pair)
``PUT  /api/ops/profiles/{name}/nodes/{node}``          transactional save (expected_hash)
``GET  /api/ops/profiles/{name}/nodes/{node}/history``  committed backups, no bodies
``POST /api/ops/profiles/{name}/nodes/{node}/restore``  restore (itself a backed-up transaction)

Nodes in this phase: ``prompt`` (SOUL.md, byte-exact), ``raw_yaml`` (config.yaml, byte-exact)
and ``model`` (config.yaml, resource-specific). Every config write runs A6 (D13). The D11 gate
reads ``X-Hermes-Ops-Connection-Kind`` / ``-Id``, which the Desktop main process stamps; a
missing kind is remote and gets 403. Responses never carry config.yaml bodies or secrets.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from hermes_cli import ops_policy, ops_tx

router = APIRouter()

KIND_HEADER = "X-Hermes-Ops-Connection-Kind"
ID_HEADER = "X-Hermes-Ops-Connection-Id"
WRITE_SETS: Dict[str, List[str]] = {"prompt": ["SOUL.md"], "raw_yaml": ["config.yaml"], "model": ["config.yaml"]}

protector: ops_tx.Protector = ops_tx.DpapiProtector()  # seam


class NodeSave(BaseModel):
    expected_hash: str
    content: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    note: Optional[str] = None


class NodeRestore(BaseModel):
    backup: str
    expected_hash: str


def _resolve(name: str, node: str):
    if node not in WRITE_SETS:
        raise HTTPException(status_code=404, detail={"code": "unknown_node", "detail": node})
    try:
        canon, home = ops_policy.profile_home(name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "invalid_profile", "detail": str(exc)})
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail={"code": "profile_not_found", "detail": name})
    return canon, Path(home)


def _actor(request: Request, canon: str) -> Dict[str, Any]:
    return {"connection_kind": request.headers.get(KIND_HEADER), "connection_id": request.headers.get(ID_HEADER),
            "profile": canon}


def _cfg(image: Optional[bytes]) -> Dict[str, Any]:
    if image is None:
        return {}
    try:
        data = yaml.safe_load(image.decode("utf-8-sig"))
    except (yaml.YAMLError, UnicodeDecodeError) as exc:
        raise ops_tx.TxError(400, "invalid_yaml", str(exc))
    if data is None:
        return {}
    if not isinstance(data, dict):
        raise ops_tx.TxError(400, "invalid_yaml", "YAML must be a mapping")
    return data


def _policy_validate(pre: Dict[str, Optional[bytes]], post: Dict[str, Optional[bytes]]) -> List[Dict[str, Any]]:
    if "config.yaml" not in post:
        return []
    try:
        before = _cfg(pre.get("config.yaml"))
    except ops_tx.TxError:
        before = {}  # an unparsable pre-image grandfathers nothing
    after = _cfg(post["config.yaml"])
    verdict = ops_policy.check_change(ops_policy.load_policy().policy, before, after)
    if not verdict["ok"]:
        raise ops_tx.TxError(400, "policy_blocked", "disallowed model selection (policy P2)",
                             blocked=verdict["blocked"], warnings=verdict["warnings"])
    return verdict["warnings"]


def _set_model(image: Optional[bytes], provider: str, model: str) -> bytes:
    cfg = _cfg(image)
    current = cfg.get("model")
    section = dict(current) if isinstance(current, dict) else {}
    if str(section.get("provider") or "").strip() != provider:
        section.pop("base_url", None)
        section.pop("api_mode", None)
    section.update({"provider": provider, "default": model})
    cfg["model"] = section
    if isinstance(current, str):
        cfg.pop("provider", None)  # legacy top-level provider moves into the model section
    return yaml.safe_dump(cfg, sort_keys=False, allow_unicode=True).encode("utf-8")


def _raise(exc: ops_tx.TxError):
    raise HTTPException(status_code=exc.status, detail=exc.as_dict())


def _result(r: ops_tx.TxResult) -> Dict[str, Any]:
    return {"ok": True, "outcome": r.outcome, "sequence": r.sequence, "backup": r.backup,
            "content_hash": r.composite, "warnings": r.warnings}


@router.get("/api/ops/profiles/{name}/nodes/{node}")
async def read_node(name: str, node: str):
    canon, home = _resolve(name, node)

    def _run():
        try:
            images = {rel: ops_tx.read_image(home, rel) for rel in WRITE_SETS[node]}
            out: Dict[str, Any] = {"profile": canon, "node": node,
                                   "content_hash": ops_tx.composite_hash(home, WRITE_SETS[node], images),
                                   "exists": all(v is not None for v in images.values())}
            if node == "prompt" and images["SOUL.md"] is not None:
                out["content"] = images["SOUL.md"].decode("utf-8", errors="replace")
            if node == "model":
                m = _cfg(images["config.yaml"]).get("model")
                m = m if isinstance(m, dict) else {}
                out["provider"] = m.get("provider")
                out["model"] = m.get("default") or m.get("model")
            return out
        except ops_tx.TxError as exc:
            _raise(exc)

    return await run_in_threadpool(_run)


@router.put("/api/ops/profiles/{name}/nodes/{node}")
async def save_node(name: str, node: str, body: NodeSave, request: Request):
    canon, home = _resolve(name, node)
    actor = _actor(request, canon)

    if node in ("prompt", "raw_yaml"):
        if body.content is None:
            raise HTTPException(status_code=400, detail={"code": "content_required", "detail": node})
        new = body.content.encode("utf-8")
        rel = WRITE_SETS[node][0]

        def compute(pre):
            return {rel: new}
    else:
        provider = (body.provider or "").strip()
        model = (body.model or "").strip()
        if not provider or not model:
            raise HTTPException(status_code=400, detail={"code": "provider_and_model_required", "detail": ""})

        def compute(pre):
            return {"config.yaml": _set_model(pre["config.yaml"], provider, model)}

    def _run():
        try:
            return _result(ops_tx.transact(
                home=home, profile=canon, node=node, write_set=WRITE_SETS[node], expected_hash=body.expected_hash,
                compute=compute, validate=_policy_validate, endpoint=f"PUT /api/ops/profiles/{{name}}/nodes/{node}",
                actor=actor, protector=protector, note=body.note))
        except ops_tx.TxError as exc:
            _raise(exc)

    return await run_in_threadpool(_run)


@router.get("/api/ops/profiles/{name}/nodes/{node}/history")
async def node_history(name: str, node: str):
    _canon, home = _resolve(name, node)
    return {"items": await run_in_threadpool(ops_tx.history, home, node)}


@router.post("/api/ops/profiles/{name}/nodes/{node}/restore")
async def restore_node(name: str, node: str, body: NodeRestore, request: Request):
    canon, home = _resolve(name, node)
    actor = _actor(request, canon)

    def _run():
        try:
            if actor.get("connection_kind") != "local" or not actor.get("connection_id"):
                raise ops_tx.TxError(403, "remote_read_only", "Ops writes are local-only (D11)")
            pre_image = ops_tx.pre_image_of(home, canon, node, body.backup, protector)
            if node == "model":
                old = _cfg(pre_image["config.yaml"]).get("model")
                old = old if isinstance(old, dict) else {}

                def compute(pre):
                    cfg = _cfg(pre["config.yaml"])
                    cfg["model"] = dict(old)
                    return {"config.yaml": yaml.safe_dump(cfg, sort_keys=False, allow_unicode=True).encode("utf-8")}
            else:

                def compute(pre):
                    return dict(pre_image)  # byte-exact (absent pre-image = unlink)
            return _result(ops_tx.transact(
                home=home, profile=canon, node=node, write_set=WRITE_SETS[node], expected_hash=body.expected_hash,
                compute=compute, validate=_policy_validate,
                endpoint=f"POST /api/ops/profiles/{{name}}/nodes/{node}/restore", actor=actor, protector=protector))
        except ops_tx.TxError as exc:
            _raise(exc)

    return await run_in_threadpool(_run)
