# Ops panel read contracts (P0-01)

Status: documentation only. Round 2 corrected the r1 false negatives on gateway `session_id`/`usage`, the ACK-vs-settlement mix-up, the missing O24/G5/R2/`/links` inventory, and the A1 freshness gate. Round 3 completes usable axes (including onboarding schemas, `?board=` on runs/inspect, cron blueprint profile scope, and `config.get` Params/Result) and makes the A1 mixed-input gate a single policy with `observed_at` separate from `event_at`/`updated_at`. Those round-2 repairs stay. Round 4 states the A2 and A7 axes that round 3 left unlabeled. Unknown parts of those axes are `incomplete`, not guessed. Round 4 also locks old gateway-up with no work, and old authoritative-empty, to `unknown` in both the A1 gate and the tables. No adapters, no runtime config, no mutation probes.
Repo: `hermes-agent` at `865ba906c1a` (`feat/ops-panel` base; `ops/P0-01` is docs on that tree).
SPEC: vault `01-Projects/Hermes/desktop-ops-panel/SPEC.md` v4, sections 3-5 and 12.8.
Model policy P2 is a write-time rule (SPEC section 4.4). This file does not install `ops-policy.yaml` and does not change any profile.

Live reads below are public probes only. A missing session token returns 401 for both real gated routes and unknown paths, so 401 is not proof a route exists.

## 1. How to read an entry

Section 11 indexes the routes and event sources cited in SPEC sections 3-5 and 12.8. A 230/230 match on section 12.8 ids is a name classification, not a schema audit and not live-payload exhaustivity. This file does not claim every SPEC sentence was re-read against a live body.

Each entry below carries these axes as labeled lines, or an explicit `inherited exact §X` / `none` / `not exposed` / `proposed` for an axis it does not restate:

- Handler: path and symbol
- Request: and Response: fields the handler accepts or returns. Nothing invented. A delegated producer is named, not replaced with a guess.
- Scope: connection / profile / tenant / board, only where that handler has the query
- Auth: authentication boundary
- Storage: authoritative store
- Freshness: including which clock, when a clock exists
- Events: what the read emits, or `none`
- Status: `verified` (handler exists at this SHA), `proposed` (named in SPEC, not implemented), or `incomplete` (an axis that could not be read from source)

Axes marked `incomplete` are only the parts source and exact inheritance do not decide: A2 cache TTL, the authoritative per-run store for a kanban id (the O66 join is absent), which board an unqualified kanban id belongs to on the proposed A2 path, A7 SSE freshness, and an A7 tenant filter. Those parts are not verified. Every other labeled axis is stated or inherited exactly. Unread gated JSON stays a blocker, not an `incomplete` axis. Writes cited in those sections are listed in section 8 so they are not mistaken for reads. They are not implemented here.

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
- Handler: no dedicated GET-by-name document. The list item from `list_profiles_endpoint` is the summary. Desktop-overlay read, separate route: `profiles.py:1142` `get_profile_desktop_overlay`.
- Request: path `name` on the overlay route. The summary has no per-name GET.
- Response: the list-item shape in §4.1 `GET /api/profiles`. Description's read side is that `description` field. `PUT /api/profiles/{name}/description` (`profiles.py:1035`) is a write.
- Scope: one profile for the overlay. The list is machine-wide.
- Auth: session token. Inherited from the list route.
- Storage: profile dir, same as the list.
- Freshness: request-time. Events: none.
- Status: verified as the list field, not as a dedicated GET-by-name document. SPEC 4.1 Description.

**GET /api/config/defaults**
- Handler: `config_env.py:94` `get_defaults`.
- Request: none.
- Response: `DEFAULT_CONFIG`, including `delegation` (`config_defaults.py:1330`).
- Scope: process defaults. Not a profile, not a tenant.
- Auth: public allowlist.
- Storage: code constant, not a user file.
- Freshness: process lifetime. Events: none.
- Status: verified. Not a per-profile read.

**GET /api/model/info**
- Handler: `models.py:90` `get_model_info`.
- Request: none.
- Response observed live, no secrets: `{model, provider, auto_context_length, config_context_length, effective_context_length, capabilities}`.
- Scope: the serve process profile. Not the fleet. Not `?profile=`.
- Auth: public allowlist.
- Storage: the process profile's model config. Not every profile.
- Freshness: request-time. Events: none.
- Status: verified, but it is not a per-profile fleet read.

**GET /api/profiles/{name}/soul**
- Handler: `profiles.py:998` `get_profile_soul`.
- Request: path `name`.
- Response: `{"content": "<SOUL.md text>", "exists": true}` or `{"content": "", "exists": false}` if the file is missing (`profiles.py:1008`). Authoritative file is `profiles/<name>/SOUL.md` (root `SOUL.md` for default).
- Storage: `profiles/<name>/SOUL.md` (root `SOUL.md` for default).
- Scope: one profile. Auth: session token.
- Freshness: request-time file read.
- Events: none until A5 exists. A later write must re-read.
- Status: verified. SPEC 4.1 Prompt node.

**GET /api/profiles/projects/tree**
- Handler: `hermes_cli/web_routers/profiles.py:717` `get_profiles_projects_tree` on `sessions_router`. Wrapped by `@_sidebar_singleflight_cache` (`profiles.py:718`).
- Request: `preview_limit` default 3, `session_limit` default 2000 (`profiles.py:719`). No `?profile=`.
- Response (`profiles.py:746-747`): `{projects, active_id: null, scoped_session_ids, errors}`. `active_id` is always null (no single active project across homes). Each merged project is the sidebar builder's shape, not a raw `projects.db` row. The walk reads that profile's `state.db` and scopes `projects.db` through the home override (`profiles.py:722-739`). Discovery is off (`include_discovered=False`), so this GET does not write.
- Scope: every profile home `_profile_targets` enumerates. Not a tenant filter.
- Auth: session token.
- Storage: per-profile `state.db` and `projects.db`. The singleflight cache is process-local, not a published TTL.
- Freshness: request-time, coalesced by the decorator. Not a server TTL.
- Events: Desktop listens for `projects.changed`. JSON-RPC `projects.list` is the one-profile sidebar read; this REST tree is the SPEC O12 citation.
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

**O24 `command_allowlist` (config key, not a route)**
- Handler: no dedicated route. The list is a top-level key on `GET /api/config` (`config_env.py:80` `get_config` returns keys that do not start with `_`). Default `[]` (`config_defaults.py:1703`). Permanent allow matches are applied in `hermes_cli/approvals_test.py` (pattern match against this list); that module is not an Ops read.
- Request: inherited from `GET /api/config` (`?profile=`, `include_defaults`).
- Response: `command_allowlist: string[]` of command patterns when the key is in the loaded document. Not a toolset. Not a secret. Sibling O24 citations: profile summary is `GET /api/profiles` (no per-name document, section 4.1); toolsets are `GET /api/tools/toolsets`. `task_runs` count over 7 days is not exposed: no handler aggregates runs by profile and window. `workers/active` is currently-running only. Do not count board cards and call that a 7-day total.
- Scope: one profile. Omitted profile = launch profile. Not tenant-scoped.
- Auth: session token (same gate as `GET /api/config`).
- Storage: `profiles/<name>/config.yaml` key `command_allowlist`.
- Freshness: request-time `load_config()`.
- Events: none.
- Status: verified as a config field. The 7-day run count is `not exposed`, not verified, and not a Cut of the rest of O24.

**GET /api/config/raw**
- Handler: `hermes_cli/web_routers/analytics.py:34` `get_config_raw` (mounted with the analytics router, path is still `/api/config/raw`).
- Request: `?profile=`.
- Response: raw YAML text of that profile's config. Secret-bearing. Advanced drawer only. Never diff secrets in the UI (SPEC 4.2).
- Scope: one profile. Omitted profile = launch profile. Not a tenant.
- Auth: session token. Storage: same config.yaml. Freshness: request-time.
- Events: none.
- Status: verified. SPEC 4.1.

**GET /api/config/schema**
- Handler: `config_env.py:99` `get_schema`.
- Request: `?profile=` optional.
- Response: `{fields, category_order}`. `approvals.mode` is a select of `manual`, `smart`, `off` (`web_server_config.py:143`).
- Scope: schema code, not a user file. `?profile=` only changes dynamic provider options. Not a tenant.
- Auth: public allowlist. Storage: schema code, not user files. Freshness: request-time (dynamic provider options).
- Events: none.
- Status: verified. SPEC 4.3.

**GET /api/model/options**
- Handler: `hermes_cli/web_routers/models.py:138` `get_model_options`.
- Request: `?profile=`.
- Response: provider/model options for that profile's credentials and catalog. P2 filtering is not in this handler. The picker must filter client-side until A6 exists, and must not treat this list as the allowlist.
- Scope: one profile. Omitted profile = launch profile. Not a tenant.
- Auth: session token. Storage: catalog + profile config + env presence. Freshness: request-time.
- Events: none.
- Status: verified. SPEC 4.1, O50, G2.

**GET /api/env**
- Handler: `config_env.py:259` `get_env_vars`.
- Request: `?profile=`.
- Response rows include `is_set` and `redacted_value` (`config_env.py:278`). SPEC O22/O42/O7 say names and set/unset only. Ops must use `is_set` and must not render `redacted_value`.
- Scope: one profile's `.env`. Omitted profile = launch profile. Not a tenant.
- Auth: session token. Storage: profile `.env`. Freshness: request-time.
- Events: none.
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
- Response: `{task, comments, events, attachments, links, link_tasks, child_results, runs}` (`plugin_api.py:393-403`). `events` are `task_events` rows. `runs` are `task_runs` rows via `asdict`. There is no separate GET `/comments`. There is no separate GET `/links`.
- `links` is `{parents: string[], children: string[]}` from `task_links` (`plugin_api.py:263-266` `_links_for`). `link_tasks` is `{id, title, status}[]` for those ids (`plugin_api.py:270-279`). Dropped ids are absent from `link_tasks`; the id remains in `links`.
- Task id format: `t_` + `secrets.token_hex(4)` (`kanban_db.py:1161`), 8 lowercase hex chars. Not `TASK-142`.
- `tasks.session_id` is the originating `HERMES_SESSION_ID`, NULL when created from CLI/dashboard (`kanban_db.py:808`). `task_runs` has no `session_id` column (`kanban_db.py:1080`).
- Scope: one board, one task. Tenant is a field on the task, not a query filter here.
- Auth: session token. Storage: `kanban.db`. Freshness: request-time.
- Events: none.
- Status: verified. SPEC 3.1 timeline, section 5 drawer.

**GET /api/plugins/kanban/runs/{run_id}**
- Handler: `plugin_api.py:931` `get_run_endpoint`.
- Request: path `run_id` (int). Query `board: Optional[str] = _BOARD_Q` (`plugin_api.py:931`). Omitted or empty `board` is not every board: `_resolve_board` returns None and `kb.connect()` uses the active board (`plugin_api.py:66-70`). Unknown slug is 404. This query is not implied on `GET /workflow` or `GET /orchestration`.
- Response: `{run: asdict(task_runs row)}`. Columns: `id, task_id, profile, step_key, status, claim_lock, claim_expires, worker_pid, worker_started_at, max_runtime_seconds, last_heartbeat_at, started_at, ended_at, outcome, summary, metadata, error`. `metadata` is JSON text, not a guaranteed usage object. No `session_id`.
- `step_key` is nullable and unused by the v1 kernel (`kanban_db.py:1077`).
- Scope: one board, one run. Profile is a column on the row, not `?profile=`.
- Auth: session token.
- Storage: `kanban.db` `task_runs` on that board.
- Freshness: request-time. Not a push.
- Events: none.
- Status: verified. SPEC 3.1. Tokens are not a column.

**GET /api/plugins/kanban/runs/{run_id}/inspect**
- Handler: `plugin_api.py:938` `inspect_run_endpoint`.
- Request: path `run_id` (int). Query `board: Optional[str] = _BOARD_Q` (`plugin_api.py:938`). Same omitted-board rule as `get_run_endpoint` (`_board_conn(board)`). Do not copy this query onto workflow or orchestration.
- Response: the handler returns one of three shapes, not a guessed superset. Ended, missing pid, missing psutil, or no such process: `{run_id, alive: false, reason}` plus `pid` when the dead helper was given one (`plugin_api.py:944-953`, `:969-970`). Access denied: `{run_id, alive: true, pid, error: "access denied"}` (`:971-972`), inline, not a 500. Alive: `{run_id, alive: true, pid, cpu_percent, memory_rss_bytes, memory_vms_bytes, num_threads, num_fds, status, create_time, cmdline}` (`:962-968`). `num_fds` is null on non-POSIX. Not tokens.
- Scope: one board, one run. The psutil read is that run's `worker_pid`, not every process on the machine.
- Auth: session token.
- Storage: the run row in `kanban.db` plus the OS process table. Not a token store.
- Freshness: request-time.
- Events: none.
- Status: verified. SPEC 3.1, O35.

**GET /api/plugins/kanban/config**
- Handler: `plugin_api.py:1144` `get_config` (route decorator `:1143`).
- Request: none. No `?board=` and no `?profile=`. Do not copy the runs query onto this route.
- Response (`plugin_api.py:1147`): `{default_tenant, lane_by_profile, include_archived_by_default, render_markdown}` from `dashboard.kanban` in config.yaml. Not `approvals.mode`. Lanes are not in this object.
- Scope: the serve process config. Not one board and not one tenant.
- Auth: session token.
- Storage: config.yaml `dashboard.kanban`.
- Freshness: request-time.
- Events: none.
- Status: verified. SPEC section 5 cites `/api/plugins/kanban/config` for lanes. This handler does not return lanes. Board columns come from `GET /workflow`, not from this config. Do not invent a lanes array here.

**GET /api/plugins/kanban/workflow**
- Handler: `plugin_api.py:1620` `get_workflow` (route decorator `:1619`).
- Request: none. No `?board=` and no `?profile=`. The handler does not take `_BOARD_Q`.
- Response: `kanban_workflow.DEFAULT_WORKFLOW.to_dict()`: `{columns: [{key, label, icon, drag_target}], manual, archived}`. Columns include `triage, todo, scheduled, ready, running, blocked, review, done`. `archived` is a filter, not a column (`kanban_workflow.py:27`).
- This is the status machine. It is not a library of workflow templates and it has no step counts.
- Scope: code constant, same for every board today (`plugin_api.py:1622-1624`). Not one board's template library.
- Auth: session token.
- Storage: code constant `DEFAULT_WORKFLOW`. Not `kanban.db` and not a template table.
- Freshness: process lifetime.
- Events: none.
- Status: verified. Do not cite this as R34/O16 templates.

**GET /api/plugins/kanban/projects**
- Handler: `plugin_api.py:1392` `list_kanban_projects`.
- Request: `board` query, inherited from the router. No `?profile=`.
- Response (`plugin_api.py:1399`): `{projects: [{id, slug, name, primary_path, icon, color}]}`. Non-archived only.
- Scope: the serve process home. Not a per-profile read. Not workflow-studio `/projects`.
- Auth: session token.
- Storage: `projects.db` for that home.
- Freshness: request-time.
- Events: none.
- Status: verified. SPEC R4's profile-scoped read is JSON-RPC `projects.list`, not this route.

**GET /api/plugins/kanban/tasks/{task_id}/log**
- Handler: `plugin_api.py:1249` `get_task_log`.
- Request: path `task_id`; query `tail` optional, integer 1..2,000,000 (`plugin_api.py:1250`); `board`.
- Response (`plugin_api.py:1258-1260`): `{task_id, path, exists, size_bytes, content, truncated}`. `content` is `""` when the log does not exist. `truncated` is true only when `tail` was set and `size_bytes > tail`. 404 if the task was never spawned is the handler docstring's rule; the code path returns `exists: false` after `_require_task` when the file is missing. Do not invent a second schema.
- Scope: one board, one task. Not profile-scoped via `?profile=`.
- Auth: session token.
- Storage: worker log file from `kanban_db.worker_log_path` (`HERMES_HOME/kanban/logs`). On-disk rotation is 2 MiB plus one `.log.1` (`plugin_api.py:1251`). Not `task_runs`.
- Freshness: request-time file read.
- Events: none. Not the kanban WS.
- Status: verified. SPEC O35. Distinct from `GET /api/logs`.

**GET /api/plugins/kanban/tasks/{task_id}/attachments**
- Handler: `plugin_api.py:458` `list_task_attachments`.
- Request: path `task_id`; query `board`.
- Response: `{attachments: [_attachment_dict...]}`. Each item (`plugin_api.py:191-195`): `{id, task_id, filename, content_type, size, uploaded_by, stored_path, created_at}`. The same list is embedded on `GET /tasks/{id}` as `attachments` without the wrapper key. `stored_path` is an absolute disk path. Ops must not render it as a navigable URL. Download is by `id`, not by echoing the path.
- Scope: one board, one task.
- Auth: session token.
- Storage: `task_attachments` plus files under `kanban/attachments`.
- Freshness: request-time.
- Events: none on this GET.
- Status: verified. SPEC O17, R11.

**Links — embedded in GET /tasks/{id}; no GET `/links`**
- Handler: none for GET. `_links_for` (`plugin_api.py:263`) and `_link_tasks` (`plugin_api.py:270`) run inside `get_task` (`plugin_api.py:389-399`). SPEC section 5 cites `/links` next to `/tasks/{id}`. That citation is this embedded object, not a list route.
- Request: inherited from `GET /api/plugins/kanban/tasks/{task_id}` (`board`, optional run-state filters do not change `links`).
- Response: inherited from that GET: `links` and `link_tasks`. There is no `{links: ...}` envelope on its own URL.
- Scope: one board, one task. A link whose other end is on another board is still an id in `task_links`; this slice does not claim cross-board titles.
- Auth: session token, same as `get_task`.
- Storage: `kanban.db` table `task_links`.
- Freshness: request-time, same read as the task.
- Events: none. A later link write is `POST /links` (`plugin_api.py:811`) or `DELETE /links` (`plugin_api.py:818`). Those are writes. They are not reads and they are not implemented here.
- Status: verified as an embedded field. A standalone `GET /links` is `not exposed`. Do not add one to fill SPEC section 5.

**GET /api/plugins/kanban/orchestration**
- Handler: `plugin_api.py:1627` `get_orchestration_settings`.
- Request: none. Not `?profile=` and not `?board=`.
- Response (`plugin_api.py:1646-1653`): `{orchestrator_profile, default_assignee, auto_decompose, auto_promote_children, resolved_orchestrator_profile, resolved_default_assignee, active_profile}`. Explicit strings may be `""`. Booleans default true when the key is missing. Resolved names fall back to the active profile when the explicit name is empty or unknown.
- Scope: the serve process config, not one board and not one tenant.
- Auth: session token.
- Storage: `config.yaml` key `kanban` (`orchestrator_profile`, `default_assignee`, `auto_decompose`, `auto_promote_children`).
- Freshness: request-time.
- Events: none.
- Status: verified. This is configured orchestration, not a live sub-agent tree. See section 7.

**R2 `kanban_notify_subs` (table, not an Office list route)**
- Handler: no list-all REST. Schema `hermes_cli/kanban_db.py:1127` `CREATE TABLE kanban_notify_subs`. Row reader `hermes_cli/kanban_db_notify.py:166` `list_notify_subs` (optional `task_id`, `notifier_profiles`, `include_unowned`). Gateway poller `gateway/kanban_watchers.py:61` reads the table to deliver terminal events. That poller is not an Ops endpoint.
- Request: not exposed as a dashboard list. The only REST that consults the table is `GET /api/plugins/kanban/home-channels` (`plugin_api.py:1190` `get_home_channels`): optional `task_id`, `board`. Without `task_id`, every `subscribed` is false.
- Response of that GET (`plugin_api.py:1201-1202`): `{home_channels: [{platform, chat_id, thread_id, name, subscribed}]}`. `subscribed` is a boolean against the table key `(platform, chat_id, thread_id)`. The route does not return `user_id`, `delivery_mode`, `delivery_metadata`, `last_event_id`, or `last_ping_event_id`. Those columns exist on the table (`kanban_db.py:1128-1141`) and are `not exposed` on this GET.
- Scope: one board connection for the subscribe check; the table itself is per kanban db. Not a profile query param.
- Auth: session token on `GET /home-channels`. The table has no HTTP auth of its own.
- Storage: `kanban.db` `kanban_notify_subs`. Primary key `(task_id, platform, chat_id, thread_id)`.
- Freshness: request-time for the home-channels boolean. The gateway poller is its own cadence, not this GET.
- Events: none on the GET. Notifier delivery is a gateway side effect, not an Ops event source.
- Status: table verified. Ops list of subscription rows is `not exposed`. R2's Needs-you half stays A3 (section 6). Do not paint an inbox from a table the renderer cannot list. Not a Cut of the table.

**WS /api/plugins/kanban/events**
- Handler: `plugin_api.py:1783` `stream_events`. Not SSE. Path is `/events`, not `/events/stream`.
- Request: query `since` (event id) and `board`. Missing `since` starts at the current tail and does not replay history (`plugin_api.py:1697`). `since=0` does replay. Board is pinned at handshake.
- Response frames: new `task_events` rows after the cursor. Poll interval 0.3s (`plugin_api.py:1694`).
- Scope: one board, pinned at handshake. Not every board. Not `?profile=`.
- Auth: WS upgrade token (`plugin_api.py:50`). Storage: `task_events`. Freshness: 300ms poll, not a push from the writer.
- Events: this is the event source. `GET /board` `latest_event_id` is the snapshot cursor.
- Status: verified existing push. SPEC A7's SSE path is still proposed (section 5). SPEC D12 can be met by this socket if the client uses `since`. Do not invent a second stream.

### 4.3 Cron, webhooks, sessions, analytics

**GET /api/cron/jobs**
- Handler: `hermes_cli/web_routers/cron.py:668` `list_cron_jobs`.
- Request: `profile` default `"all"`. `"all"` aggregates and dedupes by job id, preferring the default profile copy (`cron.py:114`).
- Response: list of job records from `cron/jobs.py`. Fields written at create (`jobs.py:1898`): `id, name, prompt, skills, skill, model, provider, base_url, script, no_agent, monitor_*, context_from, schedule, schedule_display, repeat, enabled, state, paused_at, paused_reason, created_at, next_run_at, last_run_at, last_status, last_error, last_delivery_error, last_delivery_unverified, last_failure, failure_streak, deliver, origin, enabled_toolsets, workdir`. Optional: `attach_to_session, reasoning_effort, failure_deliver, interpreter`.
- Ownership for Canvas Schedule is `origin` (D9), not the profile directory the file happened to be listed from. When `profile=all`, the same id can exist in two homes; the dedupe hides that. Ops Schedule must not use the aggregated list to decide ownership. Pass the focused profile, then filter `origin`.
- Scope: the `profile` query. Default `"all"` aggregates homes and is not the focused profile. Not a tenant. Not a board.
- Auth: session token. Storage: `profiles/<origin>/cron/jobs.json` (root `cron/jobs.json` for default). Executions: `cron/executions.db`.
- Freshness: request-time file read. Events: none. Cron failure is a poll of `failure_streak`.
- Status: verified. SPEC 3.1, 4.1, G27, R1, R9.

**GET /api/cron/blueprints**
- Handler: `hermes_cli/web_routers/cron.py:858` `list_cron_blueprints` → `_blueprint_catalog_sync` (`cron.py:830`).
- Request: `?profile=` optional (`profile: Optional[str] = None`). Omitted, `""`, or `"current"` is the process launch profile: `_config_profile_scope` treats those as no home override (`hermes_cli/web_server_profiles.py:277-300`). It is not `"all"` and not every profile. An unknown name raises that scope's 404 (`cron.py:836`).
- Response: `{blueprints: blueprint_catalog_entry[]}`. Each entry is `blueprint_catalog_entry` (`cron/blueprint_catalog.py:667-678`): the form schema plus `source`, `plugin`, `schedule`, `scheduleHuman`, `command`, `appUrl`. Form schema (`blueprint_form_schema`, `:589-609`): `key, title, description, category, tags, fields`. Each field is `{name, type, label, default, options, optional, strict, help}`. `source` is `"plugin"` when `blueprint.plugin` is set, else `"builtin"`. `plugin` is that name or null. When `cron_delivery_targets()` succeeds, the `deliver` field's `options` are rewritten to `["origin", "local", *that profile's platform ids]` (`cron.py:838-853`). If that call fails, the static slot options stay. Do not invent step counts. This is not a workflow-template object.
- Scope: `_config_profile_scope(profile)`. `list_blueprints` (`blueprint_catalog.py:556-562`) returns built-ins (`CATALOG`) then `plugin_blueprints()` of the profile that scope selected. Not a process-global catalog, not a tenant, not `jobs.json`.
- Auth: session token.
- Storage: the code catalog plus that profile's plugin blueprints. Not user jobs.
- Freshness: request-time. The catalog is resolved per call and must not be cached across profiles (`list_blueprints` docstring).
- Events: none.
- Status: verified. SPEC O4, G4, G61. Kanban workflow templates are not this route.

**GET /api/webhooks**
- Handler: `hermes_cli/web_routers/ops.py:154` `list_webhooks`.
- Request: `?profile=`.
- Response: `{enabled, base_url, subscriptions[]}`. Each subscription from `_webhook_route_summary` (`ops.py:140`): `events, deliver, deliver_only, prompt, script, skills, created_at, url, secret_set, enabled`. `secret` is not returned on list (only `secret_set`). No `filter` field. Create body `WebhookCreate` (`web_models.py:376`) has `name, description, events, prompt, script, skills, deliver, deliver_only, deliver_chat_id, secret`. No filter.
- Scope: one profile. Omitted profile = launch profile. Not a tenant.
- Auth: session token. Storage: webhook subscription file in the profile home (`hermes_cli.webhook`). Freshness: request-time.
- Events: none.
- Status: verified. SPEC 4.1 Trigger, G28. Filter expression: absent. See source-verification G28.

**GET /api/sessions**
- Handler: `hermes_cli/web_routers/sessions.py:177` `get_sessions`.
- Request: `limit` (0-100, default 20), `offset`, `min_messages`, `archived` (`exclude|only|include`), `order` (`created|recent`), `source`, `sources`, `exclude_sources`, `cwd_prefix`, `full`, `profile`.
- Response (`sessions.py:239`): `{sessions, total, limit, offset, storage}`. Each row gets `is_active`, `profile`, `is_default_profile`, `archived`, `pinned`. Unless `full=1`, `system_prompt` and `model_config` are omitted (`sessions.py:187`). `storage` is `{profile: "corrupt"}` or `{}`.
- Side effect: `_maybe_auto_archive_for_profile` runs before the read (`sessions.py:198`). This GET is not pure. Ops must not call it as a silent poll without accepting that archive write. This slice did not call it.
- Scope: one profile. Omitted profile = launch profile. Not a tenant.
- Auth: session token. Storage: profile `state.db`. Freshness: request-time. 503 on a busy store, not an empty list (`sessions.py:249`).
- Events: none.
- Status: verified. SPEC O18, O20.

**GET /api/sessions/search**
- Handler: `sessions.py:284` `search_sessions`.
- Request: `q`, `limit` (clamped 1-100), `profile`, `source`, `sources`, `exclude_sources`. Empty `q` returns `{results: []}`.
- Response: `{results: [...]}` (`sessions.py:458`). A result includes `session_id`, `lineage_root`, and when a session row exists: `id, source, model, title, started_at, ended_at, last_active, is_active, message_count, tool_call_count, input_tokens, output_tokens, preview, parent_session_id, profile` (`sessions.py:373`). Missing token fields are coerced with `or 0` (`sessions.py:385`). That zero is not measured usage. Ops must not display those fields as tokens. Provenance for a real total is `GET /api/analytics/usage`, not search.
- Auth: session token. Storage: `state.db` plus FTS. Freshness: request-time. Status: verified as a search. SPEC R24. Not a usage source.
- Scope: one profile. Omitted profile = launch profile. Not a tenant.
- Events: none.

**GET /api/sessions/{session_id}/timeline**
- Handler: `sessions.py:785` `get_session_timeline`.
- Request: `profile`, `limit` (1-500, default 500), `after_row_id`.
- Response: prompt metadata only, including compacted display history, never rewind rows. `next_cursor` for paging. 404 if the session is not owned by that profile (`sessions.py:770`).
- Scope: one profile, one session. Omitted profile = launch profile. Not a tenant.
- Auth: session token. Storage: `state.db`. Freshness: request-time. Not a live token stream.
- Events: none.
- Status: verified. SPEC 3.1, O28, O70.

**GET /api/sessions/{session_id}/messages**
- Handler: `sessions.py:723` `get_session_messages`.
- Request: path `session_id`; query `profile`, `limit` (ge 0; omitted means a latest page of 500, explicit limit capped at 500), `offset` (ge 0), `order` (`oldest` | `latest` | omitted), `include_compacted` default false, `inline_images` default true (`sessions.py:723-727`).
- Response (`sessions.py:758-767`): `{session_id, profile, messages, pagination}`. `pagination` is `{limit, offset, order, returned}`. `messages` are display-projected rows (`_project_for_display`), including compaction display views. 404 if the session is not in that profile store. `order` outside `oldest|latest` is 400.
- Scope: one profile, one session. Omitted profile = launch profile.
- Auth: session token.
- Storage: profile `state.db`.
- Freshness: request-time. Not a live token stream. Missing token fields on a message are not a usage total.
- Events: none.
- Status: verified. Used by chat. Not a separate Ops metric source. SPEC does not cite this path in sections 3-5; it is the sibling of the timeline read those sections do cite.

**GET /api/analytics/usage**
- Handler: `hermes_cli/web_routers/analytics.py:145` `get_usage_analytics`.
- Request: `days` 1-365 (default 30), `?profile=`.
- Response: per model/day aggregates. Usage keys in `_USAGE_KEYS` (`analytics.py:158`): `input_tokens, output_tokens, cache_read_tokens, reasoning_tokens, estimated_cost, actual_cost, api_calls, tool_calls`. A row can exist with zeros. Zeros here mean the aggregate counted zero, not "unknown".
- This is not per-run usage. Do not join it onto a kanban run and call it that run's tokens.
- Scope: one profile. Omitted profile = launch profile. Not a tenant. Not a run.
- Auth: session token. Storage: profile `state.db` session usage. Freshness: request-time SQL for the window.
- Events: none. Status: verified as a day/model aggregate. SPEC 3.1, O65, G5. Per-run tokens: proposed A2.

**GET /api/status**
- Handler: `hermes_cli/web_routers/status.py:466` `get_status`.
- Request: `?profile=`. A named profile uses config scope only, not the skills-module profile swap (`status.py:471`).
- Scope: one profile when named. Omitted profile = the serve process. Not a tenant. Not a board. `gateway_heartbeat_stale_s` is a producer field, not an A1 `observed_at`.
- Response keys include `version, gateway_running, gateway_state, gateway_platforms, gateway_exit_reason, gateway_updated_at, gateway_heartbeat_stale_s, gateway_shared_with, active_agents, gateway_busy, gateway_drainable, active_sessions, components, overall`, plus auth-gate shape. Topology cache TTL 10s (`status.py:489`). Heartbeat staleness is separate from "not running".
- `gateway_state.json` is read inside `_resolve_gateway_status`, not as its own route.
- Storage: process status plus `gateway_state.json` for the named profile. Not a db of presence.
- Auth: public allowlist. Still must not be treated as a secret dump; this doc does not copy paths or pids from the live body.
- Freshness: request-time plus 10s topology cache. `gateway_heartbeat_stale_s` null means fresh or not applicable.
- Events: none.
- Status: verified. SPEC 3.1 health strip. Capability flags for A1-A7 are not on this payload today. SPEC P0 task 6 (capability flag contract) is out of this slice.

### 4.4 Canvas node reads

**GET /api/tools/toolsets**
- Handler: `hermes_cli/web_routers/tools.py:231` `get_toolsets`.
- Request: `?profile=`.
- Response: a list, not an object. Each item (`tools.py:271`): `{name, label, description, platform, platform_label, enabled, available, configured, tools}`. `tools` is the sorted tool name set for that toolset. `configured` is credential presence, not the secret.
- Scope: one profile. Omitted profile = launch profile. Not a tenant.
- Auth: session token. Storage: profile config toolsets. Freshness: request-time. Events: none.
- Status: verified. SPEC 4.1 Tools.

**GET /api/skills**
- Handler: `hermes_cli/web_routers/skills.py:343` `get_skills`.
- Request: `?profile=`.
- Response: list from `_find_all_skills` reduced to `{name, description, category}` (`tools/skills_tool.py:239`) plus `enabled`, `usage`, `provenance` (`skills.py:367`). `category` is the parent directory under the skills root when the path has at least 3 parts (`skills_tool.py:130`); otherwise null. `provenance` is `hub | bundled | external | agent`. No `author`. No `mtime` / `updated`.
- Scope: one profile. Omitted profile = launch profile. Not a tenant.
- Auth: session token. Storage: profile `skills/**/SKILL.md` plus bundled/hub/external dirs. Freshness: request-time scan.
- Events: none.
- Status: verified. SPEC 4.1, G11, G68. G70 fields are absent (see verification).

**GET /api/skills/content**
- Handler: `skills.py:397` `get_skill_content`.
- Request: query `name` (required), `?profile=` optional.
- Response: `{name, content, path}` (`skills.py:413`). `content` is raw SKILL.md text (`utf-8-sig`). 404 if `_find_skill` misses or `SKILL.md` is absent. Frontmatter may contain `author` (`tools/skill_linter.py:103` warns if missing). This route does not parse it and does not return mtime.
- Scope: one profile, via `scoped_to_thread(profile, ...)`. Omitted profile = launch profile. Not a tenant.
- Auth: session token.
- Storage: that skill's `SKILL.md` under the profile-scoped skills roots (`tools/skill_manager_tool.py` `_find_skill`). Not the hub catalog.
- Freshness: request-time file read.
- Events: none.
- Status: verified as raw text, not as structured author/updated.

**GET /api/skills/hub/official**
- Handler: `skills.py:123` `list_official_skills`.
- Request: `?profile=` optional. It marks `installed` for that profile. It does not filter the catalog to installed skills.
- Response: `{skills: [...]}` (`skills.py:141`). Each item is `_skill_meta_to_payload` (`skills.py:77-81`: `name, description, source, identifier, trust_level, repo, tags`) plus `category` (from `official/<category>/<skill>`, else `general`) and `installed` (bool). Hub catalog, not the installed-skill list.
- Scope: the local optional-skills catalog, with install marks for one profile. Omitted profile = launch profile for the installed-set comparison. Not a tenant.
- Auth: session token.
- Storage: `OptionalSkillSource().list_local()` plus the profile's installed hub identifiers. Not `profiles/<name>/skills/**/SKILL.md` as the catalog.
- Freshness: request-time local scan.
- Events: none.
- Status: verified. SPEC G10. Bundles are not this route.

**GET /api/memory**
- Handler: `hermes_cli/web_routers/ops.py:491` `get_memory_status`.
- Request: `?profile=` optional (`ops.py:492`).
- Response: `{active, providers, builtin_files}` (`ops.py:502`). `active` is the normalized `memory.provider` or `""`. `builtin_files` is `{memory, user}` byte sizes of `MEMORY.md` / `USER.md`, or 0 if missing.
- Scope: one profile, via `config_scoped_to_thread(profile, ...)` (`ops.py:504`). Omitted profile = launch profile. Not a fleet read. Not a tenant.
- Auth: session token.
- Storage: profile config `memory.provider` and `memories/`.
- Freshness: request-time.
- Events: none.
- Status: verified. SPEC 4.1, G30.

**GET /api/memory/providers/{name}/config**
- Handler: `hermes_cli/web_routers/memory_providers.py:508` `get_memory_provider_config`.
- Request: path `name` (charset-allowlisted, `memory_providers.py:504`), optional `surface`, `?profile=`.
- Response: declared schema, or `{name, label, docs_url, fields}` / `{name, label, fields, setup}` when the provider has no surface (`memory_providers.py:515`). Empty `fields` means nothing to render.
- Scope: one profile when `?profile=` is set; omitted profile = launch profile. Not a tenant.
- Auth: session token.
- Storage: provider manifest. Not user memory files.
- Freshness: request-time.
- Events: none.
- Status: verified. SPEC 4.1.

**GET /api/messaging/platforms**
- Handler: `hermes_cli/web_routers/messaging.py:824` `get_messaging_platforms`.
- Request: `?profile=` optional.
- Response: `{env_path, gateway_start_command, platforms}`. Each platform is `_messaging_platform_payload` (`messaging.py:208`, returned at `:275-283`): `id, name, description, docs_url, enabled, configured, gateway_running, state, error_code, error_message, updated_at, home_channel, env_vars, ingress_url`. WhatsApp also adds `whatsapp_setup` (`:284-290`). Env rows include `key`, `is_set`, `redacted_value`, and `value` (`messaging.py:244`). `value` is the raw string when the var is a list type, otherwise null. `redacted_value` is a preview. Ops must use `is_set` / `configured` / `enabled` only and must not render `value`, `redacted_value`, or `env_path`. The handler does not fully mask secrets. `updated_at` here is a producer field on the platform runtime object, not an A1 observation clock.
- Scope: one profile, via `_profile_scope(profile)` (`messaging.py:832`). Omitted profile = launch profile. Not a tenant. Not a board.
- Auth: session token.
- Storage: that profile's `.env` plus `gateway_state.json` for runtime state (readers get an explicit profile dir because they do not follow the home contextvar, `messaging.py:830-831`).
- Freshness: request-time.
- Events: none on this GET.
- Status: verified as a route. SPEC 4.1 Channels, G29. The set/unset UI rule is a client obligation, not what the JSON already guarantees.

**GET /api/messaging/telegram/onboarding/{pairing_id}** and **GET /api/messaging/whatsapp/onboarding/{pairing_id}**
- Handler: `messaging.py:735` `get_telegram_onboarding_status`. `messaging.py:615` `get_whatsapp_onboarding_status`.
- Request: path `pairing_id` on both. No `?profile=` on these GETs. SPEC wrote `/api/messaging/*/onboarding`. Only these two platforms have status reads. Other platforms: `not exposed`.
- Response, Telegram, from the producers. Not a live body (this slice did not call onboarding). Ready, when the pairing record already holds `bot_token` or the upstream status is `ready`: `_telegram_ready_payload` (`messaging.py:701-705`) returns `{status: "ready", bot_username, owner_user_id, expires_at}`. Waiting, when the upstream status is `waiting`: `{status: "waiting", expires_at}` (`messaging.py:746-750`). `expires_at` on waiting is the in-memory record's value, or `""` if the record is gone between the poll and the return. Unknown pairing: 404. Upstream `expired` or `claimed`: 410, and the pairing is dropped. Any other upstream status: 502. Those errors are not extra success fields. Do not add fields the producers do not return.
- Response, WhatsApp: the GET returns `_whatsapp_onboarding_payload(pairing_id, record)` (`messaging.py:621`), defined in `hermes_cli/web_server_messaging.py:361-362`. Fields, all of them, no extras: `pairing_id` plus `_WHATSAPP_PAYLOAD_FIELDS` (`web_server_messaging.py:355-358`): `status, qr_payload, expires_at, mode, allowed_users, account_id, account_name, account_phone, error`. `status` is the session field (default `"starting"`, `web_server_messaging.py:339`). The terminal set the prune uses is `{connected, error, expired, cancelled}` (`messaging.py:338`). `expired` raises 410 before the payload (`messaging.py:619-620`). This doc does not close `status` beyond those producers. Do not invent a QR-only or ready/waiting twin of the Telegram object.
- Scope: one pairing id held on the serve process (`_telegram_onboarding_pairings` / `_whatsapp_onboarding_sessions`). Not a fleet read. Not a profile query. Not a tenant.
- Auth: session token.
- Storage: the in-memory onboarding session those handlers hold. Not `.env` values. Apply (a write, not this GET) is what would save env.
- Freshness: request-time. Telegram waiting/ready re-reads the upstream pairing when the local record has no token yet. That poll is inside the GET. It is not an Ops event.
- Events: none on the GET.
- Status: verified for those two platforms only. Live onboarding was not called.

**GET /api/mcp/catalog**
- Handler: `hermes_cli/web_routers/mcp.py:439` `list_mcp_catalog`.
- Request: `?profile=`, `detect_apps` (default false).
- Response (`mcp.py:469`): `{entries, diagnostics}`. Each entry (`mcp.py:402`): `name, description, connector_slug, source, transport, auth_type, required_env[{name, prompt, required}], command, args, url, install_url, install_ref, bootstrap, default_enabled, post_install, suggest|null, needs_install, installed, enabled`. `required_env` is names and prompts, not values. `diagnostics` is `{name, kind, message}[]`. No featured flag.
- Auth: session token.
- Storage: catalog manifests plus install state for the profile.
- Freshness: request-time.
- Events: none.
- Scope: one profile. Omitted profile = launch profile. Not a tenant.
- Status: verified. SPEC G6, G62. G64 stays a Cut: no featured flag here.

**GET /api/mcp/servers**
- Handler: `mcp.py:94` `list_mcp_servers`.
- Request: `?profile=`.
- Response: `{servers: [_mcp_server_summary...]}`. Summary (`hermes_cli/web_server_mcp.py:92`): `{name, transport, url, command, args, env, auth, enabled, tools, source, plugin}`. `env` is passed through `_redact_mcp_env`. Ops still must not render `env` values. `tools` null means all tools.
- Auth: session token.
- Storage: profile MCP config.
- Freshness: request-time.
- Events: none.
- Scope: one profile. Omitted profile = launch profile. Not a tenant.
- Status: verified. SPEC G33, G83.

**GET /api/providers/oauth**
- Handler: `hermes_cli/web_routers/oauth.py:683` `list_oauth_providers`.
- Request: `?profile=`.
- Response: `{providers: [{id, name, flow, cli_command, docs_url, disconnect_hint, disconnect_command, disconnectable, status}]}`. `status` is `_status_card` (`oauth.py:356`): `logged_in, source, source_label, token_preview, expires_at, has_refresh_token`, optional `last_refresh`. Catalog dispatch includes `openai-codex` and `xai-oauth` (`oauth.py:383`, `oauth.py:394`). Anthropic is an external flow that Hermes still owns (`oauth.py:644`).
- Ops must not render `token_preview`. Presence is `logged_in` boolean only (G84).
- Scope: one profile. Omitted profile = launch profile. Not a tenant.
- Auth: session token. Storage: auth store / provider credential files. Freshness: request-time. Not a P2 filter; the UI filters.
- Events: none.
- Status: verified. SPEC G84.

### 4.5 Files, git, logs

**GET /api/files/read**
- Handler: `hermes_cli/web_routers/files.py:560` `read_managed_file`.
- Request: `path` query. Policy rejects paths outside the managed roots (`_managed_readable_file`).
- Response (`files.py:566-572`): `{name, path, size, mime_type, data_url}` plus `_managed_response_meta` (`hermes_cli/web_server_files.py:196-198`): `{root, locked_root, can_change_path}`. `data_url` is `data:<mime>;base64,...`. 413 if over the size cap.
- Scope: the managed-files policy of the serve process. Not a profile query and not a board. Not an arbitrary path.
- Auth: session token.
- Storage: the file under the managed root. Not a db.
- Freshness: request-time file read.
- Events: none.
- Status: verified. SPEC O17, O34.

**GET /api/git/status**
- Handler: `hermes_cli/web_routers/git.py:50` `git_status_route` -> `hermes_cli/web_git.py:202` `repo_status`.
- Request: `path` (repo cwd).
- Response (`web_git.py:231`): `{branch, defaultBranch, detached, ahead, behind, staged, unstaged, untracked, conflicted, changed, added, removed, files}` or null if not a repo. `files` capped at 200.
- Scope: one repo cwd. Not a profile query and not a tenant. Show branch only when the focused task has this worktree.
- Auth: session token.
- Storage: the git repository at `path`. Not a Hermes db.
- Freshness: request-time git.
- Events: none.
- Status: verified. SPEC O36.

**GET /api/git/review/diff**
- Handler: `git.py:130` `git_review_diff_route`.
- Request: `path`, `file`, `scope` (default `uncommitted`), `base`, `staged`. Hosted read guard on the file (`_hosted_fs_read_guard`).
- Response: `{diff: string}` (`git.py:138`).
- Scope: one repo cwd, one file inside it. Not a profile query.
- Auth: session token.
- Storage: the git repository at `path`. Not a Hermes db.
- Freshness: request-time git.
- Events: none.
- Status: verified. SPEC O33, R38.

**GET /api/git/file-diff**
- Handler: `git.py:141` `git_file_diff_route`.
- Request: `path`, `file`.
- Response: `{diff: string}` vs HEAD (`git.py:146`, `_web_git.file_diff_vs_head`).
- Scope: one repo cwd, one file. Not a profile query.
- Auth: session token.
- Storage: the git repository at `path`. Not a Hermes db.
- Freshness: request-time git.
- Events: none.
- Status: verified. SPEC O33, O73.

**GET /api/logs**
- Handler: `hermes_cli/web_routers/status.py:825` `get_logs`.
- Request: `file` (default `agent`, must be a key of `LOG_FILES`), `lines` (capped 500, or 2000 then trimmed when `search` is set), `level`, `component`, `search`, `profile`.
- Response: `{file, lines}` (`status.py:865`). Missing file: `{file, lines: []}`. Unknown file: 400.
- Scope: one profile when `profile` is set; omitted profile = launch profile. Not a board and not a tenant.
- Auth: session token.
- Storage: `HERMES_HOME/logs/<name>` for that profile scope.
- Freshness: tail read at request time.
- Events: none.
- Status: verified. SPEC O35. Distinct from kanban `GET /tasks/{id}/log`.

### 4.6 Gateway run reads and approval events

**GET /v1/runs/{run_id}**
- Handler: `gateway/platforms/api_server_runs.py:1057` `_handle_get_run`. It returns `web.json_response(status)` from `_load_owned_run` (`:1059-1061`).
- Request: path `run_id`. No query schema.
- Response: the status dict `_set_run_status` keeps (`:258-266`). Always: `object: "hermes.run"`, `run_id`, `status`, `updated_at`, `created_at`.
- `session_id` is set at queued (`:718-719`: `_set_run_status(run_id, "queued", created_at=..., session_id=session_id, model=...)`). `session_id` is `selected_session_id or run_id` (`:703`). Later updates merge into the same dict, so the queued value stays unless a writer replaces it. Nullable only if a status object was built without that field. It is a gateway session id, not a kanban task id and not a token count.
- `model` is also set at queued from the request body, else `self._model_name` (`:719`). Terminal native runs add `runtime` (`provider`, `model`, plus the sanitized route fields `_finish` passes at `:986`). `runtime` is the served pair, not the request echo (`_served_runtime`, `:769`).
- `usage` is not on the queued object. A native terminal finish writes it (`:986` `_finish(..., usage=usage, runtime=served_runtime)`). Keys are `_USAGE_FIELDS` (`:88-91`): `input_tokens`, `output_tokens`, `total_tokens`, `cache_read_tokens`, `cache_write_tokens`. `_run_usage` (`:759-766`) reads session counters and coerces a missing or non-numeric counter to `0`. Those zeros are provenance `gateway.session_counters` (unverified-measured). A zero is not proof the counter was measured.
- A live-owner settled run writes `usage={}` (`:895-896`), not the five keys and not a missing key. Empty object, same provenance family (the owner's receipt, not `_run_usage`). Do not sum `{}` and do not treat it as null.
- If the `usage` key is absent (queued, or a failed/cancelled finish that did not pass `usage`), Ops reads null and provenance `unknown`. Do not coerce that absence to 0. Do not add a session total onto every run that shares `session_id` (provenance `shared-session`, tokens null, until a later adapter partitions by run). This slice does not add that partition.
- Other fields the writers add, when they add them: `output`, `error`, `completed`, `partial`, `interrupted`, `delivery_id`, `last_event`, `shutdown_requested_at`, `reason`, `approval` (only while `status == waiting_for_approval`; `:270-271` pops it otherwise). Not a closed enum. Do not invent fields the dict does not have.
- Scope: the caller's profile. Another profile's run id is not found (`_request_owns_run`), not leaked.
- Auth: Bearer API key, permission `status`. 401 is auth failure, not an empty status.
- Storage: in-memory `_run_statuses`, plus the durable idempotency record when the run was reserved (`:273-278`). Not `kanban.db`.
- Freshness: poll. `updated_at` is `event_at` (producer write time). `_set_run_status` sets it to now only when it writes (`api_server_runs.py:258-266`). `GET` `:1036-1061` returns the dict and does not refresh that field; `active_fallback` alone may write. A1 `observed_at` is the completion time of a successful GET, not `updated_at`. A failed GET does not stamp `observed_at`. See §5.1.
- Events: none on GET. The stream is `GET /v1/runs/{id}/events`.
- Status: verified. SPEC 3.1 API-run approvals. There is no list-all-runs read in the route table (`api_server_runs.py:234`). Kanban `task_runs` still has no `session_id` (`kanban_db.py:1080`). That gap is the O66 Cut. It is not a claim that this GET lacks `session_id`.

**GET /v1/runs/{run_id}/events**
- Handler: `api_server_runs.py:1064` `_handle_run_events`. SSE.
- Request: path `run_id`. Resume cursor: header `Last-Event-ID` or query `last_seq` (`:1084`). A missing cursor is `-1` (replay from the retained buffer). A non-integer cursor is also `-1` (`:1085-1088`).
- Response: SSE frames. Each retained event is written with `seq` copied onto the payload (`:1101-1104`) and as the SSE id. If the oldest retained seq is greater than `last_seq + 1`, a `replay.truncated` frame is written first (`:1115-1123`) with `oldest_retained_seq`, and `requested_seq` when the client sent a cursor. Comment frames `: open`, `: keepalive`, `: stream closed` are not events. Keepalive uses `CHAT_COMPLETIONS_SSE_KEEPALIVE_SECONDS` (`:1135`). A slow subscriber is detached (`:1139-1141`).
- Scope: one owned run. Not a kanban board stream. Not `since` on `task_events`.
- Auth: Bearer API key + run ownership (`:1066-1071`). 401/403 is auth failure, not an empty stream (SPEC section 11.6).
- Storage: the run's in-memory `_RunStream` buffer. Not durable across process restart.
- Freshness: live stream. Reconnect is `Last-Event-ID` / `last_seq`, not kanban `since`.
- Events: this is the event source. Includes `approval.responded` after a successful `POST /v1/runs/{id}/approval` (`:1213`). Does not include JSON-RPC `approval.received`.
- Status: verified. SPEC 3.1, O46, G21, G23, G44. This is gateway runs, not kanban runs.

**JSON-RPC `approval.pending`**
- Handler: `tui_gateway/methods_prompt.py:1184` → `list_gateway_approvals` (`tools/approval.py:193`).
- Request: `{session_id, profile?}` (`gateway-contract.generated.ts:2846`).
- Response: `{approvals: PendingApproval[]}`. `PendingApproval`: `request_id, command, description, pattern_key, pattern_keys, allow_permanent, allow_session, smart_denied, choices, tool_name`, plus unknown keys. Command text is the exact request. The generated comment says command is redacted in `server._approval_request_payload` — Ops must show whatever the payload actually contains and must not invent args that were redacted. If `command` is null, the why-line is "reason not recorded", not a guessed command.
- Scope: one session + optional profile. This does not list other sessions or other profiles (SPEC 3.1, A3 gap).
- Auth: gateway socket.
- Storage: `tools/approval.py` gateway queue for that session.
- Freshness: push, and the method is also a pull. Desktop already subscribes (`server-requests.ts`, cited by SPEC).
- Expiry: queue timeout is `approvals.timeout`, default 300 seconds (`tools/approval_context.py:247`). The pending payload has no `expires_at` field. A client must not invent one.
- Events: the Desktop already subscribes to this as a push (`server-requests.ts`). It is not `approval.received` and it does not retire a pending.
- Status: verified for the owning session. Not a cross-profile list.

**JSON-RPC `approval.respond`**
- Handler: `tui_gateway/methods_prompt.py:1204` → `resolve_gateway_approval` (`tools/approval.py:139-173`).
- Request: `{session_id, profile?, choice?, all?, request_id?}` (`gateway-contract.generated.ts:2876`).
- Response: `{resolved: number}`.
- `choice` is one of the offered choices (`once`, `session`, `always`, `deny`). `request_id` resolves one. `all` resolves every pending approval in that session. Neither means the oldest.
- Scope: one session. Not cross-profile. Cross-profile routing is proposed (section 6).
- Auth: gateway socket.
- Storage: in-memory gateway approval queue.
- Freshness: the call itself. Not a poll.
- This is a write. Listed because A3 dedupe is defined against it. Second resolution is a zero `resolved`, not a second side effect. Desktop must disable the button on send (SPEC 3.3) and treat `resolved == 0` as already resolved.
- Events: the JSON-RPC method returns a count and does not broadcast. The HTTP path for the same queue emits SSE `approval.responded` (`api_server_runs.py:1213`). This method is not that event.
- Status: verified write. Not implemented by this slice.

**JSON-RPC `approval.received` — client ACK, not settlement**
- Handler: `tui_gateway/methods_prompt.py:1193` `@method("approval.received")` calls `tools/approval.py:210` `ack_gateway_approval`.
- Request: `{session_id, profile?, request_id}` (`gateway-contract.generated.ts:2867`). `request_id` required (`methods_prompt.py:1198`).
- Response: `{acknowledged: boolean}` (`gateway-contract.generated.ts:2872`). True only when that `request_id` is still in the session queue (`approval.py:213-216`). False when it is already gone. False is not a settlement receipt.
- Effect: sets `entry.acknowledged = True` and leaves the entry in `_gateway_queues` (`approval.py:210-217`). It does not pop the entry, does not set a choice, and does not expire the approval.
- Scope: one session (`_sess`). Not cross-profile.
- Auth: gateway socket.
- Storage: in-memory gateway approval queue. Not durable history.
- Freshness: the ACK is a write of a flag, not a read of status. A client must not treat its own ACK as "resolved".
- Events: this method emits none. It is a JSON-RPC method (client → server), not a server push and not an SSE event.
- Status: verified as an ACK. It must not drop a Needs-you card and must not show "Resolved elsewhere". SPEC §1, §3.2, and R36 name it beside settlement. That is a source discrepancy (see `source-verification.md`). Do not copy it.

**Settlement signals (these retire a pending, or prove it is gone). `approval.received` is not one of them.**

Not a read route. Handler, request, response, scope, auth, storage, freshness, and events are the row that matches the signal. Status: verified signals. There is no universal event. Do not invent one.

| Signal | Kind | What it proves | What it does not prove |
|---|---|---|---|
| `approval.respond` result `resolved > 0` | JSON-RPC method, client → server. `methods_prompt.py:1204` → `resolve_gateway_approval` (`approval.py:139-173`) pops the entry under `_lock` and returns the count. | This call settled that many queued entries. | A second device's click. `resolved == 0` means nothing matched (already gone, unknown id, or empty queue). |
| `POST /v1/runs/{run_id}/approval` body `resolved > 0`, or 409 `approval_not_pending` | HTTP write. `api_server_runs.py:1168`. 409 when `resolve_gateway_approval` returns <= 0 (`:1209-1211`). | The run's approval session had a matching pending, or (409) it did not at this call. | Who settled it, if the code is 409. Not a JSON-RPC approval on another session. |
| SSE `approval.responded` | Server push on that run's event stream, only after a successful resolve (`api_server_runs.py:1213`). Fields: `choice`, `resolved`, and `request_id` when the body had one. | That gateway run already settled. Drop that run's pending. Do not also call respond. | JSON-RPC approvals that never touched this run. Not a universal event. |
| `approval.cancelled` | Server push (broadcast), not a method. `tui_gateway/session_lifecycle.py:505`. Payload (`gateway-contract.generated.ts:4776`): `session_id, stored_session_id, reason, cancelled_count, request_ids`. Desktop `lifecycle.ts:98` clears parked prompts for those ids. | Interrupt, reap, or teardown dropped those ids. | A user Approve/Deny. Not a history row of who resolved it. `cancelled_count` can disagree with `request_ids` when an entry has no id (contract comment at `:4775`). |
| Re-read `approval.pending` | JSON-RPC method, pull. `methods_prompt.py:1184` → `list_gateway_approvals` (`approval.py:193`). | Absence of the `request_id` from that session's list. Authoritative for that session only. | Other sessions, other profiles, or why it left. |

There is no universal resolution event. Do not invent one. SPEC R36 "last 50 resolved" has no read route. That history stays proposed with A3 (section 6) and must not be filled from ACK receipts.

**JSON-RPC `approval.cancelled`**
- Handler: no method. Producer `session_lifecycle.py:505` `_broadcast_global_event`. Consumer `apps/desktop/src/app/session/hooks/use-message-stream/gateway-event/lifecycle.ts:98`.
- Request: none (push).
- Response: payload above. Not `{acknowledged}`.
- Scope: the session being interrupted or torn down.
- Auth: gateway socket broadcast to clients that already hold the socket.
- Storage: none. The queue entries are dropped by `unregister_gateway_notify` (`approval.py:130`); the push is the client's only signal.
- Freshness: the event itself. A client that missed it must re-read `approval.pending`.
- Events: this is the event.
- Status: verified as a push. Not an ACK. Not a list API.

**JSON-RPC `config.get` / `config.set`**
- Handler: `tui_gateway/methods_config.py:287` `@method("config.get")`, wrapped by `@_profile_scoped`. The function is unnamed; dispatch key is `config.get`. Getter table `_CONFIG_GETTERS` (`methods_config.py:258-282`). `approvals.mode` and `approval_mode` both call `_load_approval_mode` (`tui_gateway/server.py:1891`), which reads `tools.approval_context._get_approval_mode` and returns that string only when it is in `_APPROVAL_MODES` (`server.py:1881`: `manual | smart | off`); otherwise `"manual"`. Unknown key: JSON-RPC error 4002 (`methods_config.py:292-293`). Getter failure for `approvals.mode`: error 5001 (`:284`, `:297-299`).
- Request: `ConfigGetParams` (`tui_gateway/contracts/config_free_tier_control.py:24`), subclass of `ProfileParams` (`contracts/common.py:231`, `profile: str | None`). Fields: `key` (required), `cwd` (optional, feeds the `project` getter), `session_id` (optional, lets `reasoning` / `fast` answer with the session pin), `profile`. Blank profile = launch profile. Desktop `apps/desktop/src/store/approval-mode.ts:69` is a caller of key `approvals.mode`, not the handler.
- Response: `ConfigGetResult` (`config_free_tier_control.py:42-59`). Fields the result type declares: `value, display, tool_progress, model, provider, providers, home, cwd, branch, config, prompt, mtime, mcp_rev`. A getter returns the subset it fills. `approvals.mode` returns `{value}` only. It does not return the Desktop cache. Values for that key: `manual | smart | off`, with unknown normalized to `manual` by `_load_approval_mode`, not by the UI. The UI cache default before a read is `smart` (`approval-mode.ts:44`). Those are different. Ops must show the RPC `value`, and `unknown` until the read returns. Do not paint `smart` as if it were confirmed. `config` on key `full` is the effective config dict and may contain secrets. Ops must not render it.
- Scope: one profile, the `@_profile_scoped` wrapper. Not all profiles. Not a tenant. Not a board.
- Auth: gateway socket.
- Storage: that profile's `config.yaml`, read through the gate (`_get_approval_mode` includes the managed overlay and `${VAR}` expansion; a raw re-read does not — `server.py:1892-1893`). Not the Desktop atom.
- Freshness: request-time pull. Not a push. A failed RPC does not count as an observation of the mode.
- Events: none from this method.
- Status: verified. SPEC O41.
- `config.set` is a write, listed so it is not mistaken for the read. Handler: `tui_gateway/methods_config_set.py:489` `@method("config.set")`. Contract `ConfigSetParams` / `ConfigSetResult` (`config_free_tier_control.py:75`, `:87`). Not implemented by this slice. Its axes are not a second read.

**JSON-RPC `projects.list`**
- Handler: `tui_gateway/methods_projects.py:81`, wrapped by `_projects_method` (`:27`) which is `profile_scoped` (`:32`).
- Request: profile param. Blank profile = launch profile. No `id`.
- Response: `{projects: Project.to_dict()[], active_id}` (`:20-24`, `include_archived=True`). `to_dict` (`projects_db.py:173-175`): `id, slug, name, description, icon, color, board_slug, primary_path, archived, created_at, folders[{path, label, is_primary, added_at}]`. No favourites column.
- Scope: one profile's `projects.db`. Not "all profiles". The all-profiles read is REST `GET /api/profiles/projects/tree`.
- Auth: gateway socket.
- Storage: `hermes_cli/projects_db.py`. Schema columns at `projects_db.py:29`.
- Freshness: request-time.
- Events: none from this method. Desktop may listen for `projects.changed` elsewhere.
- Status: verified. SPEC R4.

**JSON-RPC `projects.get`**
- Handler: `methods_projects.py:86` `_require_project`.
- Request: `{id}` plus profile. Missing or unknown id → error 5062 `no such project` (`:13`, `:38-39`).
- Response: `{project: to_dict()}`.
- Scope, auth, storage, freshness, events: inherited from `projects.list` (same wrapper). Status: verified.

**JSON-RPC `projects.create`** (write; listed so R4's create path is not mistaken for a read)
- Handler: `methods_projects.py:91`.
- Request: `name`, optional `folders, slug, primary_path, description, icon, color, board_slug, use`.
- Response: `{project}` or `{project: null}` if the row cannot be re-read.
- Scope: the profile on the RPC params. Create does not inherit "All profiles" (`apps/desktop/src/store/projects.ts:1111`). The writable owner is that profile.
- Auth: gateway socket. Storage: same `projects.db`. Freshness: the returned row is the post-write read. Events: none from this method.
- Status: verified write. Not implemented by this slice.

**JSON-RPC `projects.archive`** (write)
- Handler: `methods_projects.py:104`. Request: `{id, restore?}`. `restore` true calls `restore_project`, else `archive_project`.
- Response: same payload as `projects.list` (`_projects_payload`).
- Scope, auth, storage, freshness, events: inherited from `projects.list`. Status: verified write. Favourites stay a local pref. No server column.

### 4.7 Client event sources (not REST)

**Live sub-agents**
- Handler: none. Client store `apps/desktop/src/store/subagents.ts` (`$subagentsBySession`, `buildSubagentTree`). SPEC G24.
- Request: none. Not a REST or RPC read.
- Response: rows with `id, parentId, goal, sessionId, delegationId, status, inputTokens, outputTokens, costUsd` when the session event carried them. If the event omitted token fields, the UI must show null, not 0.
- Scope: one Desktop session on one connection. Not a profile config. Not a tenant.
- Auth: the Desktop session that already holds the gateway socket. No separate token.
- Storage: in-memory client store. Not durable across restart unless the session stream replays it.
- Freshness: the session stream. Lost on restart.
- Events: the session stream is the source. This store does not emit a backend event.
- Status: verified client store. No REST list. This is not A4. See section 7.

**`store/notifications`**
- Handler: none. Desktop toast queue.
- Request: none.
- Response: not exposed as a schema in this slice. It is a client queue, not a backend list.
- Scope: one Desktop process. Not profile-scoped on the server.
- Auth: none. Local UI.
- Storage: client memory. Not a db.
- Freshness: the event that enqueued the toast.
- Events: none of its own. SPEC O62 and O90 cite it as the toast surface for kanban blocked and A3.
- Status: verified as a client store. No new route.

**Local prefs**
- Handler: none.
- Request: none.
- Response: not a server document. Keys include motion, pins, seen-state, recent searches, rail colour overrides (`$profileColors`), profile skins (`themes/context.tsx` key `hermes-desktop-profile-themes-v1`).
- Scope: local to the Desktop install, keyed by connection and profile where the SPEC says so (O47, R35, R60).
- Auth: none.
- Storage: client persistence. Not config.yaml and not kanban.db.
- Freshness: local. Not a server TTL.
- Events: none.
- Status: client-only. SPEC O39, O47, R27, R35, R37, R60.

**G5 `store/free-tier*` — client cache of `free_tier.status`**
- Handler: JSON-RPC `free_tier.status` in `tui_gateway/methods_free_tier.py:20`, `@_profile_scoped`. Client cache: `apps/desktop/src/store/free-tier.ts:26` `$freeTierStatus`, refreshed by `refreshFreeTierStatus` (`:55`) which calls `free_tier.status`. Related files `store/free-tier-challenge` and `store/free-tier-sign-in` are UI around that atom, not a second status source. Glob `store/free-tier*` is these modules.
- Request: profile param (`ProfileParams` in `gateway-contract.generated.ts:5079`). Blank profile = launch profile.
- Response (`methods_free_tier.py:35-48`): `{has_guest, enabled, available, notice_pending, model, label}`. `available` is `has_guest and enabled`. When `enabled` and not `has_guest`, the payload also merges `last_mint_failure()` (`error, error_code, retryable, retry_after`) if that memo exists. `challenge` is present only while a browser challenge is pending. Desktop type `FreeTierStatus` (`apps/desktop/src/types/hermes.ts:164`) matches that shape. This is not a quota and not token usage.
- Scope: one profile's auth store. Not a fleet aggregate. Not tenant-scoped.
- Auth: gateway socket.
- Storage: local auth / guest identity (`hermes_cli/anon_auth`). The atom is a cache, not the store of record.
- Freshness: pull. The method is a local read with no network (`methods_free_tier.py:1-2`). `$freeTierStatus` starts `null` (`free-tier.ts:26`). Null means not asked yet. Every consumer must render as if there were no free tier until an answer lands (`free-tier.ts:23-24`). A failed refresh leaves the last answer (`:69-70`); it does not prove the tier turned off. Do not paint a usage banner from null.
- Events: `free_tier.challenge` and `free_tier` bootstrap broadcasts exist on the gateway contract. They are not a quota stream. This slice does not subscribe Ops to them.
- Status: verified RPC and verified client cache. No quota endpoint. The usage half of G5 remains `GET /api/analytics/usage` (section 4.3). A user-set budget in Ops settings is a local pref, `not exposed` on the server. Do not invent a percent-used field.

**Profile sigil colour**
- Handler: none. `apps/desktop/src/lib/profile-color.ts` `profileColor` (`:21`) and `resolveProfileColor` (`:35`).
- Request: profile name, plus the local override map.
- Response: HSL from the name, or the override, or null for `default` and empty. Not a field on `GET /api/profiles`.
- Scope: client. Not a server profile document.
- Auth: none.
- Storage: `$profileColors` for overrides. Skins are a different store (`themes/context.tsx`). There is no `themes/profile-theme` module.
- Freshness: deterministic from the name, except the override which is local.
- Events: none.
- Status: verified client source. SPEC O56. Not a Cut.

## 5. Proposed contracts (not implemented)

Confirmed absent from `hermes_cli/web_routers` and `plugins/kanban` at this SHA. Live 401s are not existence proof (section 2).

### 5.1 A1 `GET /api/ops/fleet` — proposed

SPEC 3.1 and section 11.7. Read-only aggregate. Do not ship a client-side copy that can disagree with this contract once the route exists.

- Handler: none. Not in `hermes_cli/web_routers` or `plugins/kanban` at this SHA.
- Request: `?connection=` is implicit (the serve process). No profile filter required; the route returns every profile that serve can see. Optional `board`. Do not copy `?board=` onto `GET /workflow` or `GET /orchestration`; those handlers do not take it.
- Response, per profile:

- `profile` (string)
- `presence`: `working | needs_you | blocked | idle | offline | unknown | stale`
- `sub_state`: `thinking | tool:<name> | waiting_approval | null`
- `observed_at` (unix seconds) — successful observation time. Required on every input that contributed, and on the profile result even for idle. This is not `updated_at` and not a failed-read timestamp.
- `event_at` (unix seconds or null) — producer write time when the source has one. For a gateway run this is `updated_at`. It does not enter the gate.
- `freshness_s` — now minus the deciding input's `observed_at`, or null when every presence input is missing. It is not "newest of all inputs". When rule 2 selects stale, the deciding input is the old work observation, so `freshness_s` is that work input's age, not the fresh gateway-up age.
- `next_run_at` (cron, or null)
- `active_runs`: list of `{source: kanban|gateway, id, task_id|null, started_at}`
- `precedence` (string: `missing`, `stale`, or the operational rule that won)

Two clocks per input. They are not interchangeable. `event_at` is producer write time. `observed_at` is the completion time of a successful read or a successful push receive. A failed revalidation does not write `observed_at`. A producer heartbeat, if a later slice requires one, is a limitation of that producer, not a read timestamp and not `observed_at`.

| Input | event_at (producer write) | observed_at (successful observation) | Missing means |
|---|---|---|---|
| kanban worker row | `last_heartbeat_at` or `started_at` on the row. Producer activity. Not the observation. | completion time of a successful `GET /api/plugins/kanban/workers/active` | no successful read of that route for this connection |
| gateway run status | `updated_at` on the status dict. Set by `_set_run_status` (`api_server_runs.py:258-266`) only on a write. `GET` `:1036-1061` returns the dict and does not refresh it (`active_fallback` alone may write). | completion time of a successful `GET /v1/runs/{id}` | no successful status read. Not "not running". |
| approval pending | none on the payload. `approvals.timeout` (`approval_context.py:247`, default 300) is the queue timeout, not either clock. | time the client successfully received `approval.pending` or the matching push for that profile | no successful list read for that profile |
| gateway up | `gateway_updated_at` and `gateway_heartbeat_stale_s` are producer fields. | completion time of a successful `GET /api/status` | `gateway_running` without a successful read is missing, not up |
| cron `next_run_at` | the schedule value itself. Not an observation. | completion time of a successful `GET /api/cron/jobs` for that profile | the next-run timestamp is not the observation clock |

An input is fresh when its `observed_at` is within 5 seconds (SPEC 3.3). It is old when a successful observation exists and `observed_at` is older than 5 seconds. It is missing when there has been no successful observation. A successful re-read stamps `observed_at` even when the body is unchanged and even when `event_at` / `updated_at` is old.

Work-bearing inputs: a kanban `workers/active` row, a gateway run whose status is `running`, a pending approval for that profile, an assigned task `status=blocked`. Gateway-up is not work-bearing.

One gate. First match. One output. There is no second paragraph and no "newest input" rule that can disagree with this list.

1. Every presence input missing → `unknown`. Never `idle`. `precedence=missing`.
2. Any work-bearing input whose latest successful observation is old and whose body still reports that work, with no fresher successful observation of the same input that contradicts it → `stale`. A fresh gateway-up does not override this. This is the only output for old running + fresh gateway-up, and for old pending + fresh gateway-up. `precedence=stale`. Rule 2 does not fire for gateway-up, and it does not fire when the body reports no such work. An old gateway-up with no work is not `stale`.
3. Only inputs with `observed_at` within 5 seconds may select an operational state, first match:
   1. fresh pending approval for that profile → `needs_you`, sub_state `waiting_approval`
   2. fresh kanban `workers/active` row or fresh gateway run status `running` → `working`. A missing approval list does not change this, does not invent `needs_you`, and does not demote the row to `unknown`.
   3. fresh assigned task `status=blocked` → `blocked`
   4. fresh gateway-up, and every work-bearing input is a fresh authoritative empty (a successful read whose body reports no such work) → `idle`. Missing work and old work do not license this rule.
   5. fresh observation that platforms are configured and the backend cannot reach them → `offline`
4. Otherwise → `unknown`. Never `idle`. A missing gateway read does not become `idle`. This rule owns an old (>5s) gateway-up reading with no work, and an old authoritative empty. Both are `unknown`, not `stale`. Gateway-up is not work-bearing, so rule 2 cannot fire on it. An old empty is not fresh, so rule 3.4 cannot fire on it. Example: now=100, gateway-up `observed_at`=70, no work-bearing body reporting work → `unknown`. Example: now=100, workers/active `observed_at`=70, body empty, gateway-up `observed_at`=99 → `unknown`, not `idle`.

Counterexample that rule 2 owns, and that rule 3.4 must not also answer: now=100, running `observed_at`=70, gateway-up `observed_at`=99. The running observation is old. Output is `stale`, `precedence=stale`, `freshness_s`=30. Not `idle`.

Single-input table. One input class per cell. It does not decide a mixed profile. Walk each cell through rules 1-4. The running and pending columns mean the body still reports that work. The gateway-up column means gateway-up is observed and every work-bearing input in the cell is an authoritative empty of the same validity (a successful read whose body reports no such work). It does not mean those work reads are missing. Missing work does not license rule 3.4.

| Input validity | running | pending approval | gateway-up, no work |
|---|---|---|---|
| fresh (≤5s) | working | needs_you | idle |
| old (>5s) | stale | stale | unknown |
| missing | unknown | unknown | unknown |

Cell equals gate:
- fresh running → rule 3.2 `working`. fresh pending → rule 3.1 `needs_you`.
- fresh gateway-up, no work → rule 3.4 `idle` only because the work-bearing inputs in that cell are fresh authoritative empties, not missing reads.
- old running → rule 2 `stale`. old pending → rule 2 `stale`.
- old (>5s) gateway-up, no work → rule 4 `unknown`. Not `stale`. now=100, gateway-up `observed_at`=70, no work-bearing body reporting work → `unknown`.
- missing → rule 1 `unknown` when that input is the only presence input in the cell.

Old authoritative-empty is not the old running or old pending cell. It is rule 4 `unknown`. Mixed cases use the next table, which is the same gate.

Mixed decision table. One output per row. Clocks are `observed_at` unless the row names `event_at`. No cell uses `updated_at` as the observation clock.

| Case | Output | Gate |
|---|---|---|
| old running (`observed_at` >5s, body still running) + fresh gateway-up | stale | rule 2 only. Not idle. now=100, running observed_at=70, gateway_up observed_at=99 → stale, freshness_s=30. |
| old pending (`observed_at` >5s, body still lists that pending) + fresh gateway-up | stale | rule 2 only. Not idle. |
| fresh running + missing pending | working | rule 3.2. Missing pending does not invent `needs_you` and does not demote to `unknown`. |
| fresh authoritative empty of the work-bearing inputs + fresh gateway-up | idle | rule 3.4. The empty is a successful read, not a missing read and not an old read. |
| old authoritative empty (`observed_at` >5s, body reports no such work), no fresher observation that reports work; gateway-up fresh, old, or missing | unknown | rule 4. Not rule 2 (the body does not report work). Not rule 3.4 (the empty is not fresh). A fresh gateway-up does not make this idle. now=100, workers observed_at=70 body empty, gateway_up observed_at=99 → unknown. |
| fresh gateway-up + missing work-bearing reads (not an authoritative empty) | unknown | rule 4. Rule 3.4 does not fire. Missing work does not license idle. |
| successful re-read, body unchanged | presence = the gate on the new `observed_at` and the unchanged body. `event_at` / `updated_at` do not move. | one output: re-evaluate. A quiet run whose `updated_at` is old is fresh running if the body still says `running`. |
| failed revalidation after a successful observation that is now >5s, body still reports work | stale | rule 2. `observed_at` is not set to the failure time. |
| failed revalidation with no prior successful observation | unknown | rule 1. The failure timestamp is not `observed_at`. |

Never map unknown → idle. Never map old running → working. Never map old running + fresh gateway-up → idle. Never map a missing observation → idle. Never treat `updated_at` as `observed_at`. Never map old gateway-up with no work → stale. Never map old authoritative-empty → stale or idle.

- Scope: the serve connection. Tenant is not a presence axis. Optional `board` filters kanban inputs only; it does not create a board query on gateway or cron reads.
- Auth: session token.
- Storage: no new table. Aggregate of workers/active, tasks, approvals, cron, `/api/status`.
- Freshness: the gate above. Polling 5s is fallback only (D12).
- Events: invalidate on kanban WS, a fresh re-read of `approval.pending`, the `approval.cancelled` push, and gateway run SSE including `approval.responded`. `approval.received` does not invalidate presence and does not clear `needs_you`. A failed re-read does not invalidate by stamping now.
- Status: proposed. Not implemented. This slice does not generate runs to test the table.

### 5.2 A2 per-run usage — proposed

There is no per-run token column on `task_runs`. `task_runs.metadata` is unstructured JSON, not a usage contract.

Gateway `GET /v1/runs/{id}` can carry `session_id` and, on a terminal finish, `usage`. That is not A2. The r1 claim that this GET has neither field was false.

- `session_id` is set at queued (`api_server_runs.py:718-719`). It names the gateway session. It does not name a kanban task.
- A native terminal finish writes `usage` with the `_USAGE_FIELDS` keys and `runtime` (`:986`). `_run_usage` (`:759-766`) coerces a missing counter to 0. Those zeros are provenance `gateway.session_counters` (unverified-measured). They are not A2's null, and they are not proof of measurement.
- A live-owner settled run writes `usage={}` (`:895-896`). Empty object, not the five keys, not a missing key. Same provenance family. Do not sum it. Do not display it as measured tokens.
- If the `usage` key is absent, Ops reads null and provenance `unknown`. Do not coerce that absence to 0.
- Two runs that share a `session_id` must not each display the session counters as their own total. Provenance `shared-session`, tokens null, unless a later adapter partitions by run. This slice does not add that partition.

Kanban `task_runs` has no `session_id` (`kanban_db.py:1080`). `tasks.session_id` (`kanban_db.py:808`) is the originating `HERMES_SESSION_ID` and is NULL for CLI/dashboard creates. No handler joins a kanban run id to a chat session id. That failed join is the O66 Cut. It is not a claim that gateway runs lack `session_id` or `usage`.

Contract when built:

- Read: `GET /api/ops/runs/{source}/{id}/usage` where `source` is `kanban` or `gateway`.
- Response: `{input_tokens: number|null, output_tokens: number|null, provenance: string, session_id: string|null}`.
- If the session usage row is missing, both token fields are null and `provenance` is `unknown`. Never 0.
- If two runs share a session, do not add the session total onto each run. Provenance `shared-session` and tokens null unless the usage row is partitioned by run.
- Gateway zeros and `usage={}` stay provenance `gateway.session_counters`. A2 must not re-label them as measured per-run tokens.
- Today-total for the status bar is a different read: `GET /api/analytics/usage?days=1` with provenance `analytics.usage:days=1`. Do not add it to per-run figures.
- Cron output preview rows in `cron.py:262` hard-code `input_tokens: 0` and `output_tokens: 0`. Those zeros are placeholders for a file preview, not measured usage. Ops must not display them as tokens.
- Handler: none. `GET /api/ops/runs/{source}/{id}/usage` is not in this tree. Not `GET /v1/runs/{id}` (`_handle_get_run`). Not `get_run_endpoint`. Do not point an existing symbol at this path.
- Request: path `source` (`kanban` or `gateway`) and `id`. No query is specified. Do not add `?profile=`, `?board=`, or `?tenant=`.
- Response: `{input_tokens: number|null, output_tokens: number|null, provenance: string, session_id: string|null}`, as above. No field added in this round.
- Scope: connection = the serve process. SPEC places A2 in `hermes_cli/web_server` routers with A1–A5. Not a tenant filter. `source=gateway`: Scope inherits §4.6 `GET /v1/runs/{id}` Scope exactly (the caller's profile; another profile's run id is not found, not leaked). `source=kanban`: Scope inherits §4.2 `GET /api/plugins/kanban/runs/{run_id}` Scope exactly (one board, one run; profile is a column on the row, not `?profile=`). This path does not copy that route's `?board=`. Which board an unqualified kanban id belongs to: incomplete. Do not invent a board query.
- Auth: session token. Inherits §2 dashboard session boundary exactly. Not the gateway Bearer key. §4.6 Bearer + permission `status` is the producer boundary, not this route's.
- Storage: no new table. Gateway producer store inherits §4.6 Storage exactly (in-memory `_run_statuses`, plus the durable idempotency record when the run was reserved). Not `kanban.db`. Kanban `task_runs` has no token column and no `session_id` (`kanban_db.py:1080`). `metadata` is not a usage contract. SPEC names per-session usage in `state.db` via run→session_id. That join does not exist (O66 Cut). Authoritative per-run store for a kanban id: incomplete. Do not invent a column or a join.
- Freshness: request-time observation of the producer, not a presence gate. Gateway source inherits §4.6 Freshness exactly for the producer clock (`updated_at` is `event_at`; a successful read's completion is the observation; a failed read does not stamp it and does not coerce a missing `usage` key to 0). Kanban source inherits §4.2 `GET /runs/{run_id}` Freshness exactly (request-time, not a push) for the run row, which still has no token column. Cache TTL for this route: incomplete. Do not invent one. Do not apply the A1 5s gate.
- Events: none. This GET emits nothing. Gateway run SSE (§4.6) is not this route's event axis. Do not invent an invalidation event.
- Status: proposed. SPEC O19, O23, G22, G45, O66. Cache TTL incomplete. Kanban per-run store incomplete. Unqualified kanban board incomplete.

### 5.3 A3 — see section 6

### 5.4 A4 — see section 7

### 5.5 A7 SSE `GET /api/plugins/kanban/events/stream` — proposed path, existing socket

SPEC names an SSE route. The tree has a WebSocket at `/api/plugins/kanban/events` with `since`. Do not implement a second stream in this slice. Do not bind `stream_events` to this path.

- Handler: none for `GET /api/plugins/kanban/events/stream`. Proposed. The existing symbol is §4.2 only (`@router.websocket("/events")` at `plugin_api.py:1783`, `stream_events` at `:1784`). It is not this route.
- Request: query `board` (required if this path is added). Resume cursor `Last-Event-ID` equal to `task_events.id`. An omitted cursor must not replay the whole table — the same rule as a missing WS `since` (§4.2). No `?profile=`. No other query is specified. Do not add one.
- Response: inherits the verified WS frame exactly. `stream_events` sends `{"events": [...], "cursor": int}` (`plugin_api.py:1809`). Each event is the selected `task_events` row `id, task_id, run_id, kind, payload, created_at` (`plugin_api.py:1744-1753`); `payload` is parsed JSON or null. Do not add fields that frame does not have. SSE `id`, if the path is added, is `task_events.id`. This is the producer schema to inherit, not a second handler and not an implemented SSE envelope.
- Scope: inherits §4.2 Scope exactly (one board, not every board, not `?profile=`). `board` in the query is the same constraint as the WS `board` query; it is not a new param. Tenant filter: incomplete. §4.2 does not name one. Do not invent one.
- Auth: inherits §4.2 Auth exactly (WS upgrade gate, `plugin_api.py:50` `_ws_upgrade_authorized`). Same credential boundary. Not a new token.
- Storage: inherits §4.2 Storage exactly (`task_events`, `kanban_db.py:1064-1071`). Not a second table.
- Freshness: incomplete. Does not inherit §4.2 Freshness. That 300ms poll (`plugin_api.py:1694`) is the WS implementation, not this absent route. Do not invent an SSE interval or heartbeat.
- Events: inherits §4.2 Events exactly for the role (this is the event source; `GET /board` `latest_event_id` is the snapshot cursor). The SSE path emits nothing at this SHA. Handler absent.
- Status: SSE path proposed. WebSocket verified in §4.2. Freshness incomplete. Tenant filter incomplete.

Until that route exists, Board push uses the verified WebSocket.

### 5.6 Capability flags

SPEC section 8 says older backends degrade via `/api/status` version. This SHA's `get_status` does not return `ops_capabilities`. Proposed flags, not implemented: `ops.fleet`, `ops.usage`, `ops.approvals`, `ops.delegation`, `ops.kanban_sse`. Absence means proposed routes are absent. Do not probe them by catching 401.

## 6. A3 approval envelope, expiry, status, dedupe

Not implemented. Specified so P1 does not invent a second shape.

**List** `GET /api/approvals/pending` — proposed.

- Handler: none. Not in this tree.
- Request: optional `profile`, optional `board`. No query means every profile on this connection.
- Response: the item fields in the table below.
- Scope: the serve connection. Remote connections may read. They may not be given a respond route that writes another machine's queue. Tenant is a field on kanban items, not a filter that hides other origins.
- Auth: session token. Proposed.
- Storage: none of its own. Aggregate of the sources in §4.6 and kanban blocked/review. Not implemented.
- Freshness: proposed. A failed re-read does not stamp `observed_at`.
- Events: none on the GET. Invalidated by the settlement signals in §4.6. `approval.received` does not invalidate.
- Status: proposed.

Query: none for "all profiles on this connection". Optional `profile`, `board`. Connection is the serve process.

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

- Handler: none new. Inherited exact §4.6 `approval.respond` and `POST /v1/runs/{id}/approval`.
- Request: inherited exact §4.6 for those two writes. Other origins do not call `approval.respond`.
- Response: inherited exact §4.6.
- Scope: the item's session or run. Not every profile.
- Auth: inherited exact §4.6.
- Storage: inherited exact §4.6.
- Freshness: the call itself.
- Events: inherited exact §4.6. No universal event.
- Status: the two methods are verified and session- or run-scoped. Cross-profile routing is proposed. Not implemented here.

- `origin=jsonrpc`: JSON-RPC `approval.respond` with the item's `session_id`, `profile`, `choice`, `request_id`.
- `origin=gateway_run`: `POST /v1/runs/{run_id}/approval` (`api_server_runs.py:1168`). Body `{choice, request_id?, all?}`. Aliases `approve|approved|allow` map to `once`. Room grants: `once|deny` only, `request_id` required, `all` rejected (`api_server_runs.py:1184`).
- Other origins do not call approval.respond.

**Dedupe**

- Handler: none. This is a client rule against the signals in §4.6.
- Request: none.
- Response: none. The list does not drop an item on ACK.
- Scope: inherited exact §6 List identity `(connection, profile, session_id or run_id, request_id)`.
- Auth: inherited exact §6 List.
- Storage: none.
- Freshness: a settlement signal, not an ACK.
- Events: inherited exact §4.6. `approval.received` is not one of them.
- Status: proposed list behavior. Specified. Not implemented.

- Identity: `(connection, profile, session_id or run_id, request_id)`.
- `approval.received` is not a resolution. A duplicate ACK, a second device's ACK, and `acknowledged: true` leave the entry queued (`ack_gateway_approval`, `approval.py:210-217`). The list does not drop the item. The UI does not show "Resolved elsewhere" for an ACK.
- Settlement is one of the signals in section 4.6, by kind:
  - JSON-RPC method `approval.respond`: `resolved > 0` means this call popped the entry (`resolve_gateway_approval`, `approval.py:139-173`). `resolved == 0` means it was already gone or never matched. The UI may show "Resolved elsewhere" only after that zero, or after a re-read that no longer lists the id. It does not send a second respond.
  - HTTP write `POST /v1/runs/{id}/approval`: body `resolved > 0`, or 409 `approval_not_pending` when `resolve_gateway_approval` returns <= 0 (`api_server_runs.py:1209-1211`). Same rule. The 409 is not itself an event.
  - SSE server push `approval.responded` on that gateway run (`api_server_runs.py:1213`): the run stream says the resolve already happened. Drop that run's pending. Do not also call respond.
  - Server push `approval.cancelled` (`session_lifecycle.py:505`): interrupt/reap/teardown dropped those `request_ids`. Drop those ids. This is not a user resolution and not a "who approved" history row.
  - Pull: re-read `approval.pending` for that session. Absence is authoritative for that session only.
- `all: true` is scoped to that session's pending queue, never to every profile.
- One click stays (D3). Idempotency is the server count, not a client lock alone.
- No universal resolution event. SPEC §1, §3.2, and R36 conflate ACK with settlement. Recorded in `source-verification.md`. Do not invent an event to paper over that.

Status of the list route: proposed. Status of the two respond methods: verified, session- or run-scoped, not cross-profile.

## 7. Configured delegation vs live sub-agents

These are different objects. A4 must not merge them.

**Configured delegation (A4, read-only, proposed projection, source verified)**

- Source read: `GET /api/config?profile=` keys under `delegation` (`config_defaults.py:1330`).
- Handler: the raw read is `config_env.py:80` `get_config`. The projection route has no handler.
- Request: `?profile=` on the source read. The proposed projection uses the same query.
- Response: projection `{profile, model, provider, inherit_model, inherit_provider, fallback_providers, inherit_mcp_toolsets, api_key_set}`. No child list. No session ids. `api_key` is stripped; `api_key_set` is boolean only.
- Scope: one profile. Omitted profile = launch profile. Not a live sub-agent tree. Not a tenant.
- Auth: session token, same gate as `GET /api/config`.
- Keys: `model, provider, fallback_providers, base_url, api_key, api_mode, request_overrides, compression_threshold_tokens, inherit_mcp_toolsets`, plus later keys in that dict (`max_iterations`, `max_concurrent_children` from migrations).
- Empty `model` / `provider` means inherit parent. `fallback_providers: null` means inherit; `[]` means disabled.
- `api_key` must be stripped. Response field `api_key_set: boolean` only.
- Projection response (proposed `GET /api/ops/delegation?profile=`): `{profile, model, provider, inherit_model, inherit_provider, fallback_providers, inherit_mcp_toolsets, api_key_set}`. No child list. No session ids.
- Storage: config.yaml. Freshness: request-time. Events: none.
- Status of the raw config read: verified. Status of the projection route: proposed. SPEC 4.1 Sub-agents, G34.

**Live sub-agents (verified client store, not A4)**

- Handler: none. Client store `apps/desktop/src/store/subagents.ts`.
- Request: none. Not a REST or RPC read.
- Response: inherited exact §4.7 Live sub-agents.
- Scope: one Desktop session on one connection. Not A4. Not a profile config.
- Auth: inherited exact §4.7.
- Storage: inherited exact §4.7.
- Freshness: inherited exact §4.7.
- Events: inherited exact §4.7.
- Status: verified client store. Not implemented as an adapter.

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
| POST /links | `plugin_api.py:811` | Write. No GET `/links`. The read is embedded in `GET /tasks/{id}`. |
| DELETE /links | `plugin_api.py:818` | Write. |
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

Not in `hermes-agent`. Installed at `C:\Users\nachi\AppData\Local\hermes\plugins\workflow-studio`. Desktop drop-in: `HERMES_HOME\desktop-plugins\workflow-studio`. Live plugin list on the ephemeral serve included the name `workflow-studio`. Mount comment: `dashboard/plugin_api.py:1` — `/api/plugins/workflow-studio`.

Shared axes, unless an entry overrides them:

- Scope: the plugin's own DB, not a Hermes profile query and not a kanban board. `project_id` is a workflow-studio project id, not `projects.db`.
- Auth: dashboard session token, same gate as other plugins. Live `GET /api/plugins/workflow-studio/health` returned 401 without a token. Payload not read. 401 is not existence proof.
- Storage: the plugin DB (`workflow_studio/db.py`), not `kanban.db` templates. `workflow_template_id` does not appear in that plugin tree.
- Freshness: request-time. Events: none on these GETs.
- Status: verified handlers in the external tree. Not a substitute for kanban `workflow_template_id`.

**GET /projects**
- Handler: `dashboard/plugin_api.py:75` `get_projects` → `list_projects` (`workflow_studio/db.py:140`).
- Request: none.
- Response: `{projects: [{id, name, paths}]}` (`db.py:156-157`).
- Scope, auth, storage, freshness, events, status: inherited exact §9 shared axes.

**GET /workflows**
- Handler: `plugin_api.py:107` `get_workflows`.
- Request: query `project_id` required. Unknown project → 404.
- Response: `{workflows: [{id, project_id, name, version, nodes, edges}]}` (`db.py:169-177`, `:229`). Latest version per workflow.
- Scope, auth, storage, freshness, events, status: inherited exact §9 shared axes.

**GET /workflows/{workflow_id}**
- Handler: `plugin_api.py:128` `get_workflow_route` → `get_workflow` (`db.py:211`).
- Request: path `workflow_id`.
- Response: the same workflow object, or 404. Not wrapped in `{workflow: ...}`.
- Scope, auth, storage, freshness, events, status: inherited exact §9 shared axes.

**GET /runs/{run_id}**
- Handler: `plugin_api.py:187` `get_run` → `read_run` (`workflow_studio/compile.py:225`).
- Request: path `run_id`.
- Response (`compile.py:255-263`): `{id, workflow_id, version, kind, enqueued, tasks, context}` or 404. `tasks[]` is `{node_id, task_id, status, session_id}` and, when a kanban task exists, `assignee`. `session_id` here is `worker_session_id` from kanban metadata (`compile.py:220-222`), not a contract that `task_runs.session_id` exists. `context` is null when no capture row exists. Inner `context` keys are `not exposed` by this document (delegated to `context_metadata`).
- Scope: one plugin run, joined to kanban task rows for status. Not a Hermes profile query.
- Auth: inherited exact §9 shared axes.
- Storage: inherited exact §9 shared axes.
- Freshness: inherited exact §9 shared axes.
- Events: inherited exact §9 shared axes.
- Status: verified handler. Not the O66 kanban-run-to-session join.

**GET /health**
- Handler: `plugin_api.py:201` `health`.
- Request: none.
- Response (`plugin_api.py:203-210`): `{ok, mode, dispatch, tasks_initial_status, prepare_only_default, node_model_pinning}`. Observed in source as `ok: true`, `mode: "shadow"`, `dispatch: "native-only"`. Not a Hermes `/api/health`.
- Scope: process. Auth: session token (gated; live 401 without a token). Storage: none (constants). Freshness: request-time. Events: none. Status: verified handler, payload not read live.

**GET /decisions/{decision_id}**
- Handler: `plugin_api.py:275` `get_decision_route` → `get_decision` (`workflow_studio/scope.py:139`).
- Request: path `decision_id`.
- Response: `{id, project_id, question, choice, status, evidence_refs, supersedes, superseded_by, transitions, actor, verification, audit}` (`scope.py:109-171`) or 404. `audit` is `{claimed, verified}`.
- Scope, auth, storage, freshness, events, status: inherited exact §9 shared axes.

**GET /memory**
- Handler: `plugin_api.py:315` `get_memory` → `search_memory` (`scope.py:399`).
- Request: query `project_id` required, `q` default `""`. Empty `q` returns the latest 50. Bad FTS → 400. Unknown project → 404.
- Response: `{items: [{id, project_id, session_id, source_ref, text}]}` (`scope.py:298-305`).
- Scope, auth, storage, freshness, events, status: inherited exact §9 shared axes.

**GET /recovery**
- Handler: `plugin_api.py:321` `get_recovery` → `recovery_packet(..., do_judge=False)` (`scope.py:428`).
- Request: query `project_id` required, `q` default `""`.
- Response (`scope.py:485-493`): `{project: {id, name}, decisions, proposed, items, tasks, sessions, controller}`. `controller` is `{mode: "shadow", status: "not_called"}` on this GET (`do_judge=False`). `sessions` is `{session_id}[]`. `tasks` reuses the run-task shape plus `run_id`.
- Scope, auth, storage, freshness, events, status: inherited exact §9 shared axes.

Writes (not used here): POST/PUT workflows, POST runs, decisions, memory, `POST /recovery/judge`. Compile-to-kanban is a write path in `workflow_studio/compile.py`. It is not a kanban template catalog.

## 10. Null usage rule (all surfaces)

| Surface | If the source has no usage | Forbidden display |
|---|---|---|
| A2 per-run | `null`, provenance `unknown` | `0` |
| Gateway `GET /v1/runs/{id}` key absent | `null`, provenance `unknown` | coercing absence to `0` |
| Gateway `_run_usage` zeros | keep the zeros, provenance `gateway.session_counters` (unverified-measured) | calling a coerced 0 measured, or summing it onto another run that shares `session_id` |
| Gateway live-owner `usage={}` | empty object, same provenance family | treating `{}` as null, as measured zeros, or as a per-run total |
| `GET /api/analytics/usage` | the aggregate's real zero, provenance `analytics.usage` | calling that zero a run's tokens |
| cron output preview row | ignore `input_tokens: 0` (`cron.py:270`) | showing it as usage |
| `GET /api/sessions/search` | coerced `input_tokens or 0` (`sessions.py:385`) | showing that zero as usage |
| live sub-agent event | `null` when the event omitted tokens | `0` |
| G5 `free_tier.status` / `$freeTierStatus` null | not a usage number | a percent banner |
| status bar today-total | only `analytics.usage?days=1`, tooltip names that route | sum of run nulls |

A missing number is null with a provenance string. It is not zero, and it is not hidden without the provenance tooltip (SPEC section 2 UI rule). A present gateway zero is not that missing number.

## 11. SPEC → source matrix

Every route or source cited in SPEC sections 3-5 and 12.8 is either an entry above or an explicit "not a read" / "not exposed" / "not inventoried" reason. UI-only rows are classified, not skipped. This slice does not add endpoints to fill a cell.

### 11.1 Sections 3-5

| Citation | Anchor |
|---|---|
| `GET /api/profiles` | §4.1 |
| presence via `workers/active`, session stream, approvals, blocked, gateway up | §4.2 workers, §4.7 live sub-agents (not a fleet presence read), §4.6 `approval.pending`, §4.3 `/api/status`. The aggregate is proposed A1 §5.1 |
| `GET /api/ops/fleet` (A1) | §5.1 proposed |
| `tasks.current_step_key`, `workflow_template_id` via `/api/plugins/kanban/board` | §4.2 board. The template id is a nullable column, not a catalog (source-verification O16) |
| `GET /api/plugins/kanban/runs/{id}`, `/inspect` | §4.2 |
| `GET /api/analytics/usage` | §4.3 |
| Adapter A2 | §5.2 proposed |
| `task_events` via board/task detail | §4.2 `get_task` / board |
| `/api/sessions/{id}/timeline` | §4.3 |
| `/api/status`, `gateway_state.json` | §4.3. The json is read inside status, not its own route |
| `GET /api/cron/jobs` | §4.3 |
| JSON-RPC `approval.pending` | §4.6 |
| `server-requests.ts` | not a backend read. Desktop already subscribes. The read is `approval.pending` |
| gateway `/v1/runs/{id}` | §4.6 |
| `POST /v1/runs/{id}/approval` | §8 write. Settlement signal in §4.6, not a read |
| kanban `status=blocked` / `status=review` | fields on §4.2 board/task. No separate list route |
| cron `failure_streak>0` | field on §4.3 cron jobs |
| policy violations §4.4 | not a read route. P2 is a write-time rule (header). No `GET /api/ops/policy` |
| Adapter A3 `GET /api/approvals/pending` | §6 proposed |
| `approval.respond` | §4.6 method (write) and §6 dedupe |
| `PATCH /api/plugins/kanban/tasks/{id}` | §8 write |
| `POST .../comments` | §8 write. No GET `/comments`. Comments are embedded in `GET /tasks/{id}` |
| `POST .../reclaim` | §8 write |
| `/v1/runs/{id}/steer`, `/stop` | §8 writes |
| kanban `POST /runs/{id}/terminate` | §8 write |
| `approval.cancelled` / `approval.received` (§3.2) | §4.6. `received` is an ACK, not settlement. Discrepancy recorded in source-verification. Do not copy SPEC §3.2's "Resolved elsewhere" onto the ACK |
| `/api/dashboard/agent-plugins/{name}/enable` | §8. Write. Handler not opened this slice. Blocker for that CTA, not a verified read |
| `GET /api/profiles/{n}/soul` | §4.1 |
| Description `/api/profiles/{n}` | §4.1 list field. No dedicated GET-by-name |
| `/api/model/options` | §4.1 |
| `GET /api/tools/toolsets` | §4.4 |
| `GET /api/skills` | §4.4 |
| `GET /api/memory`, `/api/memory/providers/{n}/config` | §4.4 |
| `GET /api/messaging/platforms` | §4.4 |
| `GET /api/cron/jobs` origin filter | §4.3. Ownership is `origin`, not the listing profile |
| `GET /api/webhooks` | §4.3 |
| Adapter A4 `/api/config?profile=` | §4.1 raw read verified. Projection route §7 proposed |
| `GET /api/config/raw` | §4.1 |
| `POST /api/profiles/{n}/snapshot` (A5) | §8. Absent. Proposed. Not a read |
| `/api/config/schema` | §4.1 |
| `/api/gateway/restart` | not inventoried as a read: SPEC §4.3 cites it as a confirmed write. Handler not opened this slice |
| `GET /api/plugins/kanban/board` | §4.2 |
| `/api/plugins/kanban/config` | §4.2. Does not return a lanes array. Columns come from `GET /workflow` |
| `POST /tasks/{id}/reassign` | §8 write |
| `/tasks/{id}` | §4.2 |
| `/comments` | not exposed as GET. Embedded in `GET /tasks/{id}` |
| `/attachments` | §4.2 list route, also embedded |
| `/links` | not exposed as GET. Embedded in `GET /tasks/{id}` (`links`, `link_tasks`). POST/DELETE only (§8) |
| `/runs/{id}` | §4.2 kanban run. Distinct from gateway `/v1/runs/{id}` and from workflow-studio `/runs/{id}` (§9) |
| `POST /tasks`, `POST /tasks/bulk`, `POST /tasks/{id}/estimate` | §8 writes |
| `GET /api/plugins/kanban/events/stream` (A7) | §5.5 proposed. Existing socket is WS `/events` §4.2 |

### 11.2 Section 12.8

`not a read` means the citation is UI, a local pref, a Cut with no source, or an existing Desktop surface this slice does not re-specify. It is classified, not forgotten.

| ID | Cited source | Anchor |
|---|---|---|
| O1 | A1 `/api/ops/fleet` | §5.1 |
| O2 | A1 + `/api/profiles/{n}` | §5.1, §4.1 |
| O3 | `POST /api/plugins/kanban/tasks` | §8 write |
| O4 | `/api/cron/blueprints`, kanban tasks history | §4.3 blueprints. Task history is board/task events §4.2, not a template catalog |
| O5 | A3 + kanban blocked/review + cron failures | §6, §4.2, §4.3 |
| O6 | `/api/plugins/kanban/board` | §4.2 |
| O7 | task_events, `/api/sessions` | §4.2, §4.3 |
| O8 | D3 full-args rule | not a read. UI rule on A3 `exact_request` (§6) |
| O9 | `app/routes.ts` | not a read. Desktop route table, not opened as a handler |
| O10 | A1 | §5.1 |
| O11 | A3 count | §6 |
| O12 | `projects.db` via `/api/profiles/projects/tree` | §4.1 |
| O13 | A1 + `/api/profiles` | §5.1, §4.1 |
| O14 | `POST /api/profiles` | not a read. Write. Handler not opened this slice |
| O15 | POST kanban `/tasks` | §8 |
| O16 | `/api/cron/jobs/{id}/trigger`; workflow-studio | §8 trigger write. Plugin reads §9. Kanban template mapping failed (source-verification) |
| O17 | kanban attachments, `/api/files/read` | §4.2, §4.5 |
| O18 | `/api/sessions`; task_events | §4.3, §4.2 |
| O19 | A2 | §5.2 |
| O20 | `/api/sessions`; task_events | §4.3, §4.2. Same sources as O18, different lens |
| O21 | A1 | §5.1 |
| O22 | kanban task, `/api/env`, `/api/memory` | §4.2, §4.1 env, §4.4 memory |
| O23 | A2 | §5.2 |
| O24 | `/api/profiles/{n}`, toolsets, `command_allowlist`, task_runs count 7d | §4.1, §4.4 toolsets, §4.1 `command_allowlist`. 7d count `not exposed` |
| O25 | Cut, no fake states | not a read |
| O26 | `src/AGENTS.md` Bot Mode | not a read. Desktop invariant, not a route |
| O27 | kanban tasks/links | §4.2 `links` embedded. No GET `/links` |
| O28 | task_events + timeline | §4.2, §4.3 |
| O29 | steer/stop, approval, comments, unblock | §8, §4.6, §6 |
| O30 | UI expand | not a read |
| O31 | UI tabs | not a read |
| O32 | existing Desktop chat | not a new read |
| O33 | `/api/git/review/diff`, `/api/git/file-diff` | §4.5 |
| O34 | `/api/files/read` | §4.5 |
| O35 | kanban logs, `/runs/{id}/inspect`, `/api/logs` | §4.2 log + inspect, §4.5 |
| O36 | git status | §4.5 |
| O37 | Cut | not a read |
| O38 | `store/command-palette.ts` | not a backend read. Client store |
| O39 | local pref | §4.7 |
| O40 | `/api/model/set`, `ops-policy.yaml` | not a read. Model write is outside this slice. Policy is the header rule, not a GET. The picker read is `/api/model/options` §4.1 |
| O41 | `approvals.mode` via `/api/config` | §4.1, JSON-RPC `config.get` §4.6 |
| O42 | `/api/env` | §4.1 |
| O43 | no source | not a read |
| O44 | UI | not a read |
| O45 | Desktop connection store | not a REST read. Scope axis §3 |
| O46 | `/v1/runs/{id}/events` | §4.6, including `Last-Event-ID` / `last_seq` / `seq` / `replay.truncated` |
| O47 | local last-seen, task_events | §4.7, §4.2 |
| O48 | UI | not a read |
| O49 | UI | not a read |
| O50 | `/api/model/options`, PUT model | §4.1 read. PUT is §8 (Canvas writes, not opened line-by-line) |
| O51 | UI | not a read |
| O52 | command palette | not a backend read |
| O53 | A1 | §5.1. Count only fresh observations (the gate) |
| O54 | A1 | §5.1 |
| O55 | UI | not a read |
| O56 | `/api/profiles`; `themes/profile-theme` | §4.1 has no colour. Real source §4.7 `profile-color.ts`. Cited path does not exist |
| O57 | A1, run events | §5.1, §4.6 |
| O58 | POST kanban `/tasks` (triage) | §8. Triage column §4.2 workflow. Verdict in source-verification |
| O59 | A3 + kanban + cron | §6, §4.2, §4.3 |
| O60 | `current_step_key`, workflow template, `updated_at` | §4.2. Step count failed (source-verification). Do not invent n/m |
| O61 | task_events | §4.2 |
| O62 | kanban blocked; `store/notifications` | §4.2, §4.7 |
| O63 | A1, kanban | §5.1, §4.2 |
| O64 | kanban logs, run SSE, A6, cron; Desktop LogTail | §4.2, §4.6, §4.3. A6 is not this slice. LogTail component not opened. Interactive terminal not verified |
| O65 | `/api/analytics/usage` | §4.3. Statusbar control is not a read |
| O66 | run/session mapping (A2) | §5.2. Gateway `session_id` verified §4.6. Kanban join failed (source-verification) |
| O67 | kanban id format | §4.2 `t_` + 8 hex. `TASK-NNN` is the display cut |
| O68 | Desktop chat timeline | not a new read |
| O69 | existing composer | not a new read |
| O70 | task_events, timeline | §4.2, §4.3 |
| O71 | reassign events, task_links, `store/subagents` | §4.2, §4.7 |
| O72 | A3 | §6 |
| O73 | session tool args; `/api/git/file-diff` | §4.3 timeline, §4.5 |
| O74 | task_runs | §4.2 |
| O75 | Cut, security §7 | not a read |
| O76 | `/api/profiles/{n}` | §4.1 list field |
| O77 | run events, session stream | §4.6, §4.7 |
| O78 | cron `next_run_at` | §4.3 |
| O79 | UI | not a read |
| O80 | UI | not a read |
| O81 | A1 | §5.1. One query key. Do not derive a second presence |
| O82 | `task_runs.task_id` | §4.2 kanban run |
| O83 | Cut | not a read |
| O90 | `store/notifications`; A3 | §4.7, §6 |
| G1 | no source | not a read |
| G2 | `/api/model/options` + policy | §4.1. Policy is not a GET |
| G3 | existing chat | not a new read |
| G4 | `/api/cron/blueprints` | §4.3 |
| G5 | `/api/analytics/usage`; `store/free-tier*` | §4.3, §4.7. Null until `free_tier.status` returns. No quota route |
| G6 | capabilities view, messaging view, `/api/mcp/catalog`, `/api/messaging/platforms` | catalog and platforms §4.4. Desktop views are not new reads |
| G7 | onboarding, `/api/mcp/servers/{n}/auth`, PUT enabled | onboarding §4.4 (telegram and whatsapp only). Server list §4.4. Auth and PUT are writes, not opened as reads |
| G8 | Cut | not a read |
| G9 | Cut | not a read |
| G10 | `/api/skills/hub/official`, hub install | official list §4.4. Install is a write. Bundles are not that route |
| G11 | `/api/skills` | §4.4 |
| G12 | POST `/api/skills`, `/api/skills/content` | content §4.4. POST is a write, not opened |
| G13 | sidebar profile groups | not a read |
| G14 | palette | not a backend read |
| G15 | see G6 | §4.4 |
| G16 | `app/command-center` | not a new read. Desktop view, not opened |
| G17 | local pref | §4.7 |
| G18 | `src/themes` | not a backend read. Skins key in §4.7 |
| G19 | Cut | not a read |
| G20 | `/api/profiles/{n}/export` | not inventoried: write. Handler not opened this slice |
| G21 | `POST /v1/runs` + `/events` | §8 write, §4.6 stream |
| G22 | run events / A2 | §4.6, §5.2 |
| G23 | `/v1/runs/{id}/events` | §4.6 |
| G24 | `store/subagents` | §4.7. Not A4 |
| G25 | `/v1/runs/{id}/stop`, `/steer` | §8 writes |
| G26 | UI | not a read |
| G27 | `/api/cron/jobs` | §4.3 |
| G28 | `/api/webhooks` | §4.3. No filter field (source-verification) |
| G29 | `/api/messaging/platforms` | §4.4 |
| G30 | `/api/memory`, providers config | §4.4 |
| G31 | `/api/profiles/{n}`, description | §4.1 |
| G32 | A5 manifest | §8 snapshot absent. Proposed, not a read today |
| G33 | toolsets, `/api/mcp/servers` | §4.4 |
| G34 | A4 | §7 |
| G35 | `/api/skills` | §4.4 |
| G36 | `/api/profiles/{n}/model` | read side is `/api/model/options` §4.1 plus config. PUT is a Canvas write (§8), not opened line-by-line |
| G37 | UI | not a read |
| G38 | UI | not a read |
| G39 | UI | not a read |
| G40 | A5 manifest | proposed. Not a read today |
| G41 | run events | §4.6 |
| G42 | per-node endpoints | the node reads in §4.1 and §4.4 |
| G43 | UI | not a read |
| G44 | `/v1/runs/{id}/events` | §4.6 |
| G45 | run events, A2 | §4.6, §5.2. Null tokens stay null |
| G46 | `/v1/runs/{id}/steer` | §8 write |
| G47 | UI | not a read |
| G48 | UI | not a read |
| G49 | A5, `/api/config/schema` | schema §4.1. A5 proposed |
| G50 | A5 | proposed |
| G51 | `/api/messaging/*/onboarding` | §4.4 telegram and whatsapp only. Other platforms do not match the glob |
| G52 | UI | not a read |
| G53 | UI | not a read |
| G54 | per-node endpoints | §4 |
| G55 | UI | not a read |
| G56 | UI | not a read |
| G57 | UI | not a read |
| G58 | Desktop connection/profile atoms | not a REST read. Scope axis §3 |
| G59 | UI | not a read |
| G60 | A1 | §5.1 |
| G61 | `/api/cron/blueprints`; kanban workflow templates | §4.3. Template half failed (source-verification) |
| G62 | `/api/mcp/catalog`, platforms | §4.4 |
| G63 | capabilities connectors, messaging | Desktop views, not new reads. Data reads §4.4 |
| G64 | no featured flag | §4.4 catalog. Cut stands. No flag in the entry schema |
| G65 | asset | not a read |
| G66 | `/api/profiles`, projects | §4.1, §4.6 `projects.list` |
| G67 | `/api/cron/blueprints` | §4.3 |
| G68 | `/api/skills` category | §4.4. Path category, not a fixed enum |
| G69 | per-profile aggregate | not exposed as its own route. Closest read is `GET /api/skills?profile=` §4.4. Do not invent a cross-profile count |
| G70 | `/api/skills` author, updated | §4.4. Both absent (source-verification) |
| G71 | UI DataTable | not a read |
| G72 | `/api/skills/hub/` | official list §4.4. Install counts `not exposed` on that payload. Bundles are not this route |
| G73 | org cut; profile settings | profile read §4.1. Org not a read |
| G74 | command-center `updateHermes` | not a new read. Desktop view, not opened |
| G75 | `app/routes.ts` | not a read. Proposed `/ops/...` paths are not handlers |
| G76 | `src/themes` | not a backend read |
| G77 | Cut | not a read |
| G80 | `/api/skills` description | §4.4 |
| G81 | `/api/skills` | §4.4 |
| G82 | `/api/skills/hub` bundles | not exposed on `GET /api/skills/hub/official` (no bundle object). G82 is not this card's verify row. Do not invent bundles |
| G83 | `/api/mcp/servers`, platforms | §4.4 |
| G84 | provider/auth status | §4.4 `GET /api/providers/oauth`. Drop `token_preview` |
| G85 | A3 | §6 |
| G86 | A5 manifest | proposed. Not a read today |
| G87 | Cut. `/v1/runs` has no time-window | §4.6 GET has no window param. Confirmed by the handler signature |
| R1 | kanban + cron `next_run_at` | §4.2, §4.3. No due-date field |
| R2 | A3, `kanban_notify_subs` | §6, §4.2 R2 entry. Table verified. Ops list of rows `not exposed` |
| R3 | kanban `created_by` | field on the task in §4.2. No dedicated "mine" route |
| R4 | `projects.db`; Desktop projects | §4.6 `projects.list` / `projects.get`, §4.1 tree. Favourites local |
| R5 | kanban aggregate | not a named path in SPEC. Nearby `GET /api/plugins/kanban/stats` (`plugin_api.py` `get_stats`) was not the cited string and is not verified here as R5. Do not invent counts |
| R6 | kanban PATCH | §8 write. Columns §4.2 workflow |
| R7 | kanban | §4.2 board. List is a client view of that payload |
| R8 | kanban | §4.2 |
| R9 | cron `next_run_at`, executions.db, `tasks.completed_at` | cron §4.3. `completed_at` is a task field §4.2. `executions.db` is named as cron storage in §4.3 and has no separate Ops read |
| R10 | task_runs | §4.2 |
| R11 | kanban attachments | §4.2 |
| R12 | kanban `/tasks/{id}` | §4.2 |
| R13 | kanban fields, `/estimate` | fields §4.2. `/estimate` is a write §8 |
| R14 | Cut, schema lacks fields | not a read |
| R15 | task_links, `/links` | embedded §4.2. No GET `/links` |
| R16 | task_links | embedded §4.2 |
| R17 | PATCH body | §8 write |
| R18 | comments, task_events | embedded in `GET /tasks/{id}` §4.2. No GET `/comments` |
| R19 | PATCH status | §8 write. Pin is §4.7 local |
| R20 | kanban; delete omitted | writes §8. Delete not offered |
| R21 | `/tasks/bulk` | §8 write |
| R22 | palette | not a backend read |
| R23 | Desktop hotkeys | not a read. Not this card's verify row |
| R24 | kanban + `/api/sessions/search` | board §4.2. Search §4.3. No kanban search route was cited by path; task search is not exposed as its own GET |
| R25 | `lane_by_profile`, tenant | `lane_by_profile` is a boolean on §4.2 config, not a lane array. Tenant is a task field |
| R26 | task_events | §4.2 |
| R27 | local prefs | §4.7 |
| R28 | Cut | not a read |
| R29 | Cut | not a read |
| R30 | UI | not a read |
| R31 | UI tokens | not a read |
| R32 | UI | not a read |
| R33 | Cut | not a read |
| R34 | kanban workflow templates | failed. `GET /workflow` is columns §4.2. Source-verification |
| R35 | local pref | §4.7 |
| R36 | `approval.received`/`cancelled`, task_events | §4.6. SPEC names the ACK as history. That is the discrepancy. No last-50 read exists. Do not fill it from ACKs |
| R37 | local pref | §4.7. Not available on approvals |
| R38 | `status=review`, `/api/git/review/diff` | §4.2, §4.5 |
| R39 | kanban | writes §8. Legal transitions are `GET /workflow` §4.2 |
| R40 | UI | not a read |
| R41 | UI | not a read |
| R42 | kanban PATCH | §8. Order field not verified this card (not a listed verify row). Do not invent a reorder column |
| R43 | `@dnd-kit/core` | not a read |
| R44 | react-query | not a read. Push source is WS §4.2 |
| R45 | local pref | §4.7 |
| R46 | kanban PATCH | §8 write. Undo is client. Never for approval or stop |
| R47 | PATCH title | §8 write |
| R48 | POST `/tasks` | §8 write |
| R49 | `/tasks/bulk` | §8 write |
| R50 | task_runs | §4.2 |
| R51 | UI | not a read |
| R52 | kanban | §4.2. No due dates. Stale heartbeat is a field on the worker/run, not a due date |
| R53 | ResponsiveTabs | not a read |
| R54 | Desktop notify | not a backend read. Trigger events are `approval.pending` §4.6 and blocked tasks §4.2 |
| R55 | local pref | §4.7 |
| R56 | lucide-react | not a read |
| R57 | PATCH status | §8 write. Legality is `GET /workflow` §4.2. Not this card's verify row |
| R58 | task_links | embedded §4.2 |
| R60 | local pref | §4.7 |
| R61 | UI | not a read |
| R62 | kanban aggregate + project | same unnamed aggregate as R5. Project filter is `project_id` on the task §4.2, not a dedicated overview route |
