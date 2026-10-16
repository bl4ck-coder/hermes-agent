"""MF11 restore drill (SPEC v2.1 §3b): byte-exact restore, corrupt blob, decrypt failure."""

from __future__ import annotations

import pytest

from hermes_cli import ops_tx as T
from tests.hermes_cli.test_ops_tx import FakeProtector, run, tx_dirs, home, _seams  # noqa: F401


def _flip(path):
    b = bytearray(path.read_bytes())
    b[-1] ^= 0xFF
    path.write_bytes(bytes(b))


def test_drill_plain_byte_exact_then_corrupt(home):
    original = b"\xef\xbb\xbfsoul\r\nmixed\nendings\r\n\x00tail"
    (home / "SOUL.md").write_bytes(original)
    prot = FakeProtector()
    run(home, ["SOUL.md"], {"SOUL.md": b"new"}, prot=prot)
    (d,) = tx_dirs(home)
    assert T.pre_image_of(home, "p", "prompt", d.name, prot) == {"SOUL.md": original}
    _flip(next(d.glob("*.pre.bin")))
    with pytest.raises(T.TxError) as e:
        T.pre_image_of(home, "p", "prompt", d.name, prot)
    assert (e.value.status, e.value.code) == (409, "backup_corrupt")
    assert (home / "SOUL.md").read_bytes() == b"new"  # live file untouched by a failed drill


def test_drill_secret_envelope_decrypt_and_tamper(home):
    original = b"model:\n  default: x\napi_key: s3cret\n"
    (home / "config.yaml").write_bytes(original)
    prot = FakeProtector()
    run(home, ["config.yaml"], {"config.yaml": b"model:\n  default: y\napi_key: s3cret\n"}, prot=prot, node="model")
    (d,) = tx_dirs(home)
    blob = next(d.glob("*.pre.opsbak"))
    assert b"s3cret" not in blob.read_bytes()  # sealed at rest
    assert T.pre_image_of(home, "p", "model", d.name, prot) == {"config.yaml": original}
    with pytest.raises(T.TxError) as e:
        T.pre_image_of(home, "p", "model", d.name, FakeProtector())  # wrong key
    assert e.value.code == "envelope_invalid"
    _flip(blob)
    with pytest.raises(T.TxError) as e:
        T.pre_image_of(home, "p", "model", d.name, prot)
    assert e.value.code == "envelope_invalid"


def test_drill_wrong_node_and_missing_backup(home):
    (home / "SOUL.md").write_bytes(b"a")
    prot = FakeProtector()
    run(home, ["SOUL.md"], {"SOUL.md": b"b"}, prot=prot)
    (d,) = tx_dirs(home)
    with pytest.raises(T.TxError) as e:
        T.pre_image_of(home, "p", "model", d.name, prot)
    assert e.value.code == "backup_not_restorable"
    with pytest.raises(T.TxError) as e:
        T.pre_image_of(home, "p", "prompt", "../x", prot)
    assert e.value.status == 404
