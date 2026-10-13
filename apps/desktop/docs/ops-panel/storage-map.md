# Ops panel storage map (P0-03)

Status: documentation only. This file freezes the Canvas mutation-to-storage map. It does not implement A5, does not add routes, and does not edit any profile file.
Repo tree: `hermes-agent` at `005b104a506` (`feat/ops-panel`, branch `ops/P0-03`). Handler lines below are in that tree.
SPEC: vault `01-Projects/Hermes/desktop-ops-panel/SPEC.md` v4, sections 4.1, 4.2, 7, 11.1, 11.2, and rows G27, G29, G30, G31, G32, G33, G34, G35, G36, G57, G86, O42, O50.
PLAN: P2 transactional writes. The transaction steps live in `transaction-contract.md`. This file is the inventory that contract wraps.
Model policy P2 is a write-time rule (SPEC section 4.4). This file does not install `ops-policy.yaml`.

A write cited here is not implemented as an Ops transaction yet. `status: handler` means the route exists and names a real store. `status: read-only` means Canvas must not call a write. `status: proposed` means the hash, manifest, or capability flag is not in this tree.

## 1. How to read an entry

Each Canvas node records:

- SPEC row
- authoritative resource (what the node is allowed to change)
- handler (file:line and symbol) and the storage that handler actually touches
- ownership scope (connection, profile, object)
- affected files or databases
- backup coverage and restore semantics (detail in `transaction-contract.md`)
- whether a missing coverage path disables the write

The renderer never writes these files. There is no Electron filesystem fallback (SPEC section 11.1). A standalone `POST /api/profiles/{n}/snapshot` followed by PUT is not a valid write. See `transaction-contract.md` section 2.

## 2. Profile homes and backup roots

Two homes. Do not invent `profiles/default`.

| Profile | Home | Code |
|---|---|---|
| root / default | `get_default_hermes_root()` (this machine: `C:\Users\nachi\AppData\Local\hermes`, SPEC section 0) | `hermes_cli/profiles.py:293` `_get_default_hermes_home`; `get_profile_dir("default")` at `hermes_cli/profiles.py:433` |
| named `<name>` | `<default-root>/profiles/<name>` | `hermes_cli/profiles.py:287` `_get_profiles_root`; `hermes_cli/profiles.py:442` |

`config.yaml` is `<home>/config.yaml` (`hermes_cli/config.py:436` `get_config_path`). `.env` is `<home>/.env` (`hermes_cli/config.py:477` `get_env_path`). `save_config` replaces that yaml via `atomic_config_replace` (`hermes_cli/config.py:2456`, call at `:2495`).

Ops backup root, retain-all (D10), is always `<profile home>/backups/ops-panel/`. That spells two ways because the homes differ:

- default / root: `<default-root>/backups/ops-panel/<YYYYMMDD-HHMMSS>Z-<node>-<seq>/`
- named: `<default-root>/profiles/<name>/backups/ops-panel/<YYYYMMDD-HHMMSS>Z-<node>-<seq>/`

`<seq>` is a per-profile monotonic suffix so two saves in the same second do not share a directory. If the directory already exists, backup fails and the write aborts. Nothing in this tree is pruned. `hermes_cli/backup.py` quick snapshots (`state-snapshots`, keep 20, `hermes_cli/backup.py:1057` and `:1079`) are a different store. Ops must not write there and must not call that pruner.

Operator dirs already under `backups/ops-panel/` (SPEC section 0 model-migration and policy-cleanup) stay. D10 applies to the whole `backups/ops-panel` tree, not only to new A5 dirs.

## 3. Shared files

These files are touched by more than one node. A node's restore must not byte-replace the whole file unless that node owns the document.

| File | Nodes that write it | Who owns a byte-exact restore |
|---|---|---|
| `<home>/config.yaml` | Model, Tools toggle, MCP, Skills toggle, Memory provider select, Channels enabled, Trigger enable, raw YAML | raw YAML only |
| `<home>/.env` | Channels secrets, Toolset env, Memory-provider secrets, MCP bearer, O42 secret writes | none (resource-specific key replace) |
| `<home>/cron/jobs.json` | Schedule | Schedule node restore of the whole file; a single job restore is resource-specific |
| `<home>/profile.yaml` | Identity description | none (resource-specific keys) |
| `<home>/SOUL.md` | Prompt | Prompt (byte-exact) |
| `<home>/webhook_subscriptions.json` | Trigger subscriptions | Trigger (byte-exact of this file) |
| `<home>/skills/<category?>/<name>/SKILL.md` | Skills content | that skill file (byte-exact) |

`state.db`, `cron/executions.db`, `cron/output/`, `memories/MEMORY.md`, and `kanban.db` are not Canvas node stores. A node write must not include them in coverage and must not restore them.

## 4. Node map

### 4.1 Schedule (G27)

- Resource: one profile's cron job records. Display ownership is `origin` on the job (D9, `cron/jobs.py:1932`). The file written is the store that holds the id, not a second profile's copy.
- Handlers: `hermes_cli/web_routers/cron.py:683` `create_cron_job`, `:714` `update_cron_job`, `:719` `pause_cron_job`, `:724` `resume_cron_job`, `:734` `delete_cron_job`. They call `cron.jobs` under `_cron_store_scope` (`hermes_cli/web_server_cron.py:160`).
- Storage authority: per-profile `cron/jobs.json`. `cron/jobs.py:77-89` anchors `CRON_DIR` at `get_hermes_home()`, not the shared default root. Named profile: `<profiles>/<name>/cron/jobs.json`. Default: `<default-root>/cron/jobs.json`. `save_jobs` replaces that file with `atomic_replace` (`cron/jobs.py:1566`, `:1592`).
- Scope: connection must be local (D11). Profile is the holding profile from `_job_owner_profile` (`hermes_cli/web_routers/cron.py:79`). A `?profile=` hint is not proof of ownership. Object id is the job id.
- Not this node: `POST /api/cron/jobs/{id}/trigger` (`hermes_cli/web_routers/cron.py:729`) fires a run. It is not a Schedule save. `POST /api/cron/fire` (`hermes_cli/web_routers/cron.py:739`) is a webhook, not Canvas.
- Shared-cron rule: do not funnel every profile into the default-root `jobs.json` (`cron/jobs.py:77-84`). The same id can exist in two profiles because a file was copied (`hermes_cli/web_routers/cron.py:119`). Backup covers only the holding file. The other copy is not updated. External scheduler reconcile (`hermes_cli/web_server_cron.py:176`) mutates a remote registry that is not this file. If `resolve_cron_scheduler()` is not the in-process ticker, coverage of that registry is missing and the Canvas write is disabled. The in-process ticker only re-reads `jobs.json` (`hermes_cli/web_server_cron.py:183`) and does not add a file.
- Restore: single-job save is resource-specific (that job record, or its absence on delete). Whole-node History restore is byte-exact of that profile's `jobs.json`. `executions.db` is not restored.
- Coverage: the holding `jobs.json` only. Missing file permissions or an external registry side effect disables the write.

### 4.2 Trigger / webhooks (acceptance list; G28 is a sibling read, not this card's verify row)

- Resource: webhook subscriptions plus the webhook platform enabled flag.
- Handlers: `hermes_cli/web_routers/ops.py:172` `enable_webhooks`, `:190` `create_webhook`, `:254` `delete_webhook`, `:270` `set_webhook_enabled`. List read is `:154` `list_webhooks` and returns `secret_set`, not the secret (`hermes_cli/web_routers/ops.py:148`).
- Storage authority: `<home>/webhook_subscriptions.json`, mode `0o600` (`hermes_cli/webhook.py:20-33`, `:31` `_subscriptions_path`, `:72` `atomic_json_write`). Enable also writes `platforms.webhook.enabled` in `config.yaml` via `_write_platform_enabled` (`hermes_cli/web_server_messaging.py:326` to `hermes_cli/config.py:2095` `write_platform_config_field`).
- Scope: local connection, `?profile=` home. Object id is the subscription name. Create returns the HMAC secret once (`hermes_cli/web_routers/ops.py:242`). The Ops renderer must not receive that field. Main process strips it before IPC. The renderer sees `secret_set` only.
- Enable restarts the gateway (`hermes_cli/web_routers/ops.py:180`). That restart is after a successful transaction, never after a backup failure.
- Restore: byte-exact of `webhook_subscriptions.json` for subscription history. Enable/disable of the platform is resource-specific on `platforms.webhook.enabled`. No secret diff in the UI.
- Coverage: the subscriptions file, plus `config.yaml` when the mutation changes the enabled flag. A provider `save` path outside the profile home disables the write. There is no such path on these handlers.

### 4.3 Channels (G29)

- Resource: one platform's credential presence and enabled flag. Not another profile's `.env`.
- Handler: `hermes_cli/web_routers/messaging.py:883` `update_messaging_platform`. Multiplex port conflict returns 409 before any write (`:889-897`).
- Storage authority: `.env` keys in the platform's `env_vars` via `save_env_value` / `remove_env_value` (`messaging.py:922-925`, `hermes_cli/config.py:2763`). Enabled flag via `_write_platform_enabled` into `config.yaml` `platforms.<id>.enabled` (`hermes_cli/web_routers/messaging.py:927`).
- Read shape today: `is_set` plus `redacted_value`, and `value` only for list fields (`messaging.py:244-247`). Comment at `hermes_cli/web_routers/messaging.py:143` says comma-separated allowlist ids are not secrets. Ops still must not forward `redacted_value`, `value` of a password field, or a diff. Renderer payload is `{key, required, is_set}` for secrets. Allowlist ids may be shown as ids, never as a secret diff.
- Scope: local connection, profile home. Object id is `platform_id`.
- Restore: resource-specific. Restore named `.env` keys and the enabled flag from the backup. Do not byte-replace `.env` or `config.yaml`. Secret restore is backend-only; the renderer sends a backup id, not the secret bytes.
- Coverage: those `.env` keys and `config.yaml` if `enabled` is in the request. A key the handler would write that is not in the copied set disables the write.

### 4.4 Memory (G30)

- Resource: active memory provider, plus that provider's config fields. Not the memory fact store.
- Handlers: `hermes_cli/web_routers/ops.py:507` `set_memory_provider` writes `config.yaml` `memory.provider` (`:521-522`). `hermes_cli/web_routers/memory_providers.py:551` `update_memory_provider_config` and `:528` `setup_memory_provider`. Declared schemas write `config.yaml` memory section (`hermes_cli/web_routers/memory_providers.py:308`) and secrets to `.env` (`:134` `_save_submitted_secrets`). Flat JSON is `<home>/<provider.name>/config.json` (`:117`). Honcho uses `resolve_config_path()` (`:125`). Legacy providers may call `provider.save_config` (`:456`).
- Read: `GET /api/memory` (`hermes_cli/web_routers/ops.py:491`) reports sizes of `memories/MEMORY.md` and `memories/USER.md` (`hermes_cli/web_routers/ops.py:488`). Those files are not the Canvas save. `POST /api/memory/reset` (`hermes_cli/web_routers/ops.py:528`) is not a Memory-node save and is not enabled by this contract.
- Scope: local connection, profile home. Object id is the provider name.
- Restore: resource-specific for `memory.provider` and the provider's config keys. Byte-exact only for a provider config file that the mutation replaced as a whole (`config.json` or the Honcho path), and only that file. `MEMORY.md` / `USER.md` are not restored by this node.
- Coverage: every path the chosen provider's writer touches. If `save_config` or `resolve_config_path()` returns a path outside the profile home, or the path cannot be copied, the write is disabled. Do not save `config.yaml` and skip the external file.

### 4.5 Identity / Description (G31)

- Resource: `profile.yaml` `description` and `description_auto`. The profile id (directory name) is not this write.
- Handler: `hermes_cli/web_routers/profiles.py:1035` `update_profile_description_endpoint` calls `write_profile_meta` (`hermes_cli/profiles.py:978`) which merges those keys and `atomic_yaml_write`s `profile.yaml` (`hermes_cli/profiles.py:990`, `:1015`).
- Not this node: `PATCH /api/profiles/{name}` rename (`hermes_cli/web_routers/profiles.py:958`) and `DELETE` (`:977`). They are not Canvas Identity saves. They are not covered here, so Canvas must not call them.
- Scope: local connection, the resolved profile dir (`hermes_cli/profiles.py:430`). Object id is the profile name.
- Restore: resource-specific. Put back `description` and `description_auto` only. Do not restore `role`, `display_name`, or `previous_names` from an Identity backup (other writers own those keys; `write_profile_meta` says no client-facing writer passes `role`, `hermes_cli/profiles.py:984`).
- Coverage: `profile.yaml`. If the file cannot be copied, the write is disabled.

### 4.6 Prompt / SOUL (G32, G57, G86)

- Resource: `SOUL.md` bytes. Version is the backup sequence for this node. Owner is the last A5 manifest actor (G32). There is no owner field on the file.
- Handler: `hermes_cli/web_routers/profiles.py:1013` `update_profile_soul`. Read is `:998` `get_profile_soul`. Write is `atomic_write_text` (`:1024`). An interrupted bare write is the bug that helper exists to avoid (`:1019`).
- G86: an optional change note is stored on the manifest, not inside `SOUL.md`. The Prompt node shows that note. It is not a diff and not a secret.
- G57: Prompt has its own dirty bit and its own transaction. Header "Save all" is N transactions (`transaction-contract.md` section 6).
- Scope: local connection, profile home. Object id is the profile name.
- Restore: byte-exact of `SOUL.md` (SPEC section 4.5). The note is not written back into the file. Restoring also writes a new manifest (restore is a mutation).
- Coverage: `SOUL.md` only. Missing copy disables the write.

### 4.7 Model (G36, O50)

- Resource: `config.yaml` `model` assignment for that profile (`provider` and `model`, plus whatever `_apply_main_model_assignment` writes).
- Handler: `hermes_cli/web_routers/profiles.py:1049` `update_profile_model_endpoint` to `_write_profile_model` (`hermes_cli/web_routers/profiles.py:123`), which `save_config`s under the profile scope (`:140-143`).
- O50 chip uses this same transaction. It must not call `POST /api/model/set` (`hermes_cli/web_routers/models.py:376`). That route writes the launch profile and is not an Ops A5 path. This card does not change it. Ops must not use it.
- Validation includes A6 (SPEC section 4.4) on `model.provider` / `model.default`. Disallowed selection is refused (D13). An existing violation on a different field does not block an unrelated edit.
- Scope: local connection, profile home.
- Restore: resource-specific on the model assignment keys. Not a byte-exact `config.yaml` replace (other nodes share the file). Restoring a disallowed pair is a selection and is blocked.
- Coverage: `config.yaml`. Missing copy disables the write.

### 4.8 Tools / MCP (G33)

- Resource: toolset enablement, toolset provider/model selection, toolset env keys, and `config.yaml` `mcp_servers` entries. Outglow "tools" are these, not a connector catalog (G33).
- Handlers:
  - `hermes_cli/web_routers/tools.py:280` `toggle_toolset` writes `platform_toolsets` via `_save_platform_tools`, or a config-only section `enabled` flag (`:296-308`), then `save_config`.
  - `hermes_cli/web_routers/tools.py:472` `select_toolset_model` and `:504` `select_toolset_provider` are the same file (`config.yaml`). They are child writes of this node and use the same transaction.
  - `hermes_cli/web_routers/tools.py:590` `save_toolset_env` writes allowed keys to `.env` (`:617`) and returns `is_set` (`:628`). Blank value means leave unchanged (`:593`). Ops renderer gets names and `is_set` only.
  - MCP: `hermes_cli/web_routers/mcp.py:110` `add_mcp_server`, `:160` `replace_mcp_servers`, `:183` `remove_mcp_server`, `:372` `set_mcp_server_enabled`. Authority is `config.yaml` `mcp_servers` (`hermes_cli/mcp_config.py:210`, `:233` `_save_mcp_server`). The UI label "mcp.json" is not a second file on this path. Plugin-owned servers are not modified (`mcp.py:382-385`, 409).
  - Bearer tokens: `hermes_cli/mcp_config.py:336` `_save_bearer_auth_token` writes `.env`, not the yaml value.
- After a committed toolset enable, the handler may spawn `hermes tools post-setup` (`tools.py:312-336`). That spawn is outside the replace. Backup failure must happen before the spawn. History restore of the enabled flag does not uninstall binaries.
- Scope: local connection, profile home. Object id is the toolset name or MCP server name.
- Restore: resource-specific on the toolset keys, `mcp_servers.<name>`, and named `.env` keys. Not byte-exact `config.yaml`. No secret diff.
- Coverage: `config.yaml` for toggles and MCP maps; `.env` for env and bearer writes. If a write would touch both, both must be copied or the write is disabled. Post-setup binaries are not coverage and do not block the config write.

### 4.9 Skills (G35)

- Resource: the disabled-skill set, and `SKILL.md` for a profile-local skill the user is creating or replacing.
- Handlers: `hermes_cli/web_routers/skills.py:379` `toggle_skill` writes the disabled list through `save_disabled_skills` into `config.yaml` (`:381-391`). `hermes_cli/web_routers/skills.py:418` `create_skill` and `:433` `update_skill_content` call `_create_skill` / `_edit_skill` (`tools/skill_manager_tool.py:453`, `:494`). The file is `<home>/skills/.../SKILL.md` when `_skills_dir()` is the profile home (`skill_manager_tool.py:73-81`).
- Hub install (`hermes_cli/web_routers/skills.py:97`) is not this node's toggle. If a later card wires "Add all", each installed file must be in coverage or that install is disabled. This card does not enable it.
- Scope: local connection, profile home. Object id is the skill name.
- Skill files outside the profile home (bundled repo skills, external dirs from `get_all_skills_dirs`) are not covered. Canvas content write is disabled unless the resolved `SKILL.md` is under the profile home and can be copied. Toggle of a name only needs `config.yaml`, even if the skill body lives elsewhere.
- Restore: toggle is resource-specific (disabled-list membership). Content is byte-exact of that `SKILL.md`. Supporting files (`references/`, scripts) are not written by these two handlers. A write of those files is disabled until each path is in coverage.
- Coverage: `config.yaml` for toggle; the target `SKILL.md` for content. Missing either disables that write.

### 4.10 Configured Delegation / Sub-agents (G34)

- Resource: read-only projection of `config.yaml` `delegation` (`max_iterations`, `model`, `provider`, `base_url`, `api_key` default shape at `hermes_cli/cli_config_load.py:219-220`).
- Handler: none for Canvas. SPEC section 4.1 Adapter A4 is a read. `api_key` is a secret: the projection the renderer gets is set/unset, never the value, never a diff.
- `GET /api/config` (`hermes_cli/web_routers/config_env.py:80`) can return the block to a privileged client. Ops must strip `delegation.api_key` before the renderer. There is no Save, no dirty bit, no History restore on this node.
- Raw YAML may still contain a `delegation` block. That is the raw-YAML transaction (section 4.11), not a Delegation-node write. After it commits, this node re-reads and stays read-only.
- A write attempted on this node is refused. Missing coverage is not the reason. The reason is read-only (SPEC section 11.9, acceptance).

### 4.11 Raw YAML

- Resource: the whole `config.yaml` document.
- Handler: `hermes_cli/web_routers/analytics.py:53` `update_config_raw`. It `yaml.safe_load`s, requires a mapping (`:56-58`), and `save_config(..., merge_existing=False)` (`:64`). That is a full-document replacement, not a merge. The schema PUT is a different route: `hermes_cli/web_routers/config_env.py:117` `update_config` deep-merges (`:126-133`). Canvas raw drawer uses the raw route, not the schema PUT.
- Read: `hermes_cli/web_routers/analytics.py:34` `get_config_raw` returns `yaml` and `path`.
- Scope: local connection, profile home (`_profile_scope`).
- A6 runs on governed fields before replace (SPEC section 4.4). A disallowed model in the document blocks the save, including a restore of those bytes.
- Restore: byte-exact of `config.yaml`. This is the only node that restores the whole file. It still runs the transaction, including a new backup of the current file first.
- Coverage: `config.yaml`. The editor does not write `.env`. A raw document that only changes yaml does not need `.env` in coverage. If the implementation cannot copy `config.yaml`, the write is disabled.

### 4.12 Secrets surface (O42)

- Resource: env key names and set/unset. Not values.
- Read handler: `hermes_cli/web_routers/config_env.py:259` `get_env_vars`. Today it also returns `redacted_value` (`:279`, sentinel built at `hermes_cli/web_routers/_common.py:127`). Ops renderer drops `redacted_value`. It does not call `POST /api/env/reveal` (`hermes_cli/web_routers/config_env.py:1086`).
- Write handler, if Canvas offers a set/clear: `hermes_cli/web_routers/config_env.py:328` `set_env_var` and `:1067` `remove_env_var`, through `save_env_value` (`hermes_cli/config.py:2763`) into `<home>/.env`. A redacted preview is refused as a write (`hermes_cli/web_routers/config_env.py:335`, `hermes_cli/web_routers/_common.py:122`).
- Scope: local connection, profile home. Object id is the env key name.
- Restore: resource-specific per key, backend-only. No diff.
- Coverage: `.env`, and `config.yaml` if `save_provider_env_credential` also rewrites a mirrored `api_key` (`hermes_cli/web_routers/config_env.py:330`). If either file would change and cannot be copied, the write is disabled.

## 5. Trace index

Judge: open the handler line, then the storage line. Both must exist in this tree.

| Node | Row | Handler | Storage authority |
|---|---|---|---|
| Schedule | G27 | `hermes_cli/web_routers/cron.py:683` `create_cron_job` (also `:714` `:719` `:724` `:734`) | `cron/jobs.py:89` `JOBS_FILE` under profile home |
| Trigger | acceptance | `hermes_cli/web_routers/ops.py:190` `create_webhook` (also `:172` `:254` `:270`) | `hermes_cli/webhook.py:31` `webhook_subscriptions.json` |
| Channels | G29 | `hermes_cli/web_routers/messaging.py:883` `update_messaging_platform` | `hermes_cli/config.py:477` `.env`; `hermes_cli/config.py:2095` platform enabled |
| Memory | G30 | `hermes_cli/web_routers/ops.py:507` `set_memory_provider`; `hermes_cli/web_routers/memory_providers.py:551` | `config.yaml` `memory`; `hermes_cli/web_routers/memory_providers.py:117` `config.json` |
| Identity | G31 | `hermes_cli/web_routers/profiles.py:1035` `update_profile_description_endpoint` | `hermes_cli/profiles.py:990` `profile.yaml` |
| Prompt | G32 G86 | `hermes_cli/web_routers/profiles.py:1013` `update_profile_soul` | `<home>/SOUL.md` via `atomic_write_text` |
| Model | G36 O50 | `hermes_cli/web_routers/profiles.py:1049` `update_profile_model_endpoint` | `hermes_cli/web_routers/profiles.py:123` `_write_profile_model` to `config.yaml` |
| Tools/MCP | G33 | `hermes_cli/web_routers/tools.py:280` `toggle_toolset`; `hermes_cli/web_routers/mcp.py:110` `add_mcp_server` | `config.yaml` `platform_toolsets` / `mcp_servers`; `.env` for secrets |
| Skills | G35 | `hermes_cli/web_routers/skills.py:379` `toggle_skill`; `:433` `update_skill_content` | `config.yaml` disabled list; `tools/skill_manager_tool.py:73` profile `skills/` |
| Delegation | G34 | no Canvas write | `hermes_cli/cli_config_load.py:220` `delegation` block, read-only |
| Raw YAML | SPEC 4.2 | `hermes_cli/web_routers/analytics.py:53` `update_config_raw` | `hermes_cli/config.py:436` `config.yaml`, full replace |
| Secrets | O42 | `hermes_cli/web_routers/config_env.py:259` `get_env_vars` (read); `:328` `set_env_var` (write) | `hermes_cli/config.py:477` `.env`; renderer sees names and set/unset only |

G57 is not a store. It is the dirty/save gate in `transaction-contract.md` section 6.
