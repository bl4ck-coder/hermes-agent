# Ops panel storage map (P0-03 r2)

Status: documentation only. This file freezes the Canvas mutation-to-storage map. It does not implement A5, does not add routes, and does not edit any profile file.
Repo tree for handler lines: `feat/ops-panel` at `005b104a506`, which this branch still contains. No handler in that tree is an Ops transaction yet.
SPEC: vault `01-Projects/Hermes/desktop-ops-panel/SPEC.md` v4, sections 4.1, 4.2, 7, 11.1, and rows G27, G29, G30, G31, G32, G33, G34, G35, G36, G57, G86, O42, O50.
PLAN: P2 transactional writes. The step order, lock, journal, encryption, and restore byte-writer live in `transaction-contract.md`. This file is the inventory that contract wraps.
Model policy P2 is a write-time rule (SPEC section 4.4). This file does not install `ops-policy.yaml`.

Round 2 closes META IMPROVE r1 F1–F4. F1 (lock, composite hash, journal, read-back) and F3 (encrypted recoverable backups) are in `transaction-contract.md` sections 3–7 and 10. F2 (absence and byte-exact restore) is section 4 of this file plus `transaction-contract.md` sections 4 and 9. F4 (setup versus write-set) is the per-node Canvas-save line below and `transaction-contract.md` section 11.

`status: handler` means the route exists and names a real store. It does not mean Canvas may call that route intact. `status: read-only` means Canvas must not call a write. `status: disabled` means the route exists but Canvas Save must not use it. `status: proposed` means the hash, lock, journal, protector, or byte-writer is not in this tree.

## 1. How to read an entry

Each Canvas node records:

- SPEC row
- authoritative resource
- endpoint, storage primitive, write-set, and post-commit effects (F4)
- ownership scope (connection, profile, object)
- affected files or databases
- whether a missing coverage path disables the write
- backup class and restore semantics (detail in `transaction-contract.md`)

The renderer never writes these files. There is no Electron filesystem fallback (SPEC section 11.1). A standalone snapshot followed by PUT is not a valid write. See `transaction-contract.md` section 2.

Calling the live endpoint intact is not the A5 commit. Several endpoints install, restart, hot-serve, or publish-then-scan. Those effects are classified below. The publish primitive for every allowed Canvas save is the proposed backend byte-writer in `transaction-contract.md` section 9, not `save_config` on the live path.

## 2. Profile homes and backup roots

Two homes. Do not invent `profiles/default`.

| Profile | Home | Code |
|---|---|---|
| root / default | `get_default_hermes_root()` via `_get_default_hermes_home` (this machine: `C:\Users\nachi\AppData\Local\hermes`, SPEC section 0) | `hermes_cli/profiles.py:293` `_get_default_hermes_home`; `get_profile_dir("default")` at `hermes_cli/profiles.py:433` |
| named `<name>` | `<default-root>/profiles/<name>` | `hermes_cli/profiles.py:287` `_get_profiles_root`; `hermes_cli/profiles.py:442` |

`config.yaml` is `<home>/config.yaml` (`hermes_cli/config.py:436` `get_config_path`). `.env` is `<home>/.env` (`hermes_cli/config.py:477` `get_env_path`). Today's `save_config` replaces that yaml via `atomic_config_replace` after normalize and strip (`hermes_cli/config.py:2483`, call at `:2495`). That path is not the A5 byte-exact restore writer. See `transaction-contract.md` section 9.

Ops backup root, retain-all (D10), is always `<profile home>/backups/ops-panel/`.

- default / root: `<default-root>/backups/ops-panel/<YYYYMMDD-HHMMSS>Z-<node>-<seq>/`
- named: `<default-root>/profiles/<name>/backups/ops-panel/<YYYYMMDD-HHMMSS>Z-<node>-<seq>/`

`<seq>` is monotonic per (profile, node). It is the same integer as manifest `sequence` in `transaction-contract.md` section 8. Two saves of the same node in the same second do not share a directory. If the directory already exists, backup fails and the write aborts. Nothing in this tree is pruned. `hermes_cli/backup.py` quick snapshots (`state-snapshots`, keep 20, `hermes_cli/backup.py:1057` and `:1079`) are a different store. Ops must not write there and must not call that pruner.

Operator dirs already under `backups/ops-panel/` (SPEC section 0 model-migration and policy-cleanup) stay. D10 applies to the whole `backups/ops-panel` tree, not only to new A5 dirs.

Secret-bearing backups are encrypted envelopes, not mode-`0o600` copies. The class and the protector are in `transaction-contract.md` section 10. A missing protector disables the write. It does not fall back to a plaintext copy.

## 3. Shared files

These files are touched by more than one node. A node's restore must not byte-replace the whole file unless that node owns the document.

| File | Nodes that write it | Backup class | Who owns a byte-exact restore |
|---|---|---|---|
| `<home>/config.yaml` | Model, Tools toggle, MCP, Skills toggle, Memory provider select, Channels enabled, Trigger enable, raw YAML | secret-bearing (always encrypt) | raw YAML only, and only via the byte-writer, not `save_config` |
| `<home>/.env` | Channels secrets, Toolset env, Memory-provider secrets, MCP bearer, O42 secret writes | secret-bearing | none (resource-specific key replace from decrypted bytes) |
| `<home>/cron/jobs.json` | Schedule | not secret-bearing | Schedule whole-node restore of that file; a single job restore is resource-specific |
| `<home>/profile.yaml` | Identity description | not secret-bearing | none for key restore; absence restore unlinks only under the create rule in section 4.5 |
| `<home>/SOUL.md` | Prompt | not secret-bearing | Prompt (byte-exact) |
| `<home>/webhook_subscriptions.json` | Trigger subscriptions | secret-bearing (HMAC secrets) | Trigger whole-file restore via the byte-writer |
| `<home>/skills/<category?>/<name>/SKILL.md` | Skills content | not secret-bearing | that skill file (byte-exact) |
| `<home>/<provider>/config.json` and the Honcho config path | Memory provider config | secret-bearing | that file, only when the original write replaced it as a whole and the path is inside the profile home |

`state.db`, `cron/executions.db`, `cron/output/`, `memories/MEMORY.md`, `memories/USER.md`, and `kanban.db` are not Canvas node stores. A node write must not include them in coverage and must not restore them.

## 4. Node map

Absence is a real pre-image. A missing coverage file is a tombstone, not `backup_coverage_missing`, when the write-set lists that path and the mutation is allowed to create it. The composite hash includes absence. Restore of a create removes the created path. Detail: `transaction-contract.md` sections 4 and 9.

### 4.1 Schedule (G27)

- Resource: one profile's cron job records. Display ownership is `origin` on the job (D9, `cron/jobs.py:1932`). The file written is the store that holds the id, not a second profile's copy.
- Endpoint: `hermes_cli/web_routers/cron.py:683` `create_cron_job`, `:714` `update_cron_job`, `:719` `pause_cron_job`, `:724` `resume_cron_job`, `:734` `delete_cron_job`. They call `cron.jobs` under `_cron_store_scope` (`hermes_cli/web_server_cron.py:160`).
- Storage primitive to adapt: `cron/jobs.py:1566` `_save_jobs_unlocked` publishes `jobs.json` with `atomic_replace` (`cron/jobs.py:1592`). That helper also merge-loops and re-serializes (`cron/jobs.py:1581`). A5 does not call it as the commit. Whole-file restore publishes the backup bytes. A forward job edit stages the post-image bytes, then the byte-writer publishes those bytes.
- Storage authority: per-profile `cron/jobs.json`. `cron/jobs.py:77` anchors the store at `get_hermes_home()`, not the shared default root. `cron/jobs.py:89` `JOBS_FILE`. Named profile: `<profiles>/<name>/cron/jobs.json`. Default: `<default-root>/cron/jobs.json`.
- Write-set: the holding `jobs.json` only.
- Post-commit effects: none for the in-process ticker. It re-reads `jobs.json` (`hermes_cli/web_server_cron.py:183`). `create_job_with_scheduler_registration` (`hermes_cli/web_server_cron.py:164`) is not called by Canvas. External reconcile (`hermes_cli/web_server_cron.py:176`) is not a post-commit effect; it disables the write.
- Canvas save: allowed only when `resolve_cron_scheduler()` is the in-process ticker. If it is not, coverage of the remote registry is missing and the Canvas write is disabled.
- Scope: connection must be local (D11). Profile is the holding profile from `_job_owner_profile` (`hermes_cli/web_routers/cron.py:79`). A `?profile=` hint is not proof of ownership. Object id is the job id.
- Not this node: `POST /api/cron/jobs/{id}/trigger` (`hermes_cli/web_routers/cron.py:729`) fires a run. It is not a Schedule save. `POST /api/cron/fire` (`hermes_cli/web_routers/cron.py:739`) is a webhook, not Canvas.
- Shared-cron rule: do not funnel every profile into the default-root `jobs.json` (`cron/jobs.py:77`). The same id can exist in two profiles because a file was copied (`hermes_cli/web_routers/cron.py:119`). Backup covers only the holding file.
- Absence: if `jobs.json` does not exist, a create records a tombstone. Restore of that backup unlinks `jobs.json`. A single-job edit of an existing file is resource-specific and does not unlink the file.
- Restore: single-job save is resource-specific (that job record, or its absence on delete). Whole-node History restore is byte-exact of that profile's `jobs.json` via the byte-writer, not via `_save_jobs_unlocked`. `executions.db` is not restored.
- Coverage: the holding `jobs.json` only. An external registry disables the write.

### 4.2 Trigger / webhooks

- Resource: webhook subscriptions plus the webhook platform enabled flag.
- Endpoints: `hermes_cli/web_routers/ops.py:172` `enable_webhooks`, `:190` `create_webhook`, `:254` `delete_webhook`, `:270` `set_webhook_enabled`. List read is `hermes_cli/web_routers/ops.py:154` `list_webhooks` and returns `secret_set`, not the secret (`hermes_cli/web_routers/ops.py:148`).
- Storage primitive: `<home>/webhook_subscriptions.json`, mode `0o600` (`hermes_cli/webhook.py:20`, `:31` `_subscriptions_path`, `:72` `atomic_json_write`). Writers already take `_subscriptions_lock` (`hermes_cli/webhook.py:41`). Enable also writes `platforms.webhook.enabled` through `_write_platform_enabled` (`hermes_cli/web_server_messaging.py:326` to `hermes_cli/config.py:2095` `write_platform_config_field`).
- Write-set: the subscriptions file for create, delete, and per-route enable. Enable-platform adds `config.yaml`. Both must be in the journal when both change. The subscriptions file is secret-bearing.
- Post-commit effects: `enable_webhooks` calls `_restart_gateway_after` at `hermes_cli/web_routers/ops.py:180` after the config write returns. That restart is not part of the write-set. Canvas runs it only after the manifest is committed. It does not run on `backup_failed`, and it does not run before commit. A restart failure does not roll back the enabled flag and is not reported as `backup_failed`. Per-route enable hot-reloads the file (`hermes_cli/web_routers/ops.py:273`). That is a reader of the committed file, not a restart, and it is not invoked by the transaction.
- Canvas save: allowed for the write-set above. Canvas must not call `enable_webhooks` intact, because the restart sits in the endpoint.
- Scope: local connection, `?profile=` home. Object id is the subscription name. Create returns the HMAC secret once (`hermes_cli/web_routers/ops.py:242`). The Ops renderer must not receive that field. Main process strips it before IPC. The renderer sees `secret_set` only.
- Absence: a missing subscriptions file is a tombstone. Creating the first route is a create. Restore of that backup unlinks the file.
- Restore: byte-exact of `webhook_subscriptions.json` through the byte-writer after decrypt. Do not republish via `atomic_json_write` of a re-parsed object (`hermes_cli/webhook.py:72` re-serializes). Enable/disable of the platform is resource-specific on `platforms.webhook.enabled`. No secret diff in the UI.
- Coverage: the subscriptions file, plus `config.yaml` when the mutation changes the enabled flag. A path outside the profile home disables the write. There is no such path on these handlers.

### 4.3 Channels (G29)

- Resource: one platform's credential presence and enabled flag. Not another profile's `.env`.
- Endpoint: `hermes_cli/web_routers/messaging.py:883` `update_messaging_platform`. Multiplex port conflict returns 409 before any write (`hermes_cli/web_routers/messaging.py:889`).
- Storage primitive: `.env` keys in the platform's `env_vars` via `save_env_value` / `remove_env_value` (`hermes_cli/web_routers/messaging.py:922`, `hermes_cli/config.py:2763`). Enabled flag via `_write_platform_enabled` into `config.yaml` (`hermes_cli/web_routers/messaging.py:927`). Those are successive writes, not one commit. A5 stages both post-images and publishes them under one journal.
- Write-set: the named `.env` keys' file (the whole `.env`, secret-bearing) and `config.yaml` when `enabled` is in the request. Both must be copied and journaled, or the write is disabled. Do not write `config.yaml` alone.
- Post-commit effects: `_notify_multiplexer_hot_serve` (`hermes_cli/web_routers/messaging.py:941`). Hot-serve is not coverage. It runs only after manifest commit. It does not run on `backup_failed` or before commit. A hot-serve failure does not roll back `.env` or `config.yaml` and is not `backup_failed`.
- Canvas save: allowed for that write-set. Canvas must not call the endpoint intact, because hot-serve is inside the request after the writes.
- Read shape today: `is_set` plus `redacted_value`, and `value` only for list fields (`hermes_cli/web_routers/messaging.py:244`). Comment at `hermes_cli/web_routers/messaging.py:143` says comma-separated allowlist ids are not secrets. Ops still must not forward `redacted_value`, `value` of a password field, or a diff. Renderer payload is `{key, required, is_set}` for secrets. Allowlist ids may be shown as ids, never as a secret diff.
- Scope: local connection, profile home. Object id is `platform_id`.
- Restore: resource-specific. Apply named `.env` keys and the enabled flag from the decrypted backup onto the current files, then byte-publish those post-images. Do not byte-replace `.env` or `config.yaml`. Secret restore is backend-only; the renderer sends a backup id, not the secret bytes.
- Coverage: those files. A key the handler would write that is not in the copied set disables the write.

### 4.4 Memory (G30)

- Resource: active memory provider, plus that provider's declared config fields. Not the memory fact store. Not dependency installation.
- Canvas-allowed endpoints and primitives:
  - `hermes_cli/web_routers/ops.py:507` `set_memory_provider` writes `config.yaml` `memory.provider` (`hermes_cli/web_routers/ops.py:521`). Write-set: `config.yaml` only. No install. Post-commit: none.
  - Declared config: `hermes_cli/web_routers/memory_providers.py:308` `_update_memory_provider_config` writes the provider file first (`hermes_cli/web_routers/memory_providers.py:309`), then may write `memory.provider` in `config.yaml` (`hermes_cli/web_routers/memory_providers.py:316`). Flat path is `<home>/<provider.name>/config.json` (`hermes_cli/web_routers/memory_providers.py:117`). Honcho path is `resolve_config_path()` (`hermes_cli/web_routers/memory_providers.py:190`). Secrets go to `.env` (`hermes_cli/web_routers/memory_providers.py:134` `_save_submitted_secrets`). Write-set: that provider file, `.env` if a secret field is submitted, and `config.yaml` if the provider name is written. All three are secret-bearing when present. Post-commit: `_invalidate_plugins_hub_cache` (`hermes_cli/web_routers/memory_providers.py:564`) only after manifest commit. Cache invalidation failure does not roll back.
- Canvas-disabled endpoints:
  - `POST /api/memory/providers/{name}/setup` (`hermes_cli/web_routers/memory_providers.py:528` `setup_memory_provider`) persists values (`hermes_cli/web_routers/memory_providers.py:544` `_write_memory_provider_config_values`) and then runs `_install_memory_provider_setup` (`hermes_cli/web_routers/memory_providers.py:384`, called at `:546`). Install commands are not a write-set and are not a post-commit effect of Canvas Save. Canvas must not call this route. Installation stays outside the mutation transaction.
  - Legacy `provider.save_config` (`hermes_cli/web_routers/memory_providers.py:456`). The write-set is not enumerable. Canvas config write for that provider is disabled. Do not infer coverage from a returned path.
  - `POST /api/memory/reset` (`hermes_cli/web_routers/ops.py:528`) is not a Memory-node save.
- Read: `GET /api/memory` (`hermes_cli/web_routers/ops.py:491`) reports sizes of `memories/MEMORY.md` and `memories/USER.md` (`hermes_cli/web_routers/ops.py:488`). Those files are not the Canvas save.
- Scope: local connection, profile home. Object id is the provider name.
- Absence: a missing provider `config.json` is a tombstone when the declared writer would create it. Restore unlinks that file. It does not unlink `config.yaml`.
- Restore: resource-specific for `memory.provider` and declared non-file keys. Byte-exact, after decrypt, only for a provider file the original write replaced as a whole, and only via the byte-writer. `MEMORY.md` / `USER.md` are not restored.
- Coverage: every path in the declared write-set, inside the profile home. A Honcho path outside the profile home disables that provider's config write. Do not save `config.yaml` and skip the external file.

### 4.5 Identity / Description (G31)

- Resource: `profile.yaml` `description` and `description_auto`. The profile id (directory name) is not this write.
- Endpoint: `hermes_cli/web_routers/profiles.py:1035` `update_profile_description_endpoint` calls `write_profile_meta` (`hermes_cli/profiles.py:978`).
- Storage primitive: `write_profile_meta` merges keys and `atomic_yaml_write`s `profile.yaml` (`hermes_cli/profiles.py:990`, `:1015`). It creates the file if missing (`hermes_cli/profiles.py:983`). A5 does not call `atomic_yaml_write` as the restore writer. Forward save stages the merged bytes. Publish is the byte-writer.
- Write-set: `profile.yaml` only.
- Post-commit effects: none.
- Not this node: `PATCH /api/profiles/{name}` rename (`hermes_cli/web_routers/profiles.py:958`) and `DELETE` (`hermes_cli/web_routers/profiles.py:977`). Canvas must not call them.
- Scope: local connection, the resolved profile dir (`hermes_cli/profiles.py:430`). Object id is the profile name.
- Absence: if `profile.yaml` is missing, the save is a create and the manifest records a tombstone. Restore of that backup unlinks `profile.yaml` only when the live file's keys are a subset of `description` and `description_auto`. If another writer has added `role`, `display_name`, or `previous_names`, restore returns 409 conflict and does not unlink. `write_profile_meta` says no client-facing writer passes `role` (`hermes_cli/profiles.py:984`).
- Restore when the file already existed: resource-specific. Put back `description` and `description_auto` only. Do not restore `role`, `display_name`, or `previous_names`.
- Coverage: `profile.yaml`, including the absent tombstone. If a present file cannot be copied, the write is disabled.

### 4.6 Prompt / SOUL (G32, G57, G86)

- Resource: `SOUL.md` bytes. Version is `sequence` for this node. Owner is the last committed or normalized Prompt manifest actor (G32). There is no owner field on the file.
- Endpoint: `hermes_cli/web_routers/profiles.py:1013` `update_profile_soul`. Read is `hermes_cli/web_routers/profiles.py:998` `get_profile_soul`. Today's write is `atomic_write_text` (`hermes_cli/web_routers/profiles.py:1024`). GET decodes `utf-8-sig` (`hermes_cli/web_routers/profiles.py:1005`) and reports a missing file as empty (`hermes_cli/web_routers/profiles.py:1008`). That decoded string is not the hash input.
- Write-set: `SOUL.md` only. Hash is sha256 of the raw file bytes, or the absence marker. The editor must not hash the decoded GET body.
- Post-commit effects: none. The G86 note is a manifest field, not a file write, not a diff, and not a secret.
- G57: Prompt has its own dirty bit and its own transaction. Header "Save all" is N transactions (`transaction-contract.md` section 13).
- Scope: local connection, profile home. Object id is the profile name.
- Absence: a missing `SOUL.md` is a tombstone (`hermes_cli/web_routers/profiles.py:1003`). Create is allowed. Restore of that backup unlinks `SOUL.md`. It does not write an empty file.
- Restore: byte-exact of the backup bytes via the byte-writer. Do not round-trip through the GET decoder. The note is not written back into the file. Restoring also writes a new manifest (restore is a mutation).
- Coverage: `SOUL.md` only, present or tombstoned. A present file that cannot be copied disables the write.

### 4.7 Model (G36, O50)

- Resource: `config.yaml` `model` assignment for that profile (`provider` and `model`, plus whatever `_apply_main_model_assignment` writes).
- Endpoint: `hermes_cli/web_routers/profiles.py:1049` `update_profile_model_endpoint` to `_write_profile_model` (`hermes_cli/web_routers/profiles.py:123`), which `save_config`s under the profile scope (`hermes_cli/web_routers/profiles.py:140`).
- Storage primitive: semantic compute of the model keys, then byte-publish of the staged `config.yaml`. `save_config` on the live file is not the A5 commit. `_CONFIG_MUTATION_LOCK` at `hermes_cli/web_routers/profiles.py:140` covers that function's own read-modify-write. It does not cover the expected-hash window. The Ops lock does. See `transaction-contract.md` section 3.
- Write-set: `config.yaml` (secret-bearing class, so the backup is encrypted even though the edited keys are not secrets).
- Post-commit effects: none on this route. O50 must not call `POST /api/model/set` (`hermes_cli/web_routers/models.py:376`). That route writes the launch profile and is not an Ops A5 path.
- Canvas save: allowed. This chip and `PUT /api/profiles/{n}/model` are the same transaction.
- Validation includes A6 (SPEC section 4.4) on `model.provider` / `model.default`. Disallowed selection is refused (D13). An existing violation on a different field does not block an unrelated edit.
- Scope: local connection, profile home.
- Restore: resource-specific on the model assignment keys, applied to the current file, then byte-published. Not a byte-exact `config.yaml` replace (other nodes share the file). Restoring a disallowed pair is a selection and is blocked. Validation reads a copy. It does not rewrite the backup bytes.
- Coverage: `config.yaml`. Missing copy, or a missing protector, disables the write.

### 4.8 Tools / MCP (G33)

- Resource: toolset enablement, toolset provider/model selection, toolset env keys, and `config.yaml` `mcp_servers` entries. Outglow "tools" are these, not a connector catalog (G33).
- Endpoints and primitives:
  - `hermes_cli/web_routers/tools.py:280` `toggle_toolset` writes `platform_toolsets` via `_save_platform_tools`, or a config-only section `enabled` flag (`hermes_cli/web_routers/tools.py:296`), then `save_config`. Write-set: `config.yaml`.
  - `hermes_cli/web_routers/tools.py:472` `select_toolset_model` and `:504` `select_toolset_provider` write `config.yaml`. Child writes of this node, same transaction shape.
  - `hermes_cli/web_routers/tools.py:590` `save_toolset_env` writes allowed keys to `.env` (`hermes_cli/web_routers/tools.py:617`) and returns `is_set` (`hermes_cli/web_routers/tools.py:628`). Blank value means leave unchanged (`hermes_cli/web_routers/tools.py:593`). Write-set: `.env`. Renderer gets names and `is_set` only.
  - MCP: `hermes_cli/web_routers/mcp.py:110` `add_mcp_server`, `:160` `replace_mcp_servers`, `:183` `remove_mcp_server`, `:372` `set_mcp_server_enabled`. Authority is `config.yaml` `mcp_servers` (`hermes_cli/mcp_config.py:210` `_get_mcp_servers`, `:233` `_save_mcp_server`). The UI label "mcp.json" is not a second file on this path. Plugin-owned servers are not modified (`hermes_cli/web_routers/mcp.py:382`, 409).
  - Bearer tokens: `hermes_cli/mcp_config.py:336` `_save_bearer_auth_token` writes `.env`, not the yaml value. Write-set adds `.env` when a bearer is submitted.
- Write-set rule: if a request would touch `config.yaml` and `.env`, both are in the journal or the request is disabled.
- Post-commit effects, never before manifest commit, never on `backup_failed`:
  - `hermes tools post-setup` spawn inside `toggle_toolset` (`hermes_cli/web_routers/tools.py:333`). A spawn failure does not roll back the config write and is not `backup_failed`.
  - `POST /api/tools/toolsets/{name}/post-setup` (`hermes_cli/web_routers/tools.py:631`) is not a Canvas save. Canvas must not call it as part of Save.
  - `record_mcp_install` (`hermes_cli/web_routers/mcp.py:143`, defined at `hermes_cli/mcp_catalog.py:735`) is telemetry after the config write. It is not coverage. It runs only after manifest commit. Its failure does not roll back `mcp_servers`.
- Canvas save: allowed for the write-sets above. Canvas must not call `toggle_toolset` or `add_mcp_server` intact, because those endpoints spawn or record outside the replace.
- Scope: local connection, profile home. Object id is the toolset name or MCP server name.
- Restore: resource-specific on the toolset keys, `mcp_servers.<name>`, and named `.env` keys. Not byte-exact `config.yaml`. No secret diff. Restore does not uninstall binaries and does not re-run post-setup.
- Coverage: `config.yaml` for toggles and MCP maps; `.env` for env and bearer writes. Post-setup binaries and the metrics event are not coverage.

### 4.9 Skills (G35)

- Resource: the disabled-skill set, and `SKILL.md` for a profile-local skill the user is creating or replacing.
- Endpoints: `hermes_cli/web_routers/skills.py:379` `toggle_skill` writes the disabled list through `save_disabled_skills` (`hermes_cli/skills_config.py:43`) into `config.yaml`. `hermes_cli/web_routers/skills.py:418` `create_skill` and `:433` `update_skill_content` call `_create_skill` / `_edit_skill` (`tools/skill_manager_tool.py:453`, `:494`).
- Storage primitive: the file is `<home>/skills/.../SKILL.md` when `_skills_dir()` is the profile home (`tools/skill_manager_tool.py:73`). `_guarded_write` (`tools/skill_manager_tool.py:395`) writes the live file (`tools/skill_manager_tool.py:406`) and only then scans (`tools/skill_manager_tool.py:407`). On a blocked scan it restores or unlinks (`tools/skill_manager_tool.py:410`). Canvas must not call `_guarded_write` or the content endpoints intact. A5 validates and scans a staged copy (`tools/skill_manager_tool.py:50` `_security_scan_skill` accepts a directory), then byte-publishes. A blocked scan aborts before any live publish.
- Write-set: `config.yaml` for toggle; the target `SKILL.md` for content. A create also records the skill directory if this transaction created it.
- Post-commit effects: prompt-cache clear (`hermes_cli/web_routers/skills.py:429`) only after manifest commit. Advisory lint is not a blocker and is not a rollback.
- Hub install (`hermes_cli/web_routers/skills.py:97`) is not this node's toggle. This card does not enable it.
- Scope: local connection, profile home. Object id is the skill name.
- Skill files outside the profile home (bundled repo skills, external dirs from `get_all_skills_dirs`, `tools/skill_manager_tool.py:268`) are not covered. Canvas content write is disabled unless the resolved `SKILL.md` is under the profile home and can be copied or tombstoned. Toggle of a name only needs `config.yaml`.
- Absence: create of a missing `SKILL.md` records a tombstone. Restore unlinks `SKILL.md` and `rmdir`s the skill directory only if the journal recorded that this transaction created it and the directory is empty. It does not `rmtree`.
- Restore: toggle is resource-specific (disabled-list membership). Content is byte-exact of that `SKILL.md` via the byte-writer. Supporting files are not written by these handlers. A write of those files is disabled until each path is in coverage.
- Coverage: `config.yaml` for toggle; the target `SKILL.md` for content. Missing either disables that write.

### 4.10 Configured Delegation / Sub-agents (G34)

- Resource: read-only projection of `config.yaml` `delegation` (`max_iterations`, `model`, `provider`, `base_url`, `api_key` default shape at `hermes_cli/cli_config_load.py:219`).
- Handler: none for Canvas. SPEC section 4.1 Adapter A4 is a read. `api_key` is a secret: the projection the renderer gets is set/unset, never the value, never a diff.
- `GET /api/config` (`hermes_cli/web_routers/config_env.py:80`) can return the block to a privileged client. Ops must strip `delegation.api_key` before the renderer. There is no Save, no dirty bit, no History restore on this node.
- Raw YAML may still contain a `delegation` block. That is the raw-YAML transaction (section 4.11), not a Delegation-node write. After it commits, this node re-reads and stays read-only.
- A write attempted on this node is refused. Missing coverage is not the reason. The reason is read-only (SPEC section 11.9, acceptance).

### 4.11 Raw YAML

- Resource: the whole `config.yaml` document.
- Endpoint: `hermes_cli/web_routers/analytics.py:53` `update_config_raw`. It `yaml.safe_load`s, requires a mapping (`hermes_cli/web_routers/analytics.py:56`), and `save_config(..., merge_existing=False)` (`hermes_cli/web_routers/analytics.py:64`). That is a semantic replace. `save_config` canonicalizes and strips (`hermes_cli/config.py:2483`, `:2495`). Comments, BOM, CRLF, and key order are not preserved on a forward save. The schema PUT is a different route: `hermes_cli/web_routers/config_env.py:117` `update_config` deep-merges (`hermes_cli/web_routers/config_env.py:128`). Canvas raw drawer uses the raw route's semantics for a forward save, not the schema PUT, and does not use either route as the byte-exact restore path.
- Read: `hermes_cli/web_routers/analytics.py:34` `get_config_raw` returns `yaml` and `path`. The GET text is not the hash input. Hash the raw file bytes.
- Write-set: `config.yaml` only. Secret-bearing class: the backup is encrypted even when the editor did not touch a secret key. The editor does not write `.env`.
- Post-commit effects: gateway session-info broadcast when approvals mode changed (`hermes_cli/web_routers/analytics.py:67`) only after manifest commit. It does not run on `backup_failed`.
- Forward save: semantic. Staged bytes are the normalize/strip output. Outcome is `normalized` when those bytes differ from the submitted document and the read-back matches the staged bytes. The UI may say the server normalized. It must not say that for any other mismatch.
- Restore: byte-exact of the decrypted backup via the byte-writer. Do not call `update_config_raw` or `save_config`. Validation parses a copy of the backup bytes. If the copy is not a mapping, or A6 rejects a governed field, restore aborts. The backup bytes are not rewritten. The live file is not rewritten.
- Scope: local connection, profile home.
- A6 runs on governed fields before publish (SPEC section 4.4). A disallowed model in the document blocks the save, including a restore of those bytes.
- Coverage: `config.yaml`. If it cannot be copied, or the protector is missing, the write is disabled.

### 4.12 Secrets surface (O42)

- Resource: env key names and set/unset. Not values.
- Read endpoint: `hermes_cli/web_routers/config_env.py:259` `get_env_vars`. Today it also returns `redacted_value` (`hermes_cli/web_routers/config_env.py:279`, sentinel built at `hermes_cli/web_routers/_common.py:127`). Ops renderer drops `redacted_value`. It does not call `POST /api/env/reveal` (`hermes_cli/web_routers/config_env.py:1086`).
- Write endpoint, if Canvas offers a set/clear: `hermes_cli/web_routers/config_env.py:328` `set_env_var` and `:1067` `remove_env_var`. `set_env_var` writes `.env` and may rewrite a mirrored `api_key` in `config.yaml` (`hermes_cli/web_routers/config_env.py:330`). A redacted preview is refused as a write (`hermes_cli/web_routers/config_env.py:335`, `hermes_cli/web_routers/_common.py:122`).
- Write-set: `.env`, and `config.yaml` if the lifecycle also rewrites a mirrored key. Both are secret-bearing. If either would change and cannot be encrypted into the backup, the write is disabled.
- Post-commit effects: none that Canvas runs. Credential-pool cleanup inside the delete route is part of the semantic compute of the post-image, not a restart. If that cleanup writes a path outside `.env` and `config.yaml`, that path must be named in the write-set or the clear is disabled. This card does not enable a clear whose extra paths are unnamed.
- Scope: local connection, profile home. Object id is the env key name.
- Restore: resource-specific per key, from decrypted backup bytes, backend-only. No diff. Renderer sends `backup_id` only.
- Canvas save: allowed only for a write-set that is fully listed and encryptable.

## 5. Trace index

Judge: open the endpoint line, then the storage line. Both must exist in this tree. The byte-writer, lock, journal, and protector are proposed. They are not in this tree. Do not look them up as symbols.

| Node | Row | Endpoint | Storage authority | Canvas save |
|---|---|---|---|---|
| Schedule | G27 | `hermes_cli/web_routers/cron.py:683` `create_cron_job` (also `:714` `:719` `:724` `:734`) | `cron/jobs.py:89` `JOBS_FILE` under profile home | allowed only for in-process ticker; external registry disables |
| Trigger | acceptance | `hermes_cli/web_routers/ops.py:190` `create_webhook` (also `:172` `:254` `:270`) | `hermes_cli/webhook.py:31` `webhook_subscriptions.json` | allowed; restart at `hermes_cli/web_routers/ops.py:180` is post-commit only |
| Channels | G29 | `hermes_cli/web_routers/messaging.py:883` `update_messaging_platform` | `hermes_cli/config.py:477` `.env`; `hermes_cli/config.py:2095` platform enabled | allowed; hot-serve at `hermes_cli/web_routers/messaging.py:941` is post-commit only |
| Memory provider select | G30 | `hermes_cli/web_routers/ops.py:507` `set_memory_provider` | `config.yaml` `memory.provider` | allowed |
| Memory declared config | G30 | `hermes_cli/web_routers/memory_providers.py:551` `update_memory_provider_config` | `hermes_cli/web_routers/memory_providers.py:117` `config.json`; Honcho path at `:190` | allowed only if every path is inside the profile home |
| Memory setup | G30 | `hermes_cli/web_routers/memory_providers.py:528` `setup_memory_provider` | install at `:546` calls `:384` `_install_memory_provider_setup` | disabled |
| Memory opaque `save_config` | G30 | `hermes_cli/web_routers/memory_providers.py:456` | write-set not enumerable | disabled |
| Identity | G31 | `hermes_cli/web_routers/profiles.py:1035` `update_profile_description_endpoint` | `hermes_cli/profiles.py:990` `profile.yaml` | allowed; create records a tombstone |
| Prompt | G32 G86 | `hermes_cli/web_routers/profiles.py:1013` `update_profile_soul` | `<home>/SOUL.md` | allowed; hash is raw bytes, not the GET at `:1005` |
| Model | G36 O50 | `hermes_cli/web_routers/profiles.py:1049` `update_profile_model_endpoint` | `hermes_cli/web_routers/profiles.py:123` `_write_profile_model` to `config.yaml` | allowed; not `POST /api/model/set` |
| Tools/MCP | G33 | `hermes_cli/web_routers/tools.py:280` `toggle_toolset`; `hermes_cli/web_routers/mcp.py:110` `add_mcp_server` | `config.yaml` `platform_toolsets` / `mcp_servers`; `.env` for secrets | allowed; spawn at `hermes_cli/web_routers/tools.py:333` and telemetry at `hermes_cli/web_routers/mcp.py:143` are post-commit only |
| Skills | G35 | `hermes_cli/web_routers/skills.py:379` `toggle_skill`; `:433` `update_skill_content` | `hermes_cli/skills_config.py:43` disabled list; `tools/skill_manager_tool.py:73` profile `skills/` | allowed; do not call `_guarded_write` (`tools/skill_manager_tool.py:395`) |
| Delegation | G34 | no Canvas write | `hermes_cli/cli_config_load.py:220` `delegation` block, read-only | refused |
| Raw YAML | SPEC 4.2 | `hermes_cli/web_routers/analytics.py:53` `update_config_raw` | `hermes_cli/config.py:436` `config.yaml` | forward save is semantic; restore is byte-exact via the byte-writer, not `save_config` |
| Secrets | O42 | `hermes_cli/web_routers/config_env.py:259` `get_env_vars` (read); `:328` `set_env_var` (write) | `hermes_cli/config.py:477` `.env`; renderer sees names and set/unset only | allowed only when the write-set is fully listed and encryptable |

G57 is not a store. It is the dirty/save gate in `transaction-contract.md` section 13.

## 6. What this round changed

F1: no node treats a handler's internal `atomic_replace` as the multi-file commit. Multi-file nodes (Channels, Trigger enable, Tools with env, Memory declared config, O42 with a config mirror, MCP with bearer) use the journal in `transaction-contract.md` section 6.

F2: Prompt, Identity, and Skills name absence. Raw YAML and Trigger no longer claim byte-exact restore through `save_config` or `atomic_json_write`.

F3: `.env`, `webhook_subscriptions.json`, `config.yaml`, and memory provider config files are secret-bearing. Mode `0o600` is not their backup.

F4: Memory setup and opaque `save_config` are disabled. Restart, hot-serve, post-setup spawn, and MCP telemetry are post-commit effects, not write-set members.
