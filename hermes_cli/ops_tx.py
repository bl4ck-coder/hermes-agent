"""A5 transaction engine (ops-panel P2-02).

Implements apps/desktop/docs/ops-panel/transaction-contract.md sections 3-10 and 15 for the
Ops Canvas write path: lock -> CAS on the composite hash -> coverage -> retain-all backup of
the pre-image -> compute + validate in memory -> stage + journal barrier -> byte publish ->
read-back -> commit barrier. A failure before publish changes nothing; a failure during
publish rolls back in-process; a crash is repaired by idempotent recovery on the next lock.

Secret-bearing members (``.env``, ``config.yaml``, ``webhook_subscriptions.json``) are only
ever written under ``backups/ops-panel`` as OPSBAK1 AES-256-GCM envelopes. Without a
protector they are refused with 409 ``backup_coverage_missing`` before anything is created.
Nothing here prunes (D10).
"""

from __future__ import annotations

import contextlib
import hashlib
import json
import os
import secrets
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any, Callable, Dict, Iterator, List, Optional, Protocol

BACKUP_SUBDIR = ("backups", "ops-panel")
LOCK_NAME = ".txn.lock"
OPEN_MARKER = ".txn-open"
ENVELOPE_MAGIC = b"OPSBAK1\n"
SECRET_BEARING = frozenset({".env", "config.yaml", "webhook_subscriptions.json"})
NODES = ("schedule", "trigger", "channels", "memory", "identity", "prompt", "model", "tools",
         "skills", "raw_yaml", "secrets")
TMP_SUFFIX = ".ops-txn-tmp"

Image = Optional[bytes]  # None = absent


class TxError(Exception):
    def __init__(self, status: int, code: str, detail: str = "", **extra: Any) -> None:
        super().__init__(f"{status} {code}: {detail}")
        self.status = status
        self.code = code
        self.detail = detail
        self.extra = extra

    def as_dict(self) -> Dict[str, Any]:
        out = {"code": self.code, "detail": self.detail}
        out.update(self.extra)
        return out


class SimulatedCrash(BaseException):
    """Test-only: a process death at a fault point (bypasses in-process rollback)."""


# Fault-injection seam: called with a step label; tests raise TxError/OSError/SimulatedCrash.
fault: Callable[[str], None] = lambda step: None


# ---------------------------------------------------------------------------------------
# Protector (section 10)


class Protector(Protocol):
    def available(self) -> bool: ...

    def key(self) -> bytes: ...


def _aad(profile: str, rel: str, role: str, plain_sha: str) -> bytes:
    return "\0".join((profile, rel, role, plain_sha)).encode("utf-8")


def seal(protector: Protector, profile: str, rel: str, role: str, plain: bytes) -> bytes:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    nonce = secrets.token_bytes(12)
    sha = hashlib.sha256(plain).hexdigest()
    ct = AESGCM(protector.key()).encrypt(nonce, plain, _aad(profile, rel, role, sha))
    return ENVELOPE_MAGIC + sha.encode("ascii") + b"\n" + nonce + ct


def unseal(protector: Protector, profile: str, rel: str, role: str, blob: bytes) -> bytes:
    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    if not blob.startswith(ENVELOPE_MAGIC):
        raise TxError(409, "envelope_invalid", "not an OPSBAK1 envelope")
    rest = blob[len(ENVELOPE_MAGIC):]
    sha, _, body = rest.partition(b"\n")
    nonce, ct = body[:12], body[12:]
    try:
        plain = AESGCM(protector.key()).decrypt(nonce, ct, _aad(profile, rel, role, sha.decode("ascii")))
    except (InvalidTag, ValueError, UnicodeDecodeError) as exc:
        raise TxError(409, "envelope_invalid", f"tag or role check failed: {type(exc).__name__}")
    if hashlib.sha256(plain).hexdigest() != sha.decode("ascii"):
        raise TxError(409, "envelope_invalid", "plaintext hash mismatch")
    return plain


class DpapiProtector:
    """Windows DPAPI-wrapped 32-byte key at ``<root>/ops-panel/backup-protector.dpapi``.

    Created on first use (decision P2-02) with an owner-only ACL. Any failure, or a
    non-Windows host, means "no protector": secret-bearing writes are refused, never
    downgraded to plaintext."""

    def __init__(self, path: Optional[Path] = None) -> None:
        self._path = path
        self._key: Optional[bytes] = None
        self._lock = threading.Lock()

    @property
    def path(self) -> Path:
        if self._path is None:
            from hermes_constants import get_default_hermes_root

            self._path = Path(get_default_hermes_root()) / "ops-panel" / "backup-protector.dpapi"
        return self._path

    def available(self) -> bool:
        try:
            self.key()
            return True
        except Exception:
            return False

    def key(self) -> bytes:
        with self._lock:
            if self._key is None:
                if sys.platform != "win32":
                    raise RuntimeError("DPAPI protector requires Windows")
                if self.path.exists():
                    self._key = _dpapi(self.path.read_bytes(), protect=False)
                else:
                    key = secrets.token_bytes(32)
                    blob = _dpapi(key, protect=True)
                    self.path.parent.mkdir(parents=True, exist_ok=True)
                    restrict_acl(self.path.parent, directory=True)
                    tmp = self.path.with_name(self.path.name + ".tmp")
                    _write_fsync(tmp, blob)
                    os.replace(tmp, self.path)
                    restrict_acl(self.path)
                    self._key = key
                if len(self._key) != 32:
                    raise RuntimeError("protector key has the wrong length")
            return self._key


def _dpapi(data: bytes, *, protect: bool) -> bytes:  # pragma: no cover - Windows only
    import ctypes
    from ctypes import wintypes

    class BLOB(ctypes.Structure):
        _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    crypt32 = ctypes.windll.crypt32  # type: ignore[attr-defined]
    kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
    buf = ctypes.create_string_buffer(data, len(data))
    src = BLOB(len(data), ctypes.cast(buf, ctypes.POINTER(ctypes.c_char)))
    dst = BLOB()
    fn = crypt32.CryptProtectData if protect else crypt32.CryptUnprotectData
    ok = fn(ctypes.byref(src), None, None, None, None, 0x1, ctypes.byref(dst))  # UI_FORBIDDEN
    if not ok:
        raise OSError("DPAPI call failed")
    try:
        return ctypes.string_at(dst.pbData, dst.cbData)
    finally:
        kernel32.LocalFree(dst.pbData)


def restrict_acl(path: Path, *, directory: bool = False) -> None:
    """Owner-only, inheritance removed (fail closed). Children of a directory inherit it."""
    if sys.platform != "win32":
        os.chmod(path, 0o700 if directory else 0o600)
        return
    user = os.environ.get("USERNAME") or ""
    if not user:
        raise OSError("cannot resolve current user for ACL")
    grant = f"{user}:(OI)(CI)F" if directory else f"{user}:F"
    res = subprocess.run(["icacls", str(path), "/inheritance:r", "/grant:r", grant],
                         capture_output=True, text=True, timeout=30)
    if res.returncode != 0:
        raise OSError(f"icacls failed: {res.stdout.strip()} {res.stderr.strip()}")


acl: Callable[..., None] = restrict_acl  # seam


# ---------------------------------------------------------------------------------------
# Hashes (sections 4, 7)


def _check_rel(rel: str) -> str:
    p = PurePosixPath(rel)
    if p.is_absolute() or not p.parts or any(part in ("", ".", "..") for part in p.parts) or "\\" in rel or ":" in rel:
        raise TxError(409, "backup_coverage_missing", f"path outside the profile home: {rel}")
    return p.as_posix()


def _mode(path: Path) -> int:
    return path.stat().st_mode & 0o777


def read_image(home: Path, rel: str) -> Image:
    path = home / rel
    if not path.exists():
        return None
    try:
        return path.read_bytes()
    except OSError as exc:
        raise TxError(409, "backup_coverage_missing", f"unreadable: {rel}: {exc}")


def file_hash(rel: str, image: Image) -> str:
    if image is None:
        return hashlib.sha256(b"absent\0" + rel.encode("utf-8")).hexdigest()
    return hashlib.sha256(image).hexdigest()


def composite_hash(home: Path, write_set: List[str], images: Optional[Dict[str, Image]] = None) -> str:
    h = hashlib.sha256()
    for rel in sorted(write_set):
        img = images[rel] if images is not None else read_image(home, rel)
        h.update(rel.encode("utf-8") + b"\0")
        if img is None:
            h.update(b"absent\0")
        else:
            mode = _mode(home / rel) if (home / rel).exists() else 0o644
            h.update(b"present\0" + str(mode).encode() + b"\0" + img + b"\0")
    return h.hexdigest()


# ---------------------------------------------------------------------------------------
# fs primitives


def _write_fsync(path: Path, data: bytes, mode: int = 0o600) -> None:
    fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_BINARY", 0), mode)
    try:
        os.write(fd, data)
        os.fsync(fd)
    finally:
        os.close(fd)


def _write_json(path: Path, data: Dict[str, Any]) -> None:
    tmp = path.with_name(path.name + ".tmp")
    with contextlib.suppress(FileNotFoundError):
        tmp.unlink()
    _write_fsync(tmp, json.dumps(data, indent=2, sort_keys=True).encode("utf-8"))
    os.replace(tmp, path)
    _fsync_dir(path.parent)


def _fsync_dir(path: Path) -> None:
    if sys.platform == "win32":
        return  # directory handles cannot be fsynced on Windows; replace is journaled by NTFS
    fd = os.open(str(path), os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def byte_publish(home: Path, rel: str, image: Image, secret: bool) -> None:
    """Section 9: temp beside the live path, fsync, atomic replace. No parsing."""
    live = home / rel
    if image is None:
        with contextlib.suppress(FileNotFoundError):
            live.unlink()
        return
    live.parent.mkdir(parents=True, exist_ok=True)
    mode = _mode(live) if live.exists() else (0o600 if secret else 0o644)
    tmp = live.with_name(f".{live.name}{TMP_SUFFIX}")
    with contextlib.suppress(FileNotFoundError):
        tmp.unlink()
    _write_fsync(tmp, image, mode)
    from utils import atomic_replace

    atomic_replace(tmp, live)
    _fsync_dir(live.parent)


# ---------------------------------------------------------------------------------------
# Locks (section 3)

_proc_locks: Dict[str, threading.Lock] = {}
_proc_locks_guard = threading.Lock()


def backup_root(home: Path) -> Path:
    return home.joinpath(*BACKUP_SUBDIR)


@contextlib.contextmanager
def txn_lock(home: Path, protector: Protector, profile: str, timeout: float = 15.0) -> Iterator[None]:
    root = backup_root(home)
    root.mkdir(parents=True, exist_ok=True)
    key = str(root.resolve()).lower()
    with _proc_locks_guard:
        plock = _proc_locks.setdefault(key, threading.Lock())
    if not plock.acquire(timeout=timeout):
        raise TxError(409, "busy", "another Ops transaction holds this profile")
    try:
        fh = open(root / LOCK_NAME, "a+b")
        try:
            _flock(fh, timeout)
            try:
                recover(home, protector, profile)
                yield
            finally:
                _funlock(fh)
        finally:
            fh.close()
    finally:
        plock.release()


def _flock(fh, timeout: float) -> None:
    deadline = time.monotonic() + timeout
    while True:
        try:
            if sys.platform == "win32":
                import msvcrt

                fh.seek(0)
                msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl

                fcntl.flock(fh.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
            return
        except OSError:
            if time.monotonic() > deadline:
                raise TxError(409, "busy", "another process holds the Ops transaction lock")
            time.sleep(0.05)


def _funlock(fh) -> None:
    with contextlib.suppress(OSError):
        if sys.platform == "win32":
            import msvcrt

            fh.seek(0)
            msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
        else:
            import fcntl

            fcntl.flock(fh.fileno(), fcntl.LOCK_UN)


@contextlib.contextmanager
def _config_locks(write_set: List[str]) -> Iterator[None]:
    if "config.yaml" not in write_set:
        yield
        return
    from hermes_cli.config import _CONFIG_LOCK

    with _CONFIG_LOCK:
        yield


# ---------------------------------------------------------------------------------------
# Blobs


def _blob_name(index: int, role: str, secret: bool) -> str:
    return f"{index:02d}.{role}" + (".opsbak" if secret else ".bin")


def _store_blob(tx_dir: Path, name: str, data: bytes, secret: bool, protector: Protector,
                profile: str, rel: str, role: str) -> None:
    payload = seal(protector, profile, rel, role, data) if secret else data
    _write_fsync(tx_dir / name, payload)


def load_blob(home: Path, tx_name: str, entry: Dict[str, Any], role: str, protector: Protector,
              profile: str) -> Image:
    """Decrypted bytes of a member's pre/post blob, hash-checked against the journal."""
    blob_key = "pre_blob" if role == "pre" else "staged_blob"
    want = entry["before_hash"] if role == "pre" else entry["staged_hash"]
    if role == "pre" and entry["pre_image"] == "absent":
        return None
    name = entry.get(blob_key)
    if not name:
        return None
    raw = (backup_root(home) / tx_name / name).read_bytes()
    data = unseal(protector, profile, entry["path"], role, raw) if entry["secret_bearing"] else raw
    if file_hash(entry["path"], data) != want:
        raise TxError(409, "backup_corrupt", f"{entry['path']} {role} blob hash mismatch")
    return data


# ---------------------------------------------------------------------------------------
# Recovery (section 6)


def recover(home: Path, protector: Protector, profile: str) -> List[str]:
    root = backup_root(home)
    marker = root / OPEN_MARKER
    if not marker.exists():
        return []
    names = [n for n in marker.read_text(encoding="utf-8").split() if n]
    done = []
    for name in names:
        tx_dir = root / name
        jpath = tx_dir / "journal.json"
        if not jpath.exists():
            continue
        journal = json.loads(jpath.read_text(encoding="utf-8"))
        if journal["state"] in ("publishing", "rolling_back"):
            journal["state"] = "rolling_back"
            _write_json(jpath, journal)
            for entry in journal["entries"]:
                rel = entry["path"]
                live = home / rel
                tmp = live.with_name(f".{live.name}{TMP_SUFFIX}")
                with contextlib.suppress(FileNotFoundError):
                    tmp.unlink()
                if file_hash(rel, read_image(home, rel)) != entry["before_hash"]:
                    byte_publish(home, rel, load_blob(home, name, entry, "pre", protector, profile),
                                 entry["secret_bearing"])
            journal["state"] = "recovered_preimage"
            _write_json(jpath, journal)
            mpath = tx_dir / "manifest.json"
            manifest = json.loads(mpath.read_text(encoding="utf-8")) if mpath.exists() else dict(journal.get("manifest_seed") or {})
            manifest["outcome"] = "recovered_preimage"
            _write_json(mpath, manifest)
        done.append(name)
    marker.unlink()
    return done


# ---------------------------------------------------------------------------------------
# The transaction (section 5)


@dataclass
class TxResult:
    sequence: int
    backup: str
    outcome: str
    composite: str
    warnings: List[Dict[str, Any]] = field(default_factory=list)
    files: List[Dict[str, Any]] = field(default_factory=list)


def _next_sequence(root: Path, node: str) -> int:
    best = 0
    suffix = f"-{node}-"
    for child in root.iterdir() if root.exists() else []:
        name = child.name
        if child.is_dir() and suffix in name:
            tail = name.rsplit("-", 1)[-1]
            if tail.isdigit() and name.rsplit("-", 1)[0].endswith(f"-{node}"):
                best = max(best, int(tail))
    return best + 1


Compute = Callable[[Dict[str, Image]], Dict[str, Image]]
Validate = Callable[[Dict[str, Image], Dict[str, Image]], List[Dict[str, Any]]]


def transact(*, home: Path, profile: str, node: str, write_set: List[str], expected_hash: str,
             compute: Compute, validate: Validate, endpoint: str, actor: Dict[str, Any],
             protector: Protector, note: Optional[str] = None) -> TxResult:
    if node not in NODES:
        raise TxError(400, "unknown_node", node)
    # Gate (step 1): kind comes from the Desktop main process; missing = remote (D11).
    if actor.get("connection_kind") != "local" or not actor.get("connection_id"):
        raise TxError(403, "remote_read_only", "Ops writes are local-only (D11)")
    write_set = sorted({_check_rel(r) for r in write_set})
    secret = {rel: PurePosixPath(rel).name in SECRET_BEARING for rel in write_set}
    with txn_lock(home, protector, profile), _config_locks(write_set):
        return _transact_locked(home, profile, node, write_set, secret, expected_hash, compute, validate,
                                endpoint, actor, protector, note)


def _transact_locked(home, profile, node, write_set, secret, expected_hash, compute, validate,
                     endpoint, actor, protector, note) -> TxResult:
    # Step 2: CAS.
    pre = {rel: read_image(home, rel) for rel in write_set}
    before_composite = composite_hash(home, write_set, pre)
    if expected_hash != before_composite:
        raise TxError(409, "conflict", "the file changed since it was read", current_hash=before_composite)
    # Step 3: coverage.
    if any(secret.values()) and not protector.available():
        raise TxError(409, "backup_coverage_missing", "no backup protector for a secret-bearing file")
    root = backup_root(home)
    seq = _next_sequence(root, node)
    name = f"{time.strftime('%Y%m%d-%H%M%S', time.gmtime())}Z-{node}-{seq}"
    tx_dir = root / name
    files: List[Dict[str, Any]] = [{"path": rel, "pre_image": "absent" if pre[rel] is None else "present",
              "mode": _mode(home / rel) if pre[rel] is not None else None, "secret_bearing": secret[rel],
              "before_hash": file_hash(rel, pre[rel]), "staged_hash": None, "readback_hash": None}
             for rel in write_set]
    manifest: Dict[str, Any] = {
        "schema_version": 1, "node": node, "profile": profile, "object_id": profile, "endpoint": endpoint,
        "actor": {k: actor.get(k) for k in ("connection_id", "connection_kind", "profile")} | {"surface": "ops-canvas"},
        "expected_hash": expected_hash, "before_composite": before_composite, "staged_composite": None,
        "readback_composite": None, "document_hash": None, "outcome": None, "files": files,
        "note": note if node == "prompt" else None, "sequence": seq,
    }
    # Step 4: backup of the pre-image.
    try:
        fault("backup")
        tx_dir.mkdir(parents=True, exist_ok=False)
        acl(tx_dir, directory=True)
        for i, rel in enumerate(write_set):
            pre_bytes = pre[rel]
            if pre_bytes is not None:
                _store_blob(tx_dir, _blob_name(i, "pre", secret[rel]), pre_bytes, secret[rel], protector, profile, rel, "pre")
    except TxError:
        raise
    except Exception as exc:
        raise TxError(500, "backup_failed", f"{type(exc).__name__}: {exc}")
    # Step 5: compute + validate in memory.
    try:
        post = compute(dict(pre))
        if set(post) != set(write_set):
            raise TxError(409, "backup_coverage_missing", "compute touched a path outside the write-set")
        warnings = validate(pre, post)
    except TxError as exc:
        manifest["outcome"] = "aborted_validation"
        _write_json(tx_dir / "manifest.json", manifest)
        raise exc
    for f in files:
        f["staged_hash"] = file_hash(f["path"], post[f["path"]])
    manifest["staged_composite"] = composite_hash(home, write_set, post)
    if post == pre:
        manifest["outcome"] = "committed"
        manifest["readback_composite"] = before_composite
        for f in files:
            f["readback_hash"] = f["before_hash"]
        _write_json(tx_dir / "journal.json", {"state": "committed", "entries": []})
        _write_json(tx_dir / "manifest.json", manifest)
        return TxResult(seq, name, "committed", before_composite, warnings, files)
    entries: List[Dict[str, Any]] = []
    try:
        # 6a stage
        for i, rel in enumerate(write_set):
            staged = None
            post_bytes = post[rel]
            if post_bytes is not None:
                staged = _blob_name(i, "post", secret[rel])
                _store_blob(tx_dir, staged, post_bytes, secret[rel], protector, profile, rel, "post")
            entries.append({"path": rel, "pre_image": files[i]["pre_image"], "before_hash": files[i]["before_hash"],
                            "staged_hash": files[i]["staged_hash"],
                            "pre_blob": _blob_name(i, "pre", secret[rel]) if pre[rel] is not None else None,
                            "staged_blob": staged, "secret_bearing": secret[rel], "published": False})
        fault("stage")
    except TxError:
        raise
    except Exception as exc:
        raise TxError(500, "backup_failed", f"stage: {type(exc).__name__}: {exc}")
    # 6b journal barrier
    journal = {"state": "publishing", "entries": entries, "manifest_seed": manifest}
    marker = root / OPEN_MARKER
    try:
        _write_json(tx_dir / "journal.json", journal)
        _write_marker(marker, name)
    except OSError as exc:
        _clear_marker(marker)
        raise TxError(500, "backup_failed", f"journal: {exc}")
    try:
        fault("barrier")
        if composite_hash(home, write_set) != before_composite:
            raise TxError(409, "conflict", "the file changed during the transaction")
        # 6c publish
        for entry in entries:
            fault(f"publish:{entry['path']}")
            byte_publish(home, entry["path"], post[entry["path"]], entry["secret_bearing"])
            entry["published"] = True
        fault("readback")
        # 7 read-back
        for f in files:
            f["readback_hash"] = file_hash(f["path"], read_image(home, f["path"]))
        if any(f["readback_hash"] != f["staged_hash"] for f in files):
            raise TxError(500, "readback_mismatch", "live bytes differ from the staged image")
        manifest["readback_composite"] = composite_hash(home, write_set)
        # 8 commit barrier
        manifest["outcome"] = "committed"
        _write_json(tx_dir / "manifest.json", manifest)
        fault("commit")
        journal["state"] = "committed"
        _write_json(tx_dir / "journal.json", journal)
        _clear_marker(marker)
    except Exception as exc:  # live rollback while the lock is held (SimulatedCrash bypasses this)
        journal["state"] = "rolling_back"
        _write_json(tx_dir / "journal.json", journal)
        recover(home, protector, profile)
        manifest = json.loads((tx_dir / "manifest.json").read_text(encoding="utf-8"))
        manifest["outcome"] = "readback_mismatch" if isinstance(exc, TxError) and exc.code == "readback_mismatch" else "recovered_preimage"
        _write_json(tx_dir / "manifest.json", manifest)
        if isinstance(exc, TxError):
            raise
        raise TxError(500, "publish_failed", f"{type(exc).__name__}: {exc}; original restored")
    return TxResult(seq, name, "committed", manifest["readback_composite"], warnings, files)


def _write_marker(marker: Path, name: str) -> None:
    existing = marker.read_text(encoding="utf-8").split() if marker.exists() else []
    tmp = marker.with_name(marker.name + ".tmp")
    with contextlib.suppress(FileNotFoundError):
        tmp.unlink()
    _write_fsync(tmp, "\n".join(existing + [name]).encode("utf-8"))
    os.replace(tmp, marker)
    _fsync_dir(marker.parent)


def _clear_marker(marker: Path) -> None:
    with contextlib.suppress(FileNotFoundError):
        marker.unlink()


# ---------------------------------------------------------------------------------------
# History + restore inputs (sections 8, 15)

_HISTORY_FIELDS = ("node", "profile", "endpoint", "outcome", "sequence", "note", "before_composite",
                   "staged_composite", "readback_composite")


def history(home: Path, node: str) -> List[Dict[str, Any]]:
    root = backup_root(home)
    out = []
    if not root.exists():
        return out
    for tx_dir in root.iterdir():
        mpath, jpath = tx_dir / "manifest.json", tx_dir / "journal.json"
        if not (tx_dir.is_dir() and mpath.exists() and jpath.exists()):
            continue
        try:
            manifest = json.loads(mpath.read_text(encoding="utf-8"))
            state = json.loads(jpath.read_text(encoding="utf-8"))["state"]
        except (OSError, ValueError, KeyError):
            continue
        if manifest.get("node") != node or state != "committed" or manifest.get("outcome") != "committed":
            continue
        item = {k: manifest.get(k) for k in _HISTORY_FIELDS}
        item["backup"] = tx_dir.name
        item["files"] = [{k: f.get(k) for k in ("path", "pre_image", "secret_bearing", "before_hash", "staged_hash")}
                         for f in manifest.get("files", [])]
        out.append(item)
    out.sort(key=lambda m: m["sequence"], reverse=True)
    return out


def pre_image_of(home: Path, profile: str, node: str, backup: str, protector: Protector) -> Dict[str, Image]:
    """Byte-exact pre-image of a committed transaction, hash-verified per member."""
    root = backup_root(home)
    if PurePosixPath(backup).name != backup or not (root / backup).is_dir():
        raise TxError(404, "backup_not_found", backup)
    manifest = json.loads((root / backup / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("node") != node or manifest.get("outcome") != "committed":
        raise TxError(409, "backup_not_restorable", "only committed backups of this node restore")
    out: Dict[str, Image] = {}
    for i, f in enumerate(manifest["files"]):
        entry = dict(f, pre_blob=_blob_name(i, "pre", f["secret_bearing"]) if f["pre_image"] == "present" else None)
        out[f["path"]] = load_blob(home, backup, entry, "pre", protector, profile)
    return out
