"""A5 transaction engine (ops-panel P2-02): CAS, coverage, retain-all backups, envelopes,
fault injection at every step (original-or-committed), crash recovery, byte-exact pre-image."""

from __future__ import annotations

import json
import secrets
from pathlib import Path

import pytest

from hermes_cli import ops_tx as T

LOCAL = {"connection_id": "local", "connection_kind": "local", "profile": "p"}


class FakeProtector:
    def __init__(self, ok=True):
        self.ok = ok
        self._key = secrets.token_bytes(32)

    def available(self):
        return self.ok

    def key(self):
        if not self.ok:
            raise RuntimeError("no protector")
        return self._key


@pytest.fixture(autouse=True)
def _seams(monkeypatch):
    monkeypatch.setattr(T, "acl", lambda *a, **k: None)
    monkeypatch.setattr(T, "fault", lambda step: None)


@pytest.fixture
def home(tmp_path):
    h = tmp_path / "home"
    h.mkdir()
    return h


def run(home, write_set, post, *, prot=None, expected=None, validate=None, node="prompt", actor=LOCAL):
    prot = prot or FakeProtector()
    exp = expected if expected is not None else T.composite_hash(home, write_set)
    return T.transact(home=home, profile="p", node=node, write_set=write_set, expected_hash=exp,
                      compute=lambda pre: dict(post), validate=validate or (lambda pre, p: []),
                      endpoint="test", actor=actor, protector=prot)


def tx_dirs(home):
    root = T.backup_root(home)
    return sorted(p for p in root.iterdir() if p.is_dir()) if root.exists() else []


def test_commit_backup_manifest_history_and_byte_exact_pre_image(home):
    original = b"\xef\xbb\xbfSoul line 1\r\nline 2\r\n"
    (home / "SOUL.md").write_bytes(original)
    prot = FakeProtector()
    r = run(home, ["SOUL.md"], {"SOUL.md": b"new soul\n"}, prot=prot)
    assert (r.outcome, r.sequence) == ("committed", 1)
    assert (home / "SOUL.md").read_bytes() == b"new soul\n"
    (d,) = tx_dirs(home)
    manifest = json.loads((d / "manifest.json").read_text())
    assert manifest["outcome"] == "committed" and manifest["files"][0]["readback_hash"] == manifest["files"][0]["staged_hash"]
    assert json.loads((d / "journal.json").read_text())["state"] == "committed"
    hist = T.history(home, "prompt")
    assert [h["sequence"] for h in hist] == [1] and "files" in hist[0]
    assert T.pre_image_of(home, "p", "prompt", d.name, prot) == {"SOUL.md": original}
    assert not (T.backup_root(home) / T.OPEN_MARKER).exists()


def test_cas_conflict_creates_nothing(home):
    (home / "SOUL.md").write_bytes(b"a")
    with pytest.raises(T.TxError) as e:
        run(home, ["SOUL.md"], {"SOUL.md": b"b"}, expected="0" * 64)
    assert (e.value.status, e.value.code) == (409, "conflict") and e.value.extra["current_hash"]
    assert tx_dirs(home) == [] and (home / "SOUL.md").read_bytes() == b"a"


@pytest.mark.parametrize("actor", [{"connection_id": "x", "connection_kind": "remote"},
                                   {"connection_id": "x"}, {"connection_kind": "local"}])
def test_remote_or_unknown_kind_is_403(home, actor):
    with pytest.raises(T.TxError) as e:
        run(home, ["SOUL.md"], {"SOUL.md": b"b"}, actor=actor)
    assert e.value.status == 403 and not T.backup_root(home).exists()


def test_backup_failure_changes_nothing(home, monkeypatch):
    (home / "SOUL.md").write_bytes(b"orig")

    def boom(step):
        if step == "backup":
            raise OSError("disk full")
    monkeypatch.setattr(T, "fault", boom)
    with pytest.raises(T.TxError) as e:
        run(home, ["SOUL.md"], {"SOUL.md": b"new"})
    assert (e.value.status, e.value.code) == (500, "backup_failed")
    assert (home / "SOUL.md").read_bytes() == b"orig"


def test_secret_member_without_protector_is_409_before_any_artifact(home):
    (home / "config.yaml").write_bytes(b"model: {}\n")
    with pytest.raises(T.TxError) as e:
        run(home, ["config.yaml"], {"config.yaml": b"x: 1\n"}, prot=FakeProtector(ok=False), node="raw_yaml")
    assert (e.value.status, e.value.code) == (409, "backup_coverage_missing")
    assert tx_dirs(home) == []


@pytest.mark.parametrize("rel", ["../escape.txt", "/abs.txt", "a/../../b", "C:/x", "a\\b"])
def test_outside_paths_refused(home, rel):
    with pytest.raises(T.TxError) as e:
        run(home, [rel], {rel: b"x"})
    assert e.value.code == "backup_coverage_missing"


def test_validation_abort_keeps_live_and_stages_nothing(home):
    (home / "SOUL.md").write_bytes(b"orig")

    def reject(pre, post):
        raise T.TxError(400, "policy_blocked", "no")
    with pytest.raises(T.TxError) as e:
        run(home, ["SOUL.md"], {"SOUL.md": b"new"}, validate=reject)
    assert e.value.status == 400 and (home / "SOUL.md").read_bytes() == b"orig"
    (d,) = tx_dirs(home)
    assert not list(d.glob("*.post.*")) and json.loads((d / "manifest.json").read_text())["outcome"] == "aborted_validation"
    assert T.history(home, "prompt") == []


def test_no_plaintext_secret_in_any_artifact_and_role_binding(home):
    pre = b"model:\n  provider: anthropic\napi_key: sk-PRESECRET-123\n"
    post = b"model:\n  provider: anthropic\napi_key: sk-POSTSECRET-456\n"
    (home / "config.yaml").write_bytes(pre)
    prot = FakeProtector()
    run(home, ["config.yaml"], {"config.yaml": post}, prot=prot, node="raw_yaml")
    assert (home / "config.yaml").read_bytes() == post
    for f in T.backup_root(home).rglob("*"):
        if f.is_file():
            data = f.read_bytes()
            assert b"PRESECRET" not in data and b"POSTSECRET" not in data, f
    (d,) = tx_dirs(home)
    pre_blob = (d / "00.pre.opsbak").read_bytes()
    assert pre_blob.startswith(T.ENVELOPE_MAGIC)
    assert T.unseal(prot, "p", "config.yaml", "pre", pre_blob) == pre
    with pytest.raises(T.TxError):
        T.unseal(prot, "p", "config.yaml", "post", pre_blob)  # role is bound by AAD
    with pytest.raises(T.TxError):
        T.unseal(prot, "other", "config.yaml", "pre", pre_blob)
    tampered = pre_blob[:-1] + bytes([pre_blob[-1] ^ 1])
    with pytest.raises(T.TxError):
        T.unseal(prot, "p", "config.yaml", "pre", tampered)
    with pytest.raises(T.TxError):
        T.unseal(FakeProtector(), "p", "config.yaml", "pre", pre_blob)  # wrong key
    assert T.pre_image_of(home, "p", "raw_yaml", d.name, prot) == {"config.yaml": pre}


def test_retain_all_sequences(home):
    for i in range(3):
        run(home, ["SOUL.md"], {"SOUL.md": f"v{i}".encode()})
    assert [h["sequence"] for h in T.history(home, "prompt")] == [3, 2, 1]
    assert len(tx_dirs(home)) == 3


def test_create_from_absence_and_absent_pre_image(home):
    prot = FakeProtector()
    run(home, ["SOUL.md"], {"SOUL.md": b"born"}, prot=prot)
    (d,) = tx_dirs(home)
    assert T.pre_image_of(home, "p", "prompt", d.name, prot) == {"SOUL.md": None}
    run(home, ["SOUL.md"], {"SOUL.md": None}, prot=prot)  # restore of a create = unlink
    assert not (home / "SOUL.md").exists()


MULTI = ["SOUL.md", "config.yaml"]
STEPS = ["stage", "barrier", "publish:SOUL.md", "publish:config.yaml", "readback", "commit"]


def seed_multi(home):
    pre = {"SOUL.md": b"soul-pre", "config.yaml": b"api_key: sk-PRE\n"}
    for k, v in pre.items():
        (home / k).write_bytes(v)
    return pre, {"SOUL.md": b"soul-post", "config.yaml": b"api_key: sk-POST\n"}


def live(home):
    return {k: (home / k).read_bytes() if (home / k).exists() else None for k in MULTI}


@pytest.mark.parametrize("step", STEPS)
def test_fault_injection_in_process_is_original(home, monkeypatch, step):
    pre, post = seed_multi(home)

    def boom(s):
        if s == step:
            raise OSError(f"injected at {s}")
    monkeypatch.setattr(T, "fault", boom)
    with pytest.raises(T.TxError):
        run(home, MULTI, post, node="raw_yaml")
    assert live(home) == pre
    assert not list(home.glob(".*" + T.TMP_SUFFIX))


@pytest.mark.parametrize("step", STEPS)
def test_crash_at_every_step_recovers_to_original(home, monkeypatch, step):
    pre, post = seed_multi(home)
    prot = FakeProtector()

    def crash(s):
        if s == step:
            raise T.SimulatedCrash(s)
    monkeypatch.setattr(T, "fault", crash)
    with pytest.raises(T.SimulatedCrash):
        run(home, MULTI, post, prot=prot, node="raw_yaml")
    assert all(live(home)[k] in (pre[k], post[k]) for k in MULTI)
    monkeypatch.setattr(T, "fault", lambda s: None)
    with T.txn_lock(home, prot, "p"):  # next acquire runs recovery
        pass
    assert live(home) == pre
    with T.txn_lock(home, prot, "p"):  # idempotent
        pass
    assert live(home) == pre
    for d in tx_dirs(home):
        j = json.loads((d / "journal.json").read_text()) if (d / "journal.json").exists() else {"state": None}
        assert j["state"] in (None, "recovered_preimage")
    # a fresh transaction after recovery commits normally
    r = run(home, MULTI, post, prot=prot, node="raw_yaml")
    assert r.outcome == "committed" and live(home) == post


def test_readback_mismatch_rolls_back(home, monkeypatch):
    (home / "SOUL.md").write_bytes(b"orig")

    def tamper(step):
        if step == "readback":  # something rewrote the live file between publish and read-back
            (home / "SOUL.md").write_bytes(b"tampered")
    monkeypatch.setattr(T, "fault", tamper)
    with pytest.raises(T.TxError) as e:
        run(home, ["SOUL.md"], {"SOUL.md": b"new"})
    assert (e.value.status, e.value.code) == (500, "readback_mismatch")
    assert (home / "SOUL.md").read_bytes() == b"orig"
    (d,) = tx_dirs(home)
    assert json.loads((d / "manifest.json").read_text())["outcome"] == "readback_mismatch"
    assert T.history(home, "prompt") == []


def test_compute_outside_write_set_refused(home):
    (home / "SOUL.md").write_bytes(b"a")
    with pytest.raises(T.TxError) as e:
        T.transact(home=home, profile="p", node="prompt", write_set=["SOUL.md"],
                   expected_hash=T.composite_hash(home, ["SOUL.md"]),
                   compute=lambda pre: {"SOUL.md": b"b", ".env": b"X=1"}, validate=lambda a, b: [],
                   endpoint="t", actor=LOCAL, protector=FakeProtector())
    assert e.value.code == "backup_coverage_missing" and (home / "SOUL.md").read_bytes() == b"a"


@pytest.mark.skipif(__import__("sys").platform != "win32", reason="DPAPI is Windows-only")
def test_real_dpapi_protector_roundtrip_and_acl(tmp_path):
    import subprocess

    path = tmp_path / "ops-panel" / "backup-protector.dpapi"
    a = T.DpapiProtector(path)
    assert a.available() and path.exists() and path.read_bytes() != a.key()
    b = T.DpapiProtector(path)
    assert b.key() == a.key()  # same key after reload
    env = T.seal(a, "p", ".env", "pre", b"X=1")
    assert T.unseal(b, "p", ".env", "pre", env) == b"X=1"
    out = subprocess.run(["icacls", str(path)], capture_output=True, text=True).stdout
    assert "Everyone" not in out and "BUILTIN\\Users" not in out


def test_protector_missing_off_windows(tmp_path, monkeypatch):
    monkeypatch.setattr(T.sys, "platform", "linux")
    assert T.DpapiProtector(tmp_path / "k.dpapi").available() is False
