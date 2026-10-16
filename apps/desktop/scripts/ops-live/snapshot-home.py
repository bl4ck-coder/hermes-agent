"""Copy the real Hermes home's readable state into a sandbox home for the Ops live pass.

The live pass needs a gateway (v0.22) but must never start, stop or replace the user's. So it runs against
a snapshot: real sessions, kanban, cron history, profiles and skills, with everything that can act removed.

Never copied: .env, auth.json, pairing, platform state, hooks, plugins, cron scripts, bot relays, caches, logs.
Neutralised in every config.yaml: messaging platforms, hooks, the gateway's kanban dispatcher, profile multiplexing.
Every cron job is copied paused (enabled: false), so nothing scheduled can run from the snapshot.

Usage: python snapshot-home.py <real-home> <sandbox-home> [api-port]
"""

from __future__ import annotations

import json
import shutil
import sqlite3
import sys
from pathlib import Path

import yaml

DBS = ("state.db", "kanban.db", "projects.db")
TREES = ("skills", "memories")
FILES = ("SOUL.md", "profile.yaml")


def backup_db(src: Path, dst: Path) -> None:
    """Consistent copy of a live SQLite db (WAL included) without locking the writer for long."""
    if not src.is_file():
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(f"file:{src.as_posix()}?mode=ro", uri=True) as s, sqlite3.connect(dst) as d:
        s.backup(d)


def sanitize_config(src: Path, dst: Path) -> None:
    if not src.is_file():
        return
    cfg = yaml.safe_load(src.read_text(encoding="utf-8")) or {}
    cfg.pop("hooks", None)
    cfg["hooks_auto_accept"] = False
    cfg["platforms"] = {}
    cfg.setdefault("kanban", {})["dispatch_in_gateway"] = False
    cfg.setdefault("gateway", {})["multiplex_profiles"] = False
    for key in ("mcp_servers", "mcp"):
        cfg.pop(key, None)
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst.write_text(yaml.safe_dump(cfg, allow_unicode=True, sort_keys=False), encoding="utf-8")


def paused_cron(src: Path, dst: Path) -> int:
    jobs_file = src / "jobs.json"
    if not jobs_file.is_file():
        return 0
    data = json.loads(jobs_file.read_text(encoding="utf-8"))
    jobs = data["jobs"] if isinstance(data, dict) else data
    for job in jobs:
        job["enabled"] = False
    dst.mkdir(parents=True, exist_ok=True)
    (dst / "jobs.json").write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    for db in src.glob("*.db"):
        backup_db(db, dst / db.name)
    return len(jobs)


def copy_home(src: Path, dst: Path) -> dict:
    sanitize_config(src / "config.yaml", dst / "config.yaml")
    for name in DBS:
        backup_db(src / name, dst / name)
    for name in FILES:
        if (src / name).is_file():
            shutil.copy2(src / name, dst / name)
    for name in TREES:
        if (src / name).is_dir():
            shutil.copytree(src / name, dst / name, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".env", "auth*.json", "*.lock"))
    return {"cron_jobs_paused": paused_cron(src / "cron", dst / "cron")}


def main() -> None:
    real, sandbox = Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve()
    port = sys.argv[3] if len(sys.argv) > 3 else "18662"
    if sandbox == real or real in sandbox.parents:
        sys.exit("sandbox home must be outside the real Hermes home")
    if sandbox.exists():
        shutil.rmtree(sandbox)
    report = {"root": copy_home(real, sandbox), "profiles": 0}
    for prof in sorted((real / "profiles").glob("*")):
        if prof.is_dir():
            copy_home(prof, sandbox / "profiles" / prof.name)
            report["profiles"] += 1
    # A placeholder key keeps onboarding from covering the app (as hard.mjs does); it can call nothing.
    (sandbox / ".env").write_text(
        f"API_SERVER_ENABLED=true\nAPI_SERVER_PORT={port}\nANTHROPIC_API_KEY=ops-live-placeholder-not-a-real-key\n",
        encoding="utf-8",
    )
    print(json.dumps(report))


if __name__ == "__main__":
    main()
