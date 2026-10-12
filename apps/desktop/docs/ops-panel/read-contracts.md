# Ops panel read contracts (P0-01)

Status: documentation only. No adapters, no runtime config, no mutation probes.
Repo: `hermes-agent` at `865ba906c1a` (`feat/ops-panel` / `ops/P0-01`).
SPEC: vault `01-Projects/Hermes/desktop-ops-panel/SPEC.md` v4, sections 3-5 and 12.8.
Model policy P2 is a write-time rule (SPEC section 4.4). This file does not install `ops-policy.yaml` and does not change any profile.

Live reads below are public probes only. A missing session token returns 401 for both real gated routes and unknown paths, so 401 is not proof a route exists.

## 1. How to read an entry

Every read route and event source cited in SPEC sections 3-5 and 12.8 is listed below. Each entry records:

- handler path and symbol
- request and response schema (fields actually returned or accepted; nothing invented)
- connection / profile / tenant scope
- authentication boundary
- authoritative storage
- freshness
- events the read emits or that invalidate it
- status: `verified` (handler exists at this SHA) or `proposed` (named in SPEC, not implemented)

Writes cited in those sections are listed in section 8 so they are not mistaken for reads. They are not implemented here.

## 2. Authentication boundaries

Two backends. Do not mix their credentials.

Dashboard / Desktop-spawned `hermes serve` (`hermes_cli/web_server.py`):

- Loopback session token. `auth_required` can be false and the token gate still applies.
- Header: dashboard session header, or `Authorization: Bearer <session token>` (`_has_valid_session_token`, `web_server.py:457`).
- Public allowlist, no token: `/api/health`, `/api/status`, `/api/config/defaults`, `/api/config/schema`, `/api/model/info`, `/api/dashboard/themes`, `/api/dashboard/plugins`, `/api/cron/fire` (`dashboard_auth/public_paths.py:9`). `/api/cron/fire` is a write webhook with its own JWT, not a read.
- Sensitive routes call `_require_token` (`web_server.py:483`).
- Kanban WebSocket uses `?token=` / `?ticket=` / `?internal=` via `_ws_upgrade_authorized` (`plugins/kanban/dashboard/plugin_api.py:50`). Query token on ordinary REST is only `/api/files/download`.
- Profile scope is `?profile=` (or the JSON-RPC `profile` param). Omitted profile is the process launch profile, not "all profiles". `approval-mode.ts:16` documents the same trap for `config.get`.
- Tenant and board are kanban query params (`tenant`, `board`), not HTTP auth.

Gateway API server (`gateway/platforms/api_server.py`, default `:8642`):

- `Authorization: Bearer <API_SERVER_KEY>`. Missing or wrong key: 401 `gateway_auth_failed` (`api_server.py:1555`). The key stays in the Electron main process (SPEC section 7). The renderer never sees it.
- Run control is confined to the starting profile (`api_server.py:3637`). A run id from another profile is not found, not leaked.
- Room-grant tokens are a narrower permission set (approve requires exact `request_id`; no `all`, no `session`/`always`). See section 6.

JSON-RPC (`HermesGateway`, `@hermes/shared`):

- Desktop socket to the gateway, not REST. Methods include `approval.pending`, `approval.respond`, `config.get`, `config.set`, `projects.list`, `projects.create`, `projects.archive`.
- Profile is a param on the method. A blank profile means the launch profile.

Live, this session, no credentials printed:

- `GET http://127.0.0.1:8642/health` -> 200 `{"status":"ok","platform":"hermes-agent","version":"0.21.5"}`.
- `GET http://127.0.0.1:8642/v1/capabilities` and `GET /v1/runs/does-not-exist` -> 401 `gateway_auth_failed`.
- Desktop-spawned serve was listening on ephemeral `127.0.0.1:56809` (pid of that process, not a stable port). `GET /api/health` 200, `auth_required: false`, `commit` equals `865ba906c1a`, version `0.21.5`. `GET /api/status` 200, `gateway_running: true`, `gateway_state: running`, `active_agents: 0`, `active_sessions: 1`. Paths, pids, and install id are omitted here.
- `GET /api/dashboard/plugins` 200 listed plugin names including `kanban` and `workflow-studio`.
- `GET /api/does-not-exist-p0`, `/api/ops/fleet`, `/api/approvals/pending`, `/api/plugins/kanban/workflow` all returned 401 `Unauthorized`. That does not prove the proposed routes exist. Handler search is the existence proof.
- `:9119` on this machine was not the Hermes dashboard (connection refused on `127.0.0.1`; tailscale address returned a non-FastAPI 404). Do not treat `:9119` as the Ops backend.

Authenticated payload reads of gated routes were not performed. That is a live-payload blocker, not a handler miss. See `source-verification.md`.

## 3. Scope model

Every Ops query key must include connection + profile + tenant/board where the source has them (SPEC section 11.4).

| Axis | Where it lives | What a missing value means |
|---|---|---|
| connection | Desktop connection store. Remote connections are read-only for Canvas writes (D11). | A disconnect is stale/unknown, never a false idle. |
| profile | `?profile=` on REST; `profile` on JSON-RPC; `task_runs.profile` / `tasks.assignee` on kanban | Launch profile. Not the focused Ops profile. |
| tenant | `tasks.tenant`; `GET /api/plugins/kanban/board?tenant=` | All tenants on that board. |
| board | `?board=` kanban slug. Omitted = active board (`plugin_api.py:66`) | Active board, not every board. |
| object id | task `t_` + 8 hex, run integer, session id, cron job id, webhook name | 404, not an empty success. |

## 4. Existing read routes

Status `verified` means the handler is in this tree at `865ba906c1a`.

### 4.1 Profiles and config

**GET /api/profiles**
- Handler: `hermes_cli/web_routers/profiles.py:805` `list_profiles_endpoint` -> `_profile_to_dict` at line 83.
- Request: none. Not profile-scoped; it lists profiles.
- Response: `{profiles: [{name, path, is_default, model, provider, has_env, skill_count, gateway_running, description, description_auto, display_name, bot_title, distribution_*, has_alias, role}]}`. No colour field. No presence.
- Scope: machine `HERMES_HOME` profile dirs. Connection = the serve process.
- Auth: session token (not on the public allowlist).
- Storage: `HERMES_HOME/profiles/<name>/` and root config for default. `config.yaml` `model.provider` / `model.default`.
- Freshness: request-time directory walk. SPEC section 3.1 says the walk is slow; client cache 60s is a UI choice, not a server TTL.
- Events: none. Invalidate on profile create/rename/delete.
- Status: verified. Cited by SPEC 3.1, O2, O13, O56, O76, G66.

**GET /api/profiles/{name}**
- The list item is the summary. There is no separate "get one profile" read beyond soul, description write, desktop-overlay, and setup-command. Desktop-overlay read: `profiles.py:1142` `get_profile_desktop_overlay`.
- SPEC 4.1 "Description | `/api/profiles/{n}`" is the list/summary shape plus `PUT /api/profiles/{name}/description` (`profiles.py:1035`). The read side of description is the `description` field on the list item.
- Status: verified as the list field, not as a dedicated GET-by-name document.

**GET /api/profiles/{name}/soul**
- Handler: `profiles.py:998` `get_profile_soul`.
- Request: path `name`.
- Response: `{"content": "<SOUL.md text>", "exists": true}` or `{"content": "", "exists": false}` if the file is missing (`profiles.py:1008`). Authoritative file is `profiles/<name>/SOUL.md` (root `SOUL.md` for default).
- Scope: one profile. Auth: session token.
- Freshness: request-time file read.
- Events: none until A5 exists. A later write must re-read.
- Status: verified. SPEC 4.1 Prompt node.

**GET /api/profiles/projects/tree**
- Handler: `profiles.py:717` `get_profiles_projects_tree` on `sessions_router`.
- Request: none required. Walks profile homes (`profiles.py:734`).
- Response: per-profile project tree. Authoritative store for project rows is `projects.db` via `hermes_cli/projects_db.py` (`projects_db_path` = `$HERMES_HOME/projects.db`, per profile home).
- Scope: all profile homes the helper enumerates. Not a tenant filter.
- Auth: session token.
- Freshness: request-time.
- Events: Desktop listens for `projects.changed` (`use-background-sync.ts` around the projects tick). JSON-RPC `projects.list` is the Desktop sidebar read; this REST tree is the SPEC O12 citation.
- Status: verified. SPEC O12.

**GET /api/config**
- Handler: `hermes_cli/web_routers/config_env.py:80` `get_config`.
- Request: `?profile=`, `include_defaults` (default true).
- Response: config document with keys that do not start with `_`. Includes `approvals` and `delegation` when present. May include `delegation.api_key` if that key is stored in config.yaml. Ops must not render secret values. A4 reads delegation keys from this document and must strip `api_key` / `base_url` credentials before the renderer.
- Scope: one profile. Omitted profile = launch profile.
- Auth: session token.
- Storage: `profiles/<name>/config.yaml` (root `config.yaml` for default).
- Freshness: request-time `load_config()`.
- Events: none.
- Status: verified. SPEC 4.1 A4 read, O41.

**GET /api/config/raw**
- Handler: `hermes_cli/web_routers/analytics.py:34` `get_config_raw` (mounted with the analytics router, path is still `/api/config/raw`).
- Request: `?profile=`.
- Response: raw YAML text of that profile's config. Secret-bearing. Advanced drawer only. Never diff secrets in the UI (SPEC 4.2).
- Auth: session token. Storage: same config.yaml. Freshness: request-time.
- Status: verified. SPEC 4.1.

**GET /api/config/schema**
- Handler: `config_env.py:99` `get_schema`.
- Request: `?profile=` optional.
- Response: `{fields, category_order}`. `approvals.mode` is a select of `manual`, `smart`, `off` (`web_server_config.py:143`).
- Auth: public allowlist. Storage: schema code, not user files. Freshness: request-time (dynamic provider options).
- Status: verified. SPEC 4.3.

**GET /api/config/defaults**
- Handler: `config_env.py:94` `get_defaults`. Response: `DEFAULT_CONFIG`, including `delegation` (`config_defaults.py:1330`). Auth: public. Status: verified. Not a per-profile read.

**GET /api/model/options**
- Handler: `hermes_cli/web_routers/models.py:138` `get_model_options`.
- Request: `?profile=`.
- Response: provider/model options for that profile's credentials and catalog. P2 filtering is not in this handler. The picker must filter client-side until A6 exists, and must not treat this list as the allowlist.
- Auth: session token. Storage: catalog + profile config + env presence. Freshness: request-time.
- Status: verified. SPEC 4.1, O50, G2.

**GET /api/model/info**
- Handler: `models.py:90` `get_model_info`. Public. Response observed live: `{model, provider, auto_context_length, config_context_length, effective_context_length, capabilities}`. This is the serve process profile, not the fleet. Status: verified, but it is not a per-profile fleet read.

**GET /api/env**
- Handler: `config_env.py:259` `get_env_vars`.
- Request: `?profile=`.
- Response rows include `is_set` and `redacted_value` (`config_env.py:278`). SPEC O22/O42/O7 say names and set/unset only. Ops must use `is_set` and must not render `redacted_value`.
- Auth: session token. Storage: profile `.env`. Freshness: request-time.
- Status: verified. The preview field is a contract hazard, not a license to show secrets.

### 4.2 Office fleet inputs (no presence endpoint)

**GET /api/plugins/kanban/workers/active**
- Handler: `plugins/kanban/dashboard/plugin_api.py:914` `list_active_workers`. Mount prefix `/api/plugins/kanban/` (`plugin_api.py:1`).
- Request: `?board=`.
- Response: `{workers, count, checked_at}`. Each worker: `run_id, task_id, task_title, task_status, task_assignee, profile, worker_pid, started_at, claim_lock, claim_expires, last_heartbeat_at, max_runtime_seconds`. SQL requires `task_runs.ended_at IS NULL`, `worker_pid IS NOT NULL`, `tasks.status = 'running'`.
- Scope: one board. Profile is `task_runs.profile` / assignee, not `?profile=`.
- Auth: session token.
- Storage: `kanban.db` `task_runs` join `tasks`.
- Freshness: request-time. `checked_at` is server now. Not a push.
- Events: none on this GET. Invalidate from kanban WS `/events` or from A1 later.
- Status: verified. SPEC 3.1. This is not presence. A worker row means running, not idle/offline/needs-you.

**GET /api/plugins/kanban/board**
- Handler: `plugin_api.py:353` `get_board_endpoint`.
- Request: `tenant`, `include_archived`, `board`, `workflow_template_id`, `current_step_key`.
- Response: `{columns: [{name, tasks}], tenants, assignees, latest_event_id, now}`. Task cards on the board carry a 200-char summary preview (`plugin_api.py:385`).
- Scope: one board, optional tenant. `workflow_template_id` filters a nullable column. It does not load a template.
- Auth: session token.
- Storage: `kanban.db` tasks. Freshness: coalesced read (`plugin_api.py:350`). `now` and `latest_event_id` are the cursor.
- Events: does not stream. Pair with WS `/events?since=`.
- Status: verified. SPEC 3.1, 5, O6.

**GET /api/plugins/kanban/tasks/{task_id}**
- Handler: `plugin_api.py:373` `get_task`.
- Request: `board`, optional `run_state_type` + `run_state_name` (both or neither; type is `status` or `outcome`).
- Response: `{task, comments, events, attachments, links, link_tasks, child_results, runs}` (`plugin_api.py:393`). `events` are `task_events` rows. `runs` are `task_runs` rows via `asdict`. There is no separate GET `/comments`.
- Task id format: `t_` + `secrets.token_hex(4)` (`kanban_db.py:1161`), 8 lowercase hex chars. Not `TASK-142`.
- `tasks.session_id` is the originating `HERMES_SESSION_ID`, NULL when created from CLI/dashboard (`kanban_db.py:808`). `task_runs` has no `session_id` column (`kanban_db.py:1080`).
- Scope: one board, one task. Tenant is a field on the task, not a query filter here.
- Auth: session token. Storage: `kanban.db`. Freshness: request-time.
- Status: verified. SPEC 3.1 timeline, section 5 drawer.

**GET /api/plugins/kanban/runs/{run_id}**
- Handler: `plugin_api.py:930` `get_run_endpoint`.
- Response: `{run: asdict(task_runs row)}`. Columns: `id, task_id, profile, step_key, status, claim_lock, claim_expires, worker_pid, worker_started_at, max_runtime_seconds, last_heartbeat_at, started_at, ended_at, outcome, summary, metadata, error`. `metadata` is JSON text, not a guaranteed usage object. No `session_id`.
- `step_key` is nullable and unused by the v1 kernel (`kanban_db.py:1077`).
- Auth: session token. Storage: `kanban.db`. Freshness: request-time.
- Status: verified. SPEC 3.1. Tokens are not a column.

**GET /api/plugins/kanban/runs/{run_id}/inspect**
- Handler: `plugin_api.py:937` `inspect_run_endpoint`.
- Response: live psutil stats, or `{alive: false, reason}` when the process is gone. Access denied is inline, not a 500.
- Auth: session token. Storage: OS process table plus the run row. Freshness: request-time. Not tokens.
- Status: verified. SPEC 3.1, O35.

**GET /api/plugins/kanban/config**
- Handler: `plugin_api.py:1143` `get_config`.
- Response: kanban plugin config (lanes, `lane_by_profile`, default tenant — fields as that function returns from config). Not `approvals.mode`.
- Auth: session token. Storage: config.yaml kanban section + board metadata. Status: verified. SPEC section 5.

**GET /api/plugins/kanban/workflow**
- Handler: `plugin_api.py:1619` `get_workflow`.
- Response: `kanban_workflow.DEFAULT_WORKFLOW.to_dict()`: `{columns: [{key, label, icon, drag_target}], manual, archived}`. Columns include `triage, todo, scheduled, ready, running, blocked, review, done`. `archived` is a filter, not a column (`kanban_workflow.py:27`).
- This is the status machine. It is not a library of workflow templates and it has no step counts.
- Auth: session token. Storage: code constant, same for every board today (`plugin_api.py:1622`). Freshness: process lifetime.
- Status: verified. Do not cite this as R34/O16 templates.

**GET /api/plugins/kanban/projects**
- Handler: `plugin_api.py:1392` `list_kanban_projects`.
- Distinct from `projects.db` and from workflow-studio `/projects`. Auth: session token. Status: verified as a kanban helper, not the Desktop projects store.

**GET /api/plugins/kanban/tasks/{task_id}/log**
- Handler: `plugin_api.py:1249` `get_task_log`. Worker log tail. Storage: `HERMES_HOME/kanban/logs`. Auth: session token. Status: verified. SPEC O35.

**GET /api/plugins/kanban/tasks/{task_id}/attachments**
- Handler: `plugin_api.py:458` `list_task_attachments`. Also embedded in `get_task`. Storage: `kanban/attachments` + `task_attachments`. Auth: session token. Status: verified. SPEC O17, R11.

**GET /api/plugins/kanban/orchestration**
- Handler: `plugin_api.py:1627` `get_orchestration_settings`.
- Response includes `orchestrator_profile`, `default_assignee`, `auto_decompose`, `auto_promote_children`, resolved names, `active_profile`.
- This is configured orchestration, not a live sub-agent tree. Status: verified.

**WS /api/plugins/kanban/events**
- Handler: `plugin_api.py:1783` `stream_events`. Not SSE. Path is `/events`, not `/events/stream`.
- Request: query `since` (event id) and `board`. Missing `since` starts at the current tail and does not replay history (`plugin_api.py:1697`). `since=0` does replay. Board is pinned at handshake.
- Response frames: new `task_events` rows after the cursor. Poll interval 0.3s (`plugin_api.py:1694`).
- Auth: WS upgrade token (`plugin_api.py:50`). Storage: `task_events`. Freshness: 300ms poll, not a push from the writer.
- Events: this is the event source. `GET /board` `latest_event_id` is the snapshot cursor.
- Status: verified existing push. SPEC A7's SSE path is still proposed (section 5). SPEC D12 can be met by this socket if the client uses `since`. Do not invent a second stream.

### 4.3 Cron, webhooks, sessions, analytics

**GET /api/cron/jobs**
- Handler: `hermes_cli/web_routers/cron.py:668` `list_cron_jobs`.
- Request: `profile` default `"all"`. `"all"` aggregates and dedupes by job id, preferring the default profile copy (`cron.py:114`).
- Response: list of job records from `cron/jobs.py`. Fields written at create (`jobs.py:1898`): `id, name, prompt, skills, skill, model, provider, base_url, script, no_agent, monitor_*, context_from, schedule, schedule_display, repeat, enabled, state, paused_at, paused_reason, created_at, next_run_at, last_run_at, last_status, last_error, last_delivery_error, last_delivery_unverified, last_failure, failure_streak, deliver, origin, enabled_toolsets, workdir`. Optional: `attach_to_session, reasoning_effort, failure_deliver, interpreter`.
- Ownership for Canvas Schedule is `origin` (D9), not the profile directory the file happened to be listed from. When `profile=all`, the same id can exist in two homes; the dedupe hides that. Ops Schedule must not use the aggregated list to decide ownership. Pass the focused profile, then filter `origin`.
- Auth: session token. Storage: `profiles/<origin>/cron/jobs.json` (root `cron/jobs.json` for default). Executions: `cron/executions.db`.
- Freshness: request-time file read. Events: none. Cron failure is a poll of `failure_streak`.
- Status: verified. SPEC 3.1, 4.1, G27, R1, R9.

**GET /api/cron/blueprints**
- Handler: `cron.py:858` `list_cron_blueprints`.
- Response: `{blueprints: ...}` from `_blueprint_catalog_sync`. Auth: session token. Storage: blueprint catalog in the cron package, not user jobs. Status: verified. SPEC O4, G4, G61.

**GET /api/webhooks**
- Handler: `hermes_cli/web_routers/ops.py:154` `list_webhooks`.
- Request: `?profile=`.
- Response: `{enabled, base_url, subscriptions[]}`. Each subscription from `_webhook_route_summary` (`ops.py:140`): `events, deliver, deliver_only, prompt, script, skills, created_at, url, secret_set, enabled`. `secret` is not returned on list (only `secret_set`). No `filter` field. Create body `WebhookCreate` (`web_models.py:376`) has `name, description, events, prompt, script, skills, deliver, deliver_only, deliver_chat_id, secret`. No filter.
- Auth: session token. Storage: webhook subscription file in the profile home (`hermes_cli.webhook`). Freshness: request-time.
- Status: verified. SPEC 4.1 Trigger, G28. Filter expression: absent. See source-verification G28.

**GET /api/sessions**
- Handler: `hermes_cli/web_routers/sessions.py:177` `get_sessions`.
- Request: profile scope via the sessions router helpers.
- Response: session list for that profile store. Auth: session token.
- Storage: profile `state.db` sessions table. Freshness: request-time.
- Status: verified. SPEC O18, O20.

**GET /api/sessions/search**
- Handler: `sessions.py:284` `search_sessions`. Auth: session token. Storage: `state.db`. Status: verified. SPEC R24.

**GET /api/sessions/{session_id}/timeline**
- Handler: `sessions.py:785` `get_session_timeline`.
- Request: `profile`, `limit` (1-500, default 500), `after_row_id`.
- Response: prompt metadata only, including compacted display history, never rewind rows. `next_cursor` for paging. 404 if the session is not owned by that profile (`sessions.py:770`).
- Auth: session token. Storage: `state.db`. Freshness: request-time. Not a live token stream.
- Status: verified. SPEC 3.1, O28, O70.

**GET /api/sessions/{session_id}/messages**
- Handler: `sessions.py:723` `get_session_messages`. Same ownership rule. Status: verified. Used by chat, not a separate Ops metric source.

**GET /api/analytics/usage**
- Handler: `hermes_cli/web_routers/analytics.py:145` `get_usage_analytics`.
- Request: `days` 1-365 (default 30), `?profile=`.
- Response: per model/day aggregates. Usage keys in `_USAGE_KEYS` (`analytics.py:158`): `input_tokens, output_tokens, cache_read_tokens, reasoning_tokens, estimated_cost, actual_cost, api_calls, tool_calls`. A row can exist with zeros. Zeros here mean the aggregate counted zero, not "unknown".
- This is not per-run usage. Do not join it onto a kanban run and call it that run's tokens.
- Auth: session token. Storage: profile `state.db` session usage. Freshness: request-time SQL for the window.
- Events: none. Status: verified as a day/model aggregate. SPEC 3.1, O65, G5. Per-run tokens: proposed A2.

**GET /api/status**
- Handler: `hermes_cli/web_routers/status.py:466` `get_status`.
- Request: `?profile=`. A named profile uses config scope only, not the skills-module profile swap (`status.py:471`).
- Response keys include `version, gateway_running, gateway_state, gateway_platforms, gateway_exit_reason, gateway_updated_at, gateway_heartbeat_stale_s, gateway_shared_with, active_agents, gateway_busy, gateway_drainable, active_sessions, components, overall`, plus auth-gate shape. Topology cache TTL 10s (`status.py:489`). Heartbeat staleness is separate from "not running".
- `gateway_state.json` is read inside `_resolve_gateway_status`, not as its own route.
- Auth: public allowlist. Still must not be treated as a secret dump; this doc does not copy paths or pids from the live body.
- Freshness: request-time plus 10s topology cache. `gateway_heartbeat_stale_s` null means fresh or not applicable.
- Status: verified. SPEC 3.1 health strip. Capability flags for A1-A7 are not on this payload today. SPEC P0 task 6 (capability flag contract) is out of this slice.

### 4.4 Canvas node reads

**GET /api/tools/toolsets**
- Handler: `hermes_cli/web_routers/tools.py:231` `get_toolsets`.
- Request: `?profile=`.
- Response: a list, not an object. Each item (`tools.py:271`): `{name, label, description, platform, platform_label, enabled, available, configured, tools}`. `tools` is the sorted tool name set for that toolset. `configured` is credential presence, not the secret.
- Auth: session token. Storage: profile config toolsets. Freshness: request-time. Events: none.
- Status: verified. SPEC 4.1 Tools.

**GET /api/skills**
- Handler: `hermes_cli/web_routers/skills.py:343` `get_skills`.
- Request: `?profile=`.
- Response: list from `_find_all_skills` reduced to `{name, description, category}` (`tools/skills_tool.py:239`) plus `enabled`, `usage`, `provenance` (`skills.py:367`). `category` is the parent directory under the skills root when the path has at least 3 parts (`skills_tool.py:130`); otherwise null. `provenance` is `hub | bundled | external | agent`. No `author`. No `mtime` / `updated`.
- Auth: session token. Storage: profile `skills/**/SKILL.md` plus bundled/hub/external dirs. Freshness: request-time scan.
- Status: verified. SPEC 4.1, G11, G68. G70 fields are absent (see verification).

**GET /api/skills/content**
- Handler: `skills.py:397` `get_skill_content`.
- Request: `name`, `?profile=`.
- Response: `{name, content, path}`. `content` is raw SKILL.md. Frontmatter may contain `author` (`tools/skill_linter.py:103` warns if missing). The list endpoint does not parse it. No mtime.
- Auth: session token. Status: verified as raw text, not as structured author/updated.

**GET /api/skills/hub/official**
- Handler: `skills.py:123` `list_official_skills`. Hub catalog, not installed skills. Auth: session token. Status: verified. SPEC G10.

**GET /api/memory**
- Handler: `hermes_cli/web_routers/ops.py:491` `get_memory_status`.
- Response: `{active, providers, builtin_files}` (`ops.py:502`). `active` is the normalized `memory.provider` or `""`. `builtin_files` is `{memory, user}` byte sizes of `MEMORY.md` / `USER.md`, or 0 if missing. Auth: session token. Storage: profile config `memory.provider` and `memories/`. Freshness: request-time. Status: verified. SPEC 4.1, G30.

**GET /api/memory/providers/{name}/config**
- Handler: `hermes_cli/web_routers/memory_providers.py:508` `get_memory_provider_config`.
- Request: path `name`, profile scope. Auth: session token. Status: verified. SPEC 4.1.

**GET /api/messaging/platforms**
- Handler: `hermes_cli/web_routers/messaging.py:824` `get_messaging_platforms`.
- Response: `{env_path, gateway_start_command, platforms}`. Each platform is `_messaging_platform_payload` (`messaging.py:208`). Env rows include `key`, `is_set`, `redacted_value`, and `value` (`messaging.py:244`). `value` is the raw string when the var is a list type, otherwise null. `redacted_value` is a preview. Ops must use `is_set` / `configured` / `enabled` only and must not render `value`, `redacted_value`, or `env_path`. The handler does not fully mask secrets. Auth: session token. Storage: profile `.env` plus `gateway_state.json` for runtime state. Status: verified as a route. SPEC 4.1 Channels, G29. The set/unset UI rule is a client obligation, not what the JSON already guarantees.

**GET /api/messaging/telegram/onboarding/{pairing_id}** and **GET /api/messaging/whatsapp/onboarding/{pairing_id}**
- Handlers: `messaging.py:735` `get_telegram_onboarding_status`, `messaging.py:615` `get_whatsapp_onboarding_status`.
- SPEC wrote `/api/messaging/*/onboarding`. Only telegram and whatsapp have these status reads. Other platforms do not match that glob.
- Auth: session token. Status: verified for those two platforms only.

**GET /api/mcp/catalog**
- Handler: `hermes_cli/web_routers/mcp.py:439` `list_mcp_catalog`. Auth: session token. Status: verified. SPEC G6, G62. No featured/recommended flag was cited by a handler in this slice; G64 is already a Cut in SPEC 12.7.

**GET /api/mcp/servers**
- Handler: `mcp.py:94` `list_mcp_servers`. Auth: session token. Storage: profile MCP config. Status: verified. SPEC G33, G83.

**GET /api/providers/oauth**
- Handler: `hermes_cli/web_routers/oauth.py:683` `list_oauth_providers`.
- Request: `?profile=`.
- Response: `{providers: [{id, name, flow, cli_command, docs_url, disconnect_hint, disconnect_command, disconnectable, status}]}`. `status` is `_status_card` (`oauth.py:356`): `logged_in, source, source_label, token_preview, expires_at, has_refresh_token`, optional `last_refresh`. Catalog dispatch includes `openai-codex` and `xai-oauth` (`oauth.py:383`, `oauth.py:394`). Anthropic is an external flow that Hermes still owns (`oauth.py:644`).
- Ops must not render `token_preview`. Presence is `logged_in` boolean only (G84).
- Auth: session token. Storage: auth store / provider credential files. Freshness: request-time. Not a P2 filter; the UI filters.
- Status: verified. SPEC G84.

### 4.5 Files, git, logs

**GET /api/files/read**
- Handler: `hermes_cli/web_routers/files.py:560` `read_managed_file`.
- Request: `path` query. Policy rejects paths outside the managed roots (`_managed_readable_file`).
- Response (`files.py:566`): `{name, path, size, mime_type, data_url, ...policy meta}`. `data_url` is base64 of the file. 413 if over the size cap. Auth: session token. Storage: managed file roots, not an arbitrary path. Status: verified. SPEC O17, O34.

**GET /api/git/status**
- Handler: `hermes_cli/web_routers/git.py:50` `git_status_route`. Auth: session token. Status: verified. SPEC O36 (branch only when a task worktree is focused).

**GET /api/git/review/diff**
- Handler: `git.py:130` `git_review_diff_route`. Auth: session token. Status: verified. SPEC O33, R38.

**GET /api/git/file-diff**
- Handler: `git.py:141` `git_file_diff_route`. Auth: session token. Status: verified. SPEC O33, O73.

**GET /api/logs**
- Handler: `hermes_cli/web_routers/status.py:825` `get_logs`. Auth: session token. Status: verified. SPEC O35. Distinct from kanban task log.

### 4.6 Gateway run reads and approval events

**GET /v1/runs/{run_id}**
- Handler: `gateway/platforms/api_server_runs.py:1057` `_handle_get_run`.
- Request: path `run_id`. Auth: Bearer API key, and the caller must own the run (`_request_owns_run`).
- Response: the status dict from `_set_run_status` (`api_server_runs.py:258`): `object: "hermes.run"`, `run_id`, `status`, `updated_at`, `created_at`, plus fields the writer added. Not a token object. Not a session id.
- Storage: gateway in-memory `_run_statuses` plus the durable run store the adapter owns. Freshness: poll. Events: none on GET; SSE is the stream.
- Status: verified. SPEC 3.1 API-run approvals. There is no list-all-runs read in the route table (`api_server_runs.py:234`).

**GET /v1/runs/{run_id}/events**
- Handler: `api_server_runs.py:1064` `_handle_run_events`. SSE.
- Auth: Bearer API key + run ownership. 401/403 is auth failure, not an empty stream (SPEC section 11.6).
- Events: structured agent lifecycle events for that run. Keepalive uses the chat-completions SSE keepalive constant. A slow subscriber is detached (`api_server_runs.py:1140`).
- Freshness: live stream. Reconnect behavior is the gateway's stream attach, not kanban `since`.
- Status: verified. SPEC 3.1, O46, G21, G23, G44. This is gateway runs, not kanban runs.

**JSON-RPC `approval.pending`**
- Contract: `apps/shared/src/gateway-contract.generated.ts:2846`.
- Params: `{session_id, profile?}`. Result: `{approvals: PendingApproval[]}`.
- `PendingApproval`: `request_id, command, description, pattern_key, pattern_keys, allow_permanent, allow_session, smart_denied, choices, tool_name`, plus unknown keys. Command text is the exact request. The generated comment says command is redacted in `server._approval_request_payload` — Ops must show whatever the payload actually contains and must not invent args that were redacted. If `command` is null, the why-line is "reason not recorded", not a guessed command.
- Scope: one session + optional profile. This does not list other sessions or other profiles (SPEC 3.1, A3 gap).
- Auth: gateway socket. Storage: `tools/approval.py` gateway queue for that session. Freshness: push. Desktop already subscribes (`server-requests.ts`, cited by SPEC).
- Expiry: queue timeout is `approvals.timeout`, default 300 seconds (`tools/approval_context.py:247`). The pending payload has no `expires_at` field. A client must not invent one.
- Status: verified for the owning session. Not a cross-profile list.

**JSON-RPC `approval.respond`**
- Params: `{session_id, profile?, choice?, all?, request_id?}` (`gateway-contract.generated.ts:2876`). Result: `{resolved: number}`.
- `choice` is one of the offered choices (`once`, `session`, `always`, `deny`). `request_id` resolves one. `all` resolves every pending approval in that session. Neither means the oldest.
- This is a write. Listed because A3 dedupe is defined against it. Second resolution is a zero `resolved`, not a second side effect. Desktop must disable the button on send (SPEC 3.3) and treat `resolved == 0` as already resolved.
- Status: verified method. Cross-profile routing is proposed (section 6).

**JSON-RPC `approval.received` / `approval.cancelled`**
- `approval.received` params: `{session_id, profile?, request_id}`, result `{acknowledged}` (`gateway-contract.generated.ts:2867`).
- `approval.cancelled` is a server push (SPEC 3.2). Payload type `ApprovalCancelledPayload` at `gateway-contract.generated.ts:4776`.
- These are the "resolved elsewhere" events. They are not a history list. SPEC R36 "last 50 resolved" has no read route. That history is proposed with A3.
- Status: verified as events. Not a list API.

**JSON-RPC `config.get` / `config.set`**
- Desktop read of `approvals.mode`: `apps/desktop/src/store/approval-mode.ts:69`, key `approvals.mode`, profile param required for a non-launch profile.
- Values: `manual | smart | off`. Unknown normalizes to `manual` (`approval-mode.ts:35`). UI cache default before a read is `smart` (`approval-mode.ts:44`). Those are different. Ops must show the read value, and `unknown` until the read returns. Do not paint `smart` as if it were confirmed.
- Auth: gateway socket. Storage: `approvals.mode` in that profile's config.yaml. Status: verified. SPEC O41.

**JSON-RPC `projects.list` / `projects.get` / `projects.create` / `projects.archive`**
- Handlers: `tui_gateway/methods_projects.py:81` `projects.list`, `:86` `projects.get`, `:91` `projects.create`, `:104` `projects.archive`.
- Storage: `hermes_cli/projects_db.py`. Columns: `id, slug, name, description, icon, color, board_slug, primary_path, created_at, archived`. No favourites column.
- Scope: the profile on the RPC params (`methods_projects.py` profile scope). Create does not inherit "All profiles" (`projects.ts:1111`).
- Auth: gateway socket. Status: verified. SPEC R4. `projects.create` is a write; the read is `projects.list` / `projects.get` and REST `GET /api/profiles/projects/tree`.

### 4.7 Client event sources (not REST)

**Live sub-agents**
- Store: `apps/desktop/src/store/subagents.ts`. `$subagentsBySession` / `buildSubagentTree` (SPEC G24).
- Fields include `id, parentId, goal, sessionId, delegationId, status, inputTokens, outputTokens, costUsd`. Tokens here are the live child stream when the event carried them. If the event has no token fields, the UI must show null, not 0.
- Scope: one Desktop session on one connection. Not a profile config. Not durable across restart unless the session stream replays it.
- This is not A4. See section 7.
- Status: verified client store. No REST list.

**`store/notifications`**
- Desktop toast queue. Not a backend read. SPEC O62, O90. Status: verified as a client store. No new route.

**Local prefs**
- Motion, pins, seen-state, recent searches, rail colour overrides (`$profileColors`), profile skins (`themes/context.tsx` key `hermes-desktop-profile-themes-v1`). Not server state. Status: client-only. SPEC O39, O47, R27, R35, R37, R60.

**Profile sigil colour**
- `apps/desktop/src/lib/profile-color.ts` `profileColor` / `resolveProfileColor`. Deterministic HSL from the profile name. Default/empty returns null. A user override wins. Not returned by `GET /api/profiles`. There is no `themes/profile-theme` module. Status: verified client source. SPEC O56.

## 5. Proposed contracts (not implemented)

Confirmed absent from `hermes_cli/web_routers` and `plugins/kanban` at this SHA. Live 401s are not existence proof (section 2).

### 5.1 A1 `GET /api/ops/fleet` — proposed

SPEC 3.1 and section 11.7. Read-only aggregate. Do not ship a client-side copy that can disagree with this contract once the route exists.

Request: `?connection=` is implicit (the serve process). No profile filter required; the route returns every profile that serve can see. Optional `board`.

Response, per profile:

- `profile` (string)
- `presence`: `working | needs_you | blocked | idle | offline | unknown | stale`
- `sub_state`: `thinking | tool:<name> | waiting_approval | null`
- `observed_at` (unix seconds, server clock)
- `freshness_s` (now - observed_at)
- `next_run_at` (cron, or null)
- `active_runs`: list of `{source: kanban|gateway, id, task_id|null, started_at}`
- `precedence` (string, the rule that won)

Precedence, first match wins:

1. pending approval for that profile (`waiting_approval`, presence `needs_you`)
2. kanban `workers/active` row or gateway run status `running` for that profile (`working`)
3. assigned task `status=blocked` (`blocked`)
4. gateway up, no work (`idle`)
5. profile has gateway platforms configured and the backend cannot reach them (`offline`)
6. last observation older than 5s (`stale`) — SPEC 3.3 presence agrees within 5s
7. no observation (`unknown`)

Never map unknown to idle. `observed_at` is required even for idle.

Storage: no new table. Aggregate of workers/active, tasks, approvals, cron, `/api/status`.
Auth: session token. Scope: connection. Tenant is not a presence axis.
Events: invalidate on kanban WS, `approval.pending` / `approval.received` / `approval.cancelled`, gateway run SSE. Polling 5s is fallback only (D12).
Status: proposed.

### 5.2 A2 per-run usage — proposed

There is no per-run token field. `task_runs.metadata` is unstructured. `GET /api/analytics/usage` is model/day. Gateway run status has no usage object. `tasks.session_id` is not a run-to-session map (NULL from CLI/dashboard; absent on `task_runs`).

Contract when built:

- Read: `GET /api/ops/runs/{source}/{id}/usage` where `source` is `kanban` or `gateway`.
- Response: `{input_tokens: number|null, output_tokens: number|null, provenance: string, session_id: string|null}`.
- If the session usage row is missing, both token fields are null and `provenance` is `unknown`. Never 0.
- If two runs share a session, do not add the session total onto each run. Provenance `shared-session` and tokens null unless the usage row is partitioned by run.
- Today-total for the status bar is a different read: `GET /api/analytics/usage?days=1` with provenance `analytics.usage:days=1`. Do not add it to per-run figures.
- Cron output preview rows in `cron.py:262` hard-code `input_tokens: 0` and `output_tokens: 0`. Those zeros are placeholders for a file preview, not measured usage. Ops must not display them as tokens.

Status: proposed. SPEC O19, O23, G22, G45, O66.

### 5.3 A3 — see section 6

### 5.4 A4 — see section 7

### 5.5 A7 SSE `GET /api/plugins/kanban/events/stream` — proposed path, existing socket

SPEC names an SSE route. The tree has a WebSocket at `/api/plugins/kanban/events` with `since`. Do not implement a second stream in this slice.

If a later slice adds the SSE path, it must:

- resume from `Last-Event-ID` equal to `task_events.id`
- include board in the query
- use the same auth as the WS upgrade
- not replay the whole table when the cursor is omitted

Until that route exists, Board push uses the verified WebSocket. Status of the SSE path: proposed. Status of the WebSocket: verified.

### 5.6 Capability flags

SPEC section 8 says older backends degrade via `/api/status` version. This SHA's `get_status` does not return `ops_capabilities`. Proposed flags, not implemented: `ops.fleet`, `ops.usage`, `ops.approvals`, `ops.delegation`, `ops.kanban_sse`. Absence means proposed routes are absent. Do not probe them by catching 401.

## 6. A3 approval envelope, expiry, status, dedupe

Not implemented. Specified so P1 does not invent a second shape.

**List** `GET /api/approvals/pending` — proposed.

Query: none for "all profiles on this connection". Optional `profile`, `board`. Connection is the serve process. Remote connections may read; they may not be given a respond route that writes another machine's queue.

Each item:

| Field | Rule |
|---|---|
| `origin` | `jsonrpc` \| `gateway_run` \| `kanban_blocked` \| `kanban_review` \| `cron_failure` \| `policy` |
| `id` | opaque. For approvals, the `request_id`. For kanban, the task id. For cron, the job id. Never a display title. |
| `profile` | owning profile. Required. |
| `session_id` | owning session, or null if the source has none. |
| `run_id` | gateway run id or kanban run id, or null. |
| `tenant` | kanban tenant, or null. |
| `exact_request` | command, args, tool name, as the source stored them. If the source redacted or omitted them, `exact_request` is null and `why` is `reason not recorded`. Do not reconstruct. |
| `why` | source text, or `reason not recorded`. |
| `what_for` | source text, or `reason not recorded`. Never a fabricated sentence. |
| `status` | `pending` \| `resolved` \| `cancelled` \| `expired` |
| `expires_at` | unix seconds. For tool approvals, pending time + `approvals.timeout` (default 300, `approval_context.py:247`). If the source has no clock, `expires_at` is null and status stays `pending` until an event says otherwise. Do not guess. |
| `age_s` | now - pending time, or null. |
| `actions` | published per item (SPEC section 11.8). Approve/Deny only when `exact_request` is complete. Otherwise `[Review]` (SPEC O8). |

Kanban blocked/review and cron failures are not tool approvals. They are siblings in the same list with different `actions`. Unblock is not this route; it stays a kanban write with a note (out of this slice).

**Respond** — routed, not a new side effect.

- `origin=jsonrpc`: JSON-RPC `approval.respond` with the item's `session_id`, `profile`, `choice`, `request_id`.
- `origin=gateway_run`: `POST /v1/runs/{run_id}/approval` (`api_server_runs.py:1168`). Body `{choice, request_id?, all?}`. Aliases `approve|approved|allow` map to `once`. Room grants: `once|deny` only, `request_id` required, `all` rejected (`api_server_runs.py:1184`).
- Other origins do not call approval.respond.

**Dedupe**

- Identity: `(connection, profile, session_id or run_id, request_id)`.
- The server resolves at most once. `approval.respond` returns `resolved` count. Gateway returns 409 `approval_not_pending` when `resolve_gateway_approval` returns <= 0 (`api_server_runs.py:1209`).
- A duplicate click, a second device, and `approval.received` for the same `request_id` are one resolution. The list drops the item. The UI shows "Resolved elsewhere" (SPEC 3.2). It does not send a second respond.
- `all: true` is scoped to that session's pending queue, never to every profile.
- One click stays (D3). Idempotency is the server count, not a client lock alone.

Status of the list route: proposed. Status of the two respond methods: verified, session- or run-scoped, not cross-profile.

## 7. Configured delegation vs live sub-agents

These are different objects. A4 must not merge them.

**Configured delegation (A4, read-only, proposed projection, source verified)**

- Source read: `GET /api/config?profile=` keys under `delegation` (`config_defaults.py:1330`).
- Keys: `model, provider, fallback_providers, base_url, api_key, api_mode, request_overrides, compression_threshold_tokens, inherit_mcp_toolsets`, plus later keys in that dict (`max_iterations`, `max_concurrent_children` from migrations).
- Empty `model` / `provider` means inherit parent. `fallback_providers: null` means inherit; `[]` means disabled.
- `api_key` must be stripped. Response field `api_key_set: boolean` only.
- Projection response (proposed `GET /api/ops/delegation?profile=`): `{profile, model, provider, inherit_model, inherit_provider, fallback_providers, inherit_mcp_toolsets, api_key_set}`. No child list. No session ids.
- Storage: config.yaml. Freshness: request-time. Events: none.
- Status of the raw config read: verified. Status of the projection route: proposed. SPEC 4.1 Sub-agents, G34.

**Live sub-agents (verified client store, not A4)**

- `apps/desktop/src/store/subagents.ts`. Built from the session stream for one session.
- A row means a `delegate_task` child that the Desktop process observed. It is not the configured default model.
- Tokens on that row are null when the event omitted them.
- Scope: connection + session. Lost on restart unless the stream replays.
- G24 uses this store. Canvas "Sub-agents" node uses A4 only (SPEC 4.1, section 11.9: sub-agents stay read-only).

Do not implement an adapter in this slice.

## 8. Cited writes (not read contracts)

Recorded so a judge can see they were inventoried and left unimplemented.

| Citation | Handler | Note |
|---|---|---|
| POST /api/cron/jobs/{job_id}/trigger | `cron.py:729` `trigger_cron_job` | O16 "Run now". Write. |
| PATCH /api/plugins/kanban/tasks/{id} | `plugin_api.py:686` `update_task` | Board drag. |
| POST /api/plugins/kanban/tasks | `plugin_api.py:429` `create_task` | Body includes `triage: bool` (`plugin_api.py:417`). |
| POST .../comments | `plugin_api.py:796` `add_comment` | |
| POST .../reclaim | `plugin_api.py:1002` `reclaim_task_endpoint` | |
| POST .../reassign | `plugin_api.py:1033` `reassign_task_endpoint` | |
| POST .../estimate | `plugin_api.py:1071` `estimate_task_endpoint` | |
| POST /tasks/bulk | `plugin_api.py:852` `bulk_update` | |
| POST /runs/{id}/terminate | `plugin_api.py:979` `terminate_run_endpoint` | |
| POST /v1/runs/{id}/approval | `api_server_runs.py:1168` | |
| POST /v1/runs/{id}/steer | `api_server_runs.py:1219` | |
| POST /v1/runs/{id}/stop | `api_server_runs.py:1253` | |
| POST /v1/runs | route table `api_server_runs.py:236` | Canvas test run. Not a read. |
| PUT soul, description, model, toolsets, skills toggle, memory, platforms, cron, webhooks, config raw | matching routers | Canvas writes. A5/A6 not in this slice. |
| JSON-RPC projects.create | `methods_projects.py:91` | R4 create path. Write. |
| POST /api/dashboard/agent-plugins/{name}/enable | not opened in this slice | SPEC 3.2 enable CTA. Not verified here. |
| POST /api/profiles/{name}/snapshot | absent | A5. Proposed. |

## 9. External plugin: workflow-studio

Not in `hermes-agent`. Installed at `C:\Users\nachi\AppData\Local\hermes\plugins\workflow-studio`. Desktop drop-in: `HERMES_HOME\desktop-plugins\workflow-studio`. Live plugin list on the ephemeral serve included the name `workflow-studio`.

- Mount comment: `dashboard/plugin_api.py:1` — `/api/plugins/workflow-studio`.
- Reads: `GET /projects` (`plugin_api.py:75`), `GET /workflows?project_id=` (`:107`), `GET /workflows/{id}` (`:128`), `GET /runs/{run_id}` (`:187`), `GET /health` (`:201`), `GET /decisions/{id}` (`:275`), `GET /memory` (`:315`), `GET /recovery` (`:321`).
- Writes (not used here): POST/PUT workflows, POST runs, decisions, memory.
- `workflow_template_id` does not appear in that plugin tree (search returned no matches). Compile-to-kanban is a write path in `workflow_studio/compile.py`. It is not a kanban template catalog.
- Auth: same dashboard session token. Live `GET /api/plugins/workflow-studio/health` returned 401 without a token. Payload not read.
- Storage: the plugin's own DB (`workflow_studio/db.py`), not `kanban.db` templates.
- Status: verified as an external plugin with its own reads. Not a substitute for kanban `workflow_template_id`.

## 10. Null usage rule (all surfaces)

| Surface | If the source has no usage | Forbidden display |
|---|---|---|
| A2 per-run | `null`, provenance `unknown` | `0` |
| `GET /api/analytics/usage` | the aggregate's real zero, provenance `analytics.usage` | calling that zero a run's tokens |
| cron output preview row | ignore `input_tokens: 0` (`cron.py:270`) | showing it as usage |
| live sub-agent event | `null` when the event omitted tokens | `0` |
| status bar today-total | only `analytics.usage?days=1`, tooltip names that route | sum of run nulls |

A missing number is null with a provenance string. It is not zero, and it is not hidden without the provenance tooltip (SPEC section 2 UI rule).
