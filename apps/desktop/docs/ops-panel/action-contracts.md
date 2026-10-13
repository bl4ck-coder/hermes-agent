# Ops panel action contracts (P0-02)

Status: documentation only. Handlers re-checked on `feat/ops-panel` `005b104a506` (non-doc tree identical to `865ba906c1a`). No live production write. No route was added.
Model policy P2 (SPEC section 4.4) is a write-time rule. This slice does not write `ops-policy.yaml` and does not implement A6. It names A6 as the guard those writes must pass through.
Ledger: `source-verification.md`. Coverage: `coverage.md`. SPEC is not edited.

Every planned action cited in SPEC sections 3-5 and 12.8 is an entry below, or an explicit "not an action" / Cut / forbidden row. A citation that is only a read is not re-specified here.

## 1. How to read an entry

Axes, always named:

- Handler: file:line and function, or `absent`.
- Schema: body / query fields, or `none`.
- Auth: which credential. Never a secret value.
- Scope: connection, profile, tenant/board, object id. A missing value is stated.
- Storage: file or table the write changes.
- Event: what a subscriber can observe, or `none`.
- Error: status or RPC code the UI must surface. `inherited` means the shared row in section 2.
- Owner: existing, or a named new endpoint and later phase.
- Status: `verified` (handler in this tree), `proposed` (named, not in this tree), `forbidden` (handler exists, Ops must not call it), `cut` (no endpoint, and none will be invented).

## 2. Shared axes

Dashboard / Desktop-spawned `hermes serve`:

- Auth: loopback session token. Header is the dashboard session header or `Authorization: Bearer <token>` (`_has_valid_session_token`, `hermes_cli/web_server.py:457`). Sensitive plugin enables call `_require_token` (`web_server.py:483`). Kanban WebSocket uses `?token=` / `?ticket=` / `?internal=` (`plugins/kanban/dashboard/plugin_api.py:50`).
- Profile: `?profile=` unless an entry says otherwise. Omitted is the process launch profile, not the focused Ops profile, except where an entry names a different default.
- Board: `?board=` on kanban routes. Omitted is the active board (`plugin_api.py:66`).
- Tenant: `tasks.tenant`. Not HTTP auth.
- Connection: remote connections are read-only for every Canvas write (D11). A remote respond that would write another machine's queue is out of v1.
- Error inherited: 401 missing/invalid session token before routing; 404 unknown profile or object; 400 validation; 409 domain refusal. 401 is not existence proof.

Gateway `:8642`:

- Auth: `Authorization: Bearer <API_SERVER_KEY>`. The key stays in Electron main (SPEC section 7). The renderer never sees it. Missing or wrong key: 401 `gateway_auth_failed`.
- Scope: run control is confined to the starting profile (`gateway/platforms/api_server.py:3637`). Another profile's run id is not found, not leaked.
- Typed IPC only (SPEC section 11.6): run inspect, approve, steer, stop, events. No arbitrary URL from the renderer.

JSON-RPC (`HermesGateway`):

- Profile is a method param. Blank means the launch profile.
- Methods used here: `approval.respond`, `projects.create`, `projects.archive`.

Events inherited for kanban writes: a `task_events` row, and the existing kanban WebSocket `/api/plugins/kanban/events` (not the absent SSE `GET /api/plugins/kanban/events/stream`, adapter A7, owner P1). Gateway control writes emit a run SSE event on `/v1/runs/{id}/events` when the stream is attached.

A5 is not wrapped around any verified write below. `atomic_write_text` on SOUL prevents a torn single-file replace. It is not expected-hash → backup → validate → replace → read-back, and it does not abort when a backup fails. Owner of that transaction: P2, adapter A5, inside the mutation path (SPEC section 11.1). There is no client-side fallback.

## 3. Shapes that existing handlers do not cover

### 3.1 Atomic unblock with note and claim revision — proposed

SPEC section 3 cites `PATCH` status→ready, `POST .../comments`, and `POST .../reclaim` as three checks. SPEC section 11.8 and O74 require one atomic op: status + note + claim revision. Those three routes are not that op.

What exists, and why it is not enough:

- `unblock_task` (`hermes_cli/kanban_db.py:3724`) moves `blocked`/`scheduled` to a parent-gated landing status, clears `current_run_id` and `consecutive_failures`, and appends `unblocked`. It takes no note. It does not compare `claim_lock`. The UPDATE (`:3750-3753`) does not clear `claim_lock`.
- `POST /tasks/{id}/comments` (`plugin_api.py:796`) is a separate transaction. A crash between comment and status leaves a note on a still-blocked task, or a status change with no note.
- `POST /tasks/{id}/reclaim` (`plugin_api.py:1002`) releases a running claim. It is the stale-claim tool, not an unblock. Calling it "the claim revision" would imply a second request.

Named endpoint, owner P1 (before any Needs-you button in P3):

`POST /api/plugins/kanban/tasks/{id}/unblock`

- Schema: `{note: string, expected_claim_lock: string|null, expected_status: "blocked"|"scheduled"}`. `note` required, non-empty after trim.
- Auth: inherited dashboard session token.
- Scope: board query, task id. Connection = this serve. Remote: not offered in v1.
- Storage: one write transaction on `kanban.db`: compare `claim_lock` to `expected_claim_lock` and status to `expected_status`; insert the comment; run the unblock status change; clear claim fields; append `unblocked` with the comment id.
- Event: `unblocked` plus `commented`, same transaction. WebSocket after commit.
- Error: 409 if claim or status does not match (nothing written). 400 if note is empty. 404 if the task is missing.
- Status: proposed. Do not compose the three existing calls in the client and call that atomic.

`whatFor` is never fabricated. If the blocked payload has no reason, the card shows "reason not recorded" (SPEC section 11.8).

### 3.2 One-click routed approvals with dedupe — proposed route, verified settle primitives

D3: one click, no second confirmation, full command and args, idempotent. O8: if the full args do not fit unabridged, the control is `[Review]`, not Approve. "Approve next" focuses and does not approve unseen content (SPEC section 11.11).

Settle primitives (verified):

- JSON-RPC `approval.respond` (`tui_gateway/methods_prompt.py:1204`). Choice defaults to `deny` if omitted (`:1217`). `request_id` selects one queue entry. `all` drains the session queue.
- `POST /v1/runs/{run_id}/approval` (`gateway/platforms/api_server_runs.py:1168`). Body `{choice, request_id?, all?}`. Aliases `approve|approved|allow` map to `once` (`:1165`). Room grants: `once|deny` only, `request_id` required, `all` rejected (`:1184-1197`).
- Both call `resolve_gateway_approval` (`tools/approval.py:139`). Pop and outcome commit are one lock section (`:165-172`). A second call for the same `request_id` finds nothing and returns 0. The HTTP path then answers 409 `approval_not_pending` (`api_server_runs.py:1209-1211`). That is in-process dedupe for one gateway queue. It is not a durable cross-profile ledger, and it does not survive process restart as a responded-id record.
- `approval.received` is an ACK (`methods_prompt.py:1193`, `approval.py:210`). It sets `acknowledged` and leaves the entry queued. It is not settlement and not dedupe.

Routed contract, owner P1, adapter A3. Not implemented. Do not imply the primitives above are the cross-profile route.

`POST /api/approvals/{id}/respond`

- Schema: `{choice: "once"|"deny", expected_status: "pending"}`. No `all`. No `session`/`always` from Ops (D3 is one decision on one exact request).
- Auth: dashboard session token. Gateway key stays in main. This route is the only renderer-facing respond.
- Scope: `id` is the opaque list id (request id, not a title). The server loads origin, profile, session_id, run_id from its own pending row. The client does not pass a profile to act as.
- Storage: the pending row plus the settle primitive for that origin. A responded-id row is written in the same critical section as the pop, so a retry sees `resolved` and does not settle twice.
- Event: `approval.responded` on the run SSE when origin is `gateway_run`. JSON-RPC origin wakes the waiter. No `approval.received` as a stand-in.
- Error: 409 if the id is already resolved, cancelled, or expired (no second side effect). 403 if `exact_request` is null (the UI should have shown Review). 401 inherited.
- Status: proposed.

List shape stays `GET /api/approvals/pending` (proposed, P1). Kanban blocked/review and cron failures are siblings in that list. They do not call `approval.respond`. Their action is A-unblock or a comment, not Approve.

Button disabled on send is a UI rule (SPEC section 3.3). The server dedupe is what makes a double-click safe. The UI disable is not the contract.

### 3.3 Confirmed stop — verified handlers, confirm is not in the handler

D3 and G43: stop asks for confirmation. The handlers do not read a confirm flag. Ops must show the dialog before the call. Do not add a confirm query param and pretend the current route enforces it.

Gateway stop:

- Handler: `api_server_runs.py:1253` `_handle_stop_run`. Route table `:240`.
- Schema: none. Permission `stop` inside `_load_owned_run`.
- Auth: gateway Bearer, main process only.
- Scope: that run, starting profile.
- Storage: in-memory `_run_statuses` / `_stopping_run_ids`. Not `kanban.db`.
- Event: status `stopping`, `last_event=run.stopping`. Hard interrupt on the agent if present.
- Error: 401 auth; 409 `run_not_active` when nothing is live and the run is not already terminal. A terminal run returns the status object and does not interrupt again (`:1260-1261`).
- Status: verified. UI confirm owner: P3. No token cap on this call (D7 is about starting a test run, not about stop).

Kanban terminate (worker stop, different object):

- Handler: `plugin_api.py:979` `terminate_run_endpoint`.
- Schema: `{reason?: string}`.
- Auth / scope: inherited dashboard token, `?board=`, run id.
- Storage: `reclaim_task` on the run's task. Closes the run.
- Event: reclaim events from `reclaim_task`.
- Error: 409 if the run already ended or the task is not reclaimable (`:990-992`).
- Status: verified. Same UI confirm. Do not call this for a gateway `/v1/runs` id. The id spaces differ (integer kanban run vs `run_<hex>`).

### 3.4 Forbidden delete

`DELETE /api/plugins/kanban/tasks/{id}` exists (`plugin_api.py:713` `delete_task`). It hard-deletes the task and relation rows (`kanban_db.py:4003-4007`). SPEC section 5 and R20: delete is not offered in v1. Archive only.

- Status: forbidden. Ops binds no control to this route. No "hidden" overflow item.
- Substitute: `PATCH` status `archived` (section 6).
- Error if a future bug calls it: 404 when missing, 200 `{deleted: true}` when it worked. That 200 is not a success Ops may show.

Also not planned Ops actions, so also not offered (do not imply an adapter covers them by silence):

- `DELETE /api/profiles/{name}` (`profiles.py:977`).
- `DELETE /api/cron/jobs/{job_id}` (`cron.py:734`).
- `DELETE /api/webhooks/{name}` (`ops.py:254`).

### 3.5 D7 test run — verified start, no cap, no confirm

D7: Canvas test runs have no token cap and no confirmation. G21 / G43 cite `POST /v1/runs`.

- Handler: `api_server_runs.py:620` `_handle_runs`. Route table `:236`.
- Schema: JSON `input` (string or message list) required. Optional `model`, `session_id`, `previous_response_id`. Header `Idempotency-Key` optional, 1-255 visible ASCII (`:638-642`). No `max_tokens` field is read in this handler (search of the file: no match).
- Auth: gateway Bearer, main process only.
- Scope: the connection's gateway, the profile that owns the key. Not a kanban task unless the caller already has one.
- Storage: in-memory run status plus the durable idempotency record when a key was reserved. Not a token budget table.
- Event: SSE `/v1/runs/{id}/events` after the run id returns.
- Error: 400 missing input or bad idempotency key; 401 auth; concurrency refusal from `_concurrency_limited_response` (`:686-688`). That gate is admission, not a D7 token cap. Ops must not treat it as a quota dialog and must not add its own cap or confirm.
- Status: verified handler. UI rule, owner P3: no confirm dialog, no token cap, stream tokens and elapsed time. Idempotency-Key may be sent for replay safety. It is not a confirm.

G87's "over the past 7 days" stays cut (SPEC section 12.7). The window, if any, is prompt text. Do not add a time-window parameter to this route.

## 4. Section 3 actions

Office actions not already fully specified in section 3:

### Enable kanban plugin — verified

- Handler: `hermes_cli/web_routers/dashboard_ui.py:257` `post_agent_plugin_enable`.
- Schema: path `name`. No body.
- Auth: `_require_token` (`:252`).
- Scope: plugin name on this serve. `..` and backslash rejected (`:243-248`).
- Storage: plugin enabled flag via `dashboard_set_agent_plugin_enabled`. Not `kanban.db`.
- Event: none on this route. UI refetches plugin list.
- Error: 400 invalid name; 401 no token; fallback "Enable failed."
- Status: verified. Cited by SPEC section 3.2. Disable (`:264`) is not a planned Ops action.

Approve, Deny, Unblock, Steer, Stop: section 3.1-3.3.

Steer, for the inventory:

- Handler: `api_server_runs.py:1219` `_handle_steer_run`.
- Schema: non-empty `input` or `message` or `text`.
- Auth / scope: gateway Bearer, owned run.
- Storage: the live agent steer buffer. Not kanban.
- Event: `run.steered` when accepted.
- Error: 400 empty text (`invalid_steer_input`); 409 `run_not_accepting_steer` or `steer_not_accepted`; 500 `steer_failed`.
- Status: verified. G46: send stays disabled until text is typed. That is UI. No second confirm (not a stop).

## 5. Section 4 Canvas writes

Shared for this section unless an entry overrides: auth inherited dashboard token; remote connection forbidden (D11); A5 not present (section 2); A6 not present, so a disallowed model can be saved today. P2 must refuse that. Ops UI in P5 must not ship the picker without A6.

### PUT /api/profiles/{name}/soul — verified, backup not transactional

- Handler: `profiles.py:1013` `update_profile_soul`. Body `ProfileSoulUpdate.content`.
- Scope: one profile directory. Unknown name: 404 from `_resolve_profile_dir`.
- Storage: `<profile>/SOUL.md` via `atomic_write_text` (`:1024`).
- Event: none.
- Error: 500 on `OSError` (`:1031`).
- Status: verified. A5 owner P2. History/restore is part of A5, not this route.

### PUT /api/profiles/{name}/description — verified

- Handler: `profiles.py:1035`. Body `description`.
- Storage: profile meta, `description_auto: false` (`:1045`).
- Event: none. Error: inherited profile errors. Status: verified. A5 owner P2.

### PUT /api/profiles/{name}/model — verified handler, A6 absent

- Handler: `profiles.py:1049`. Body `provider`, `model`. Both required or 400 (`:1056-1057`).
- Storage: that profile's `config.yaml` `model.provider` / `model.default`. Does not touch the dashboard process profile (`:1051-1052`).
- Event: none. Applies on next session / gateway restart (SPEC section 4.3). The restart call is separate and confirmed.
- Error: 400 missing fields. No P2 refusal in this function.
- Status: verified handler. Guard: proposed A6, owner P2, also on raw YAML, restore, `fallback_providers`, and `auxiliary.*`. Existing violation warns; a new disallowed selection blocks (D13).

### PUT /api/tools/toolsets/{name} — verified

- Handler: `hermes_cli/web_routers/tools.py:281` `toggle_toolset`.
- Schema: `ToolsetToggle` (`web_models.py:496-498`): `{enabled: bool, profile?: string}`. Path `{name}` is the toolset key. No other body fields.
- Scope precedence: `body.profile` wins over query `?profile=` (`tools.py:291`, `scope_profile = body.profile or profile`). Both omitted: the process profile, via `config_write_scope`.
- Auth: inherited dashboard token. Remote connection forbidden (section 5 shared rule).
- Storage: that profile's `config.yaml` only. Config-only toolsets write `<name>.enabled` (`tools.py:296-300`). Others rewrite `platform_toolsets` for `_toolset_configuration_platform(name)` via `_save_platform_tools` (`:302-308`). Not `.env`.
- Event: none. Enable may spawn `hermes tools post-setup` in the background (`:312-336`). A spawn failure is logged and does not fail the toggle (`:337-338`). Response `{ok, name, platform, enabled, post_setup_started}`.
- Error: 400 `Unknown toolset: {name}` (`tools.py:205-210`). Status: verified. A5 owner P2.
- Sibling writes `/model`, `/provider`, `/env` (`tools.py:472`, `:504`, `:590`) are not SPEC section 4.1 citations. Do not bind them as the Tools node save. Model pins on a toolset are governed fields only once A6 exists; until then they are not an Ops write.

### PUT /api/skills/toggle — verified

- Handler: `skills.py:380` `toggle_skill`.
- Schema: `SkillToggle` (`web_models.py:480-483`): `{name: string, enabled: bool, profile?: string}`.
- Scope precedence: `body.profile` wins over query `?profile=` (`skills.py:384`).
- Auth: inherited dashboard token.
- Storage: the disabled-skill set in that profile's `config.yaml` via `save_disabled_skills` (`:386-391`). Not `.env`. Not `SKILL.md`.
- Event: none. Toggle does not clear the skills prompt cache (create and content do). Do not document a cache event on this route.
- Error: inherited scope errors. Status: verified. A5 owner P2.

### POST /api/skills/hub/install — verified one identifier, not a bundle

- Handler: `skills.py:97` `install_skill_hub`.
- Schema: `SkillInstallRequest` (`web_models.py:423-425`): `{identifier: string, profile?: string}`. One identifier. No `identifiers[]`, no pack id.
- Scope precedence: `body.profile` wins over query `?profile=` (`skills.py:101`).
- Auth: inherited dashboard token.
- Storage: no synchronous file write. Spawns `hermes -p <profile> skills install <identifier> --yes` (`_common.py:104-111`). The official catalog is a flat `{skills: [...]}` (`skills.py:123-141`), not starter packs.
- Event: none. Response on spawn: `{ok: true, pid, name}`. HTTP 200 does not mean the skill is on disk yet.
- Error: 400 `identifier is required` when the identifier is empty (`_common.py:114-118`); 500 `Failed to install skill: ...` when the spawn fails (`_common.py:109`).
- Status: verified handler for one skill. This is the Browse install under G72. It does not implement G10 or G82. Looping it from the client and calling that Add all is forbidden. No bundle endpoint is proposed; those rows are Cuts (ledger crosswalk).

### PUT /api/memory/provider and PUT /api/memory/providers/{name}/config — verified, two stores

Neither route has `body.profile`. Scope is query `?profile=` only. A profile field in the JSON is not read. Do not document body-over-query precedence here.

Shared: auth inherited dashboard token; remote forbidden; A5 owner P2. Secrets stay masked on read. The renderer never receives `.env` values.

#### PUT /api/memory/provider

- Handler: `ops.py:507` `set_memory_provider`.
- Schema: `MemoryProviderSelect` (`web_models.py:396-397`): `{provider: string}`. `""` or `"built-in"` disables the external provider.
- Scope: query `?profile=` inside `config_write_scope` (`ops.py:516`).
- Storage: that profile's `config.yaml` `memory.provider` (`:519-522`). This select does not write `.env`.
- Event: none. Response `{ok, active}`.
- Error: 400 unknown or not-ready provider (`web_server_memory.py:376-388`). The check runs inside the target profile scope so a provider that is ready only in the launch profile is not written into the target (`ops.py:512-515`).

#### PUT /api/memory/providers/{name}/config

- Handler: `memory_providers.py:551` `update_memory_provider_config`.
- Schema: `MemoryProviderConfigUpdate` (`web_models.py:33-34`): `{values: object}`. Path `{name}`. Query `surface=declared` selects the declared schema. Omitted `surface` is the native provider. No body profile.
- Name charset `^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$`, else 404 (`memory_providers.py:43`, `:46-47`, `:497-505`).

Native path (`surface` omitted), `:566-574` calling `:473-492` and `:456-470`:

- Non-secret fields: if the loaded provider overrides `MemoryProvider.save_config`, that method writes under the hermes home and returns (`:456-463`). Otherwise merge into `config.yaml` `memory.<name>` and `save_config` (`:465-470`).
- Secret fields that carry `_env_key`: `save_env_value` (`:483-492`). `.env` is authoritative for those secrets. A blank secret on this path does not clear the env key; only a non-empty submission is saved.
- After the native write succeeds, `config.yaml` `memory.provider` is set to `name` (`:571-574`).

Declared path (`surface=declared`), `:559-565` calling `:308-316`:

- No declared schema: 404.
- Submitted values are stringified (`:563`).
- Non-secret fields go to the declared store: flat JSON mode `0600` (`_write_provider_flat`, `:174-178`), or the Honcho host block (`_write_provider_honcho`, `:181`) when `provider.storage == STORAGE_HONCHO_HOST_BLOCK`. Not "always config.yaml".
- Declared secrets with `env_key` go to `.env` via `save_env_value` (`:134-143`).
- If `memory.provider` was not this name, it is set in `config.yaml` (`:314-316`).

- Event: none. Declared response `{ok: true}`. Native response `{ok: true, active: name}`.
- Error: 404 unknown name or unknown declared schema; 400 on `ValueError` from coercion (`:51-62`); 500 on other failures. Do not say storage is only the profile config memory section.
- `POST /api/memory/reset` (`ops.py:528`) is not a SPEC section 4 citation. Not offered.

### PUT /api/messaging/platforms/{id} — verified

- Handler: `messaging.py:883` `update_messaging_platform`.
- Schema: `MessagingPlatformUpdate` (`web_models.py:61-66`): `{enabled?: bool, env: {string: string}, clear_env: string[], profile?: string}`. Path `{platform_id}`.
- Scope precedence: `body.profile` wins over query `?profile=` (`messaging.py:887`, `target_profile = body.profile or profile`).
- Auth: inherited dashboard token.
- Gate before any write: `enabled: true` runs `_multiplex_port_binding_conflict`. A conflict is 409 and does not touch `.env` or `config.yaml` (`:888-897`).
- Storage: `clear_env` keys call `remove_env_value` (`:922-923`); non-blank `env` values call `save_env_value` (`:924-925`). `.env` is authoritative for platform secrets. `enabled`, when present, is written through `_write_platform_enabled` (`:927-928`). Not config-only.
- A key outside that platform's `env_vars` is 400 (`:899-903`). A redacted credential preview is 400 and is not saved (`:917-918`). An empty env value is skipped, not written (`:915-916`).
- Event: none on the kanban bus. A live multiplexer serving this named profile may rebuild adapters immediately. Response `{ok: true, platform, hot_served}` (`:939-942`). `hot_served: true` means that profile does not need a gateway restart for this write. `false` does not mean the write failed. Do not document the write as next-session-only.
- Error: 400 bad key, bad value, or redacted preview; 409 multiplex conflict before write; 500 via `http_failure` (`:930`). Status: verified. A5 owner P2. The renderer shows set/unset, never raw `.env` (SPEC section 7).

### G7 Connect / Manage — verified handlers, concrete bodies

Connect is not `PUT /api/messaging/platforms/{id}`.

- WhatsApp start: `POST /api/messaging/whatsapp/onboarding/start` (`messaging.py:581`). Body `WhatsAppOnboardingStart` (`web_models.py:75-78`): `{mode?: string, allowed_users?: string, profile?: string}`. The handler takes no query profile; scope is `body.profile` (`:582-586`). Storage: in-memory onboarding session plus that profile's WhatsApp session dir. Event: none. Error: platform-module 4xx/502. Not a new adapter.
- WhatsApp apply: `POST /api/messaging/whatsapp/onboarding/{pairing_id}/apply` (`messaging.py:624`). Body `WhatsAppOnboardingApply` (`web_models.py:80-83`): `{mode?: string, allowed_users?: string, profile?: string}`. Scope precedence: `body.profile or query profile or the session's record.profile` (`:636`). Storage: `.env` `WHATSAPP_MODE`, `WHATSAPP_DM_POLICY`, `WHATSAPP_ALLOWED_USERS` (only when non-blank), `WHATSAPP_ENABLED`, plus `_write_platform_enabled("whatsapp", true)` (`:639-646`). Event: none. The handler may restart the gateway; response includes `needs_restart`. Error: 409 if the session is not `connected` (`:628-629`); save failures through `_onboarding_save_errors`.
- Telegram start: `POST /api/messaging/telegram/onboarding/start` (`messaging.py:712`). Body `TelegramOnboardingStart` (`web_models.py:68-69`): `{bot_name?: string}`. No profile field and no query profile. Storage: in-memory pairing plus the external pairing service. Event: none. Error: 502 incomplete pairing payload (`:721-722`).
- Telegram apply: `POST /api/messaging/telegram/onboarding/{pairing_id}/apply` (`messaging.py:774`). Body `TelegramOnboardingApply` (`web_models.py:71-73`): `{allowed_user_ids: string[], profile?: string}`. Scope precedence: `body.profile` wins over query `?profile=` (`:790`). Storage: `.env` `TELEGRAM_BOT_TOKEN` and `TELEGRAM_ALLOWED_USERS`, plus `_write_platform_enabled("telegram", true)` (`:794-796`). Event: none. Response includes `needs_restart`. Error: 400 non-numeric or empty allow-list (`:777-781`); 404 unknown pairing (`:697`); 409 not ready (`:788`).
- MCP Connect: `POST /api/mcp/servers/{name}/auth` (`mcp.py:254`). No JSON body. Scope is query `?profile=` only (`:270`, passed into the flow at `:293`). Auth: `_require_token` (`:261`). Storage: starts an OAuth flow; it does not write the token into the renderer. Event: none. Error: 404 unknown server (`:278-279`); 409 plugin-provided server (`:280-281`); 400 stdio or header-auth server (`:283-286`).
- Manage: `PUT /api/mcp/servers/{name}/enabled` (`mcp.py:372`). Body `MCPEnabledToggle` (`web_models.py:355-357`): `{enabled: bool, profile?: string}`. Scope precedence: `body.profile` wins over query (`:377`). Storage: that profile's `config.yaml` `mcp_servers.{name}.enabled`. Takes effect on next session/gateway (`:374`). Event: none. Error: 409 plugin-provided server (`:382-385`); 404 missing server (`:387-388`).

Not a new adapter. Do not imply `PUT /api/messaging/platforms/{id}` covers Connect.

### Schedule writes — verified, ownership in the ledger

- `POST /api/cron/jobs` `cron.py:683`. Body `CronJobCreate` (`web_models.py:310-330`): `schedule` required, `prompt`, `deliver` default `"local"`, skills, model, provider, script, `paused`. No profile field in the body.
- `PUT /api/cron/jobs/{job_id}` `cron.py:714`. Body `{updates: dict}`.
- `POST .../pause` `:719`. `POST .../resume` `:724`. Schema: none beyond path and `?profile=`.
- `POST .../trigger` `:729`. Schema: none. 409 if already claimed (`:642`).
- Auth: inherited dashboard token. Not the public `/api/cron/fire` JWT.
- Scope: storing profile, not `job.origin`. See ledger G27. Create with omitted `?profile=` uses `_cron_default_profile()` (`web_server_cron.py:97-110`), which is the active profile, or `"default"` for `custom`. Instantiate is the exception: omitted profile is the literal `"default"` (`cron.py:878`). Ops always sends `?profile=` equal to the focused profile.
- Storage: that profile's `cron/jobs.json`.
- Event: none on these routes. Provider notify runs after instantiate (`cron.py:898`).
- Error: 400 validation; 404 job or profile; 409 trigger claim race; 422 blueprint fill (`cron.py:888`).
- Status: verified. Delete is not offered (section 3.4). A5 file set for Schedule includes `cron/jobs.json` (SPEC section 4.2), owner P2.
- Blueprint chip write, if a chip creates a job: `POST /api/cron/blueprints/instantiate` (`cron.py:877`). Body `{blueprint, values}`. It pops `origin` (`:892`) and creates in the query profile. Catalog read is scoped to that profile's plugins (`:830-836`). Do not treat the catalog as global and the write as default. Status: verified. Not a kanban template create.

### POST /api/webhooks and PUT /api/webhooks/{name}/enabled — verified

- Handlers: `ops.py:190`, `ops.py:270`.
- Schema: `WebhookCreate` (`web_models.py:376-386`): name, events, prompt, script, skills, deliver, secret optional. No filter (ledger G28). Toggle body `{enabled: bool}` (`:388`).
- Scope: `?profile=`. Storage: that profile's webhook routes. Secret stored, `secret_set` on read, raw secret not re-rendered.
- Event: none. Error: inherited. Status: verified. A5 owner P2. Delete not offered.

### PUT /api/config/raw — verified handler, A6 absent

- Handler: `hermes_cli/web_routers/analytics.py:53` `update_config_raw`.
- Schema: `RawConfigUpdate` (`web_models.py:523-525`): `{yaml_text: string, profile?: string}`. Not a bare YAML body. The YAML text is the `yaml_text` field.
- Scope precedence: `body.profile` wins over query `?profile=` (`analytics.py:59`, `body.profile or profile`).
- Auth: inherited dashboard token.
- Storage: full-document replace of that profile's `config.yaml` via `save_config(parsed, merge_existing=False)` (`:60-64`). Omitted keys are deleted. This is not the merge used by `PUT /api/config`.
- There is no config-schema validator on this route. `yaml.safe_load` must yield a mapping, or 400 `YAML must be a mapping` (`:56-58`). `yaml.YAMLError` is 400 `Invalid YAML` (`:72-73`). Unreadable-file refusal belongs to `PUT /api/config`, not here.
- Event: not none when the replace changes `approvals.mode` on this process's own profile. That case calls `_broadcast_gateway_session_info()` (`:66-67`). Other profiles do not get that broadcast (`_is_other_profile`). No kanban event.
- Error: 400 parse or non-mapping. No P2 refusal today.
- Status: verified handler. A6 owner P2, including this route. A5 owner P2. Conflict dialog (Keep mine / Take theirs / Diff) needs the expected-hash A5 does not have yet. Do not fake it with mtime alone in the client.

### POST /api/model/set — verified handler, A6 absent (O40)

SPEC section 12.8 O40 cites `POST /api/model/set`. That is not `PUT /api/profiles/{name}/model`.

- Handler: `hermes_cli/web_routers/models.py:376` `set_model_assignment`.
- Schema: `ModelAssignment` (`web_models.py:105-123`): `{scope: string, provider: string, model: string, task?: string, reasoning_effort?: string|null, base_url?: string, api_key?: string, confirm_expensive_model?: bool, profile?: string}`. `scope` is `main` or `auxiliary`. `task` `""` means every auxiliary slot. `task` `"__reset__"` resets every auxiliary slot to `provider="auto"`. Omitted `reasoning_effort` leaves the override; explicit null clears it (`model_fields_set`, `models.py:412`).
- Scope precedence: `body.profile` wins over query `?profile=` (`models.py:419`).
- Auth: inherited dashboard token.
- Storage: that profile's `config.yaml`. `scope=main` writes `model.provider` and `model.default` (and `base_url` / `api_key` when sent). `scope=auxiliary` writes `auxiliary.<task>.*`. Applies to new sessions only. A running chat PTY hot-swaps through the `/model` slash command, not this route (`:378-380`).
- Event: none on this route.
- Error: 400 if `scope` is not `main` or `auxiliary` (`:385-386`). 503 `Restart required: ...` on dashboard code skew, before the write (`:392-395`). Expensive-model warning with `confirm_expensive_model` false returns 200 `{ok: false, confirm_required: true, confirm_message}` and does not enter the profile scope (`:400-410`). 500 `Failed to save model assignment` via `http_failure` (`:388`).
- Status: verified handler. No P2 refusal in this function. A6 owner P2. Until A6 exists, the Ops model chip stays read-only (O50). Do not send a disallowed pair because the handler will store it.

### PUT /api/config — verified (O41)

SPEC O41 writes `approvals.mode` through `/api/config`, not through raw YAML. Raw replace can also change the key; it is a different contract (above).

- Handler: `hermes_cli/web_routers/config_env.py:117` `update_config`.
- Schema: `ConfigUpdate` (`web_models.py:11-13`): `{config: object, profile?: string}`. The autonomy control sends `config.approvals.mode` as one of `manual`, `smart`, `off` (`web_server_config.py:143`). Orbit labels Ask first / Safe / Full are not wire values. Do not send them.
- Scope precedence: `body.profile` wins over query `?profile=` (`config_env.py:123`).
- Auth: inherited dashboard token.
- Storage: deep-merge of `config` over the existing `config.yaml` (`:131-146`), under `_CONFIG_MUTATION_LOCK`. Not a full replace. An unreadable or non-mapping file is refused before the merge (`require_readable_config_before_write`, `config.py:1965-1996`, raises `RuntimeError`).
- Event: `_broadcast_gateway_session_info()` only when `approvals.mode` changed and the target is this process's own profile (`:140`, `:151-152`). No kanban event. A save of another profile does not refresh this process's sessions.
- Error: the route's `http_failure` maps failures, including the unreadable-file `RuntimeError`, to 500 `Internal server error` (`:155-156`). This route does not return the raw-YAML 400. There is no second confirm.
- Status: verified. P2 does not govern `approvals.mode`. A5 owner P2. Not a Cut.

### POST /api/gateway/restart — verified, confirm required

- Handler: `actions.py:160` `restart_gateway`. Query `profile` optional.
- Schema: none.
- Auth: inherited dashboard token.
- Scope: that profile's gateway process.
- Storage: none in the request. Spawns `hermes gateway restart`.
- Event: none. UI polls status.
- Error: 500 "Failed to restart gateway".
- Status: verified. SPEC section 4.3: behind confirmation. Same rule as stop: the handler has no confirm field. Owner of the dialog: P5. Not a D7 exception.

### Sub-agents — no write

A4 is read-only in v1 (SPEC section 4.1, section 11.9). No save endpoint. Status: not an action.

### A5 history restore — proposed

`POST /api/profiles/{name}/restore` is not in this tree. `POST /api/profiles/{name}/snapshot` is also absent. SPEC section 11.1 prefers the transaction inside the mutation, not a snapshot call followed by PUT. Owner P2. Restore itself backs up first (SPEC section 4.2) and passes A6. Retention: keep all (D10). Status: proposed. Do not restore by copying a file from the renderer.

## 6. Section 5 Board writes

Mount prefix: `/api/plugins/kanban`. Handlers in `plugins/kanban/dashboard/plugin_api.py`.

### PATCH /tasks/{id} — verified

- Handler: `plugin_api.py:686` `update_task`.
- Schema: `UpdateTaskBody` (`:527-545`): `status`, `assignee`, `priority`, `title`, `body`, `result`, `block_reason`, `summary`, `metadata`, model/reasoning overrides. No `note`. No `expected_claim_lock`. No `expected_status`. No position. No task revision.
- Auth / scope: inherited. Board query. Task id.
- Storage: `kanban.db` `tasks`, plus `task_events`.
- Event: `status`, `edited`, `reprioritized`, `archived`, or the verb event (`unblocked`, `review_requested`, ...). Review → todo lands in `ready` (ledger R57).
- Error: 400 `running` or unknown status (`:570`, `:603-607`). 409 refused transition, with parent names when ready/done/review is blocked (`:645-649`). Claim conflict snaps the card back (SPEC section 5).
- Status: verified. Illegal drag targets (`scheduled`, `running`, `review` have `drag_target: false`, `kanban_workflow.py:118-122`) stay disabled in the UI even when a verb could accept them. Into `running` is always disabled.
- Unarchive: status `triage` | `todo` | `ready` from `archived` only. See ledger R57.
- This PATCH is not A-unblock and not R46 Undo. It has no `expected_status`, so a reverse status or archive written here is not Undo. See section 6b.

### POST /tasks/{id}/reassign — verified

- Handler: `plugin_api.py:1033`. Body `{profile?, reclaim_first?, reason?}`.
- Storage: `tasks.assignee`. Optional reclaim first.
- Event: reassign event from `reassign_task`.
- Error: 409 if unknown, or still running without `reclaim_first` (`:1041-1043`).
- Status: verified. R39 assignee picker uses this, not a status PATCH, when the only change is assignee. This route is not R46 Undo. It has no `expected_status` and no event-id compare. See section 6b.

### POST /tasks — verified

- Handler: `plugin_api.py:429`. Body `CreateTaskBody` (`:408-426`): title required, assignee, tenant, priority, parents, `triage`, idempotency_key, skills, project_id, goal fields.
- Storage: new `tasks` row, id `t_` + 8 hex.
- Event: create event. Response may include `warning` if dispatcher is down and the task is ready+assigned (`:442-448`). That warning is not an error.
- Error: 400 value errors. Status: verified. R48: the column "+" is only on todo and ready. Other columns do not post.

### POST /tasks/bulk — verified

- Handler: `plugin_api.py:852`. Body `BulkTaskBody` (`:548-563`): `ids` required, optional status, assignee, priority, `archive`, `reclaim_first`.
- Storage: per-id patch. One failure does not abort siblings (`:854-855`).
- Event: per-id verb events.
- Error: 400 if `ids` empty. Per-id `{ok: false, error}` including "archive refused" and transition refused.
- Status: verified. R21 bulk-archive uses `archive: true`, not delete. R49 bulk reassign / move to ready uses the same route. Partial success must be shown, not rolled into one toast.

### POST /tasks/{id}/estimate and POST /estimate — verified

- Handlers: `plugin_api.py:1071` and `:1065`.
- Schema: task id, or `{title, body?}` before create.
- Storage: none required for the guess. The response is `{ok, est_tokens, complexity, rationale, model}` or `{ok: false, reason}`.
- Event: none. Error: inline `ok: false`, not a 500 for a model failure (`:1085`).
- Status: verified. Not a dollar cost. Not a D7 cap.

### POST /tasks/{id}/comments — verified, not the unblock note by itself

- Handler: `plugin_api.py:796`. Body `{body, author?}`. 400 if blank (`:798`).
- Storage: `task_comments`. Event: comment insert. Status: verified. O29 Discuss/Comment uses this. Unblock does not (section 3.1).

### Links — verified writes, no GET

- `POST /links` (`plugin_api.py:811`) body `{parent_id, child_id}`. `DELETE /links` (`:818`) query parent_id, child_id.
- Storage: `task_links`. Event: link change. Error: 400 value error. Status: verified. Read is embedded in `GET /tasks/{id}`. Not a delete-task.

### Keyboard move

SPEC section 11.10: keyboard moves are an accessible alternative to drag. They call the same PATCH. No second endpoint. Owner of the keys: P0.5 keymap, after R23's dynamic signature. This slice does not bind them.

## 6b. Projects and Undo (section 12.8 writes the board section does not cover)

### projects.create / projects.archive — verified RPC (R4, R22)

SPEC R4 is list / create / archive / favourites. SPEC R22's "Create project" is the same create. There is no REST `/api/projects`. Desktop already speaks JSON-RPC. Do not invent a REST twin.

- Handlers: `tui_gateway/methods_projects.py:91` `projects.create`, `:104` `projects.archive`. List is `:81` `projects.list` (read). Registry wrapper `_projects_method` (`:27-43`) is profile-scoped.
- Schema, create: `ProjectsCreateParams` (`tui_gateway/contracts/projects_pets.py:73-84`): `{name: string, folders?: string[], slug?: string, primary_path?: string, description?: string, icon?: string, color?: string, board_slug?: string, use?: bool, profile?: string}`. `use: true` also calls `set_active`.
- Schema, archive: `ProjectsArchiveParams` (`:125-126`): `{id: string, restore?: bool, profile?: string}`. `restore: true` calls `restore_project`; otherwise `archive_project` (`methods_projects.py:107`).
- Auth: the Desktop gateway session that already carries `projects.*`. Not the dashboard REST token. Profile is the RPC `profile` param the desktop wrapper adds (`projects_pets.py:4-6`).
- Scope: that profile's `projects.db` via `pdb.connect_closing()` (`methods_projects.py:36`).
- Storage: `projects` and `project_folders` in that db (`hermes_cli/projects_db.py`). `archived` is a column. Favourites are not. Favourites stay a local pref, storage `none` on the server, event `none`.
- Event: `record_feature_used("projects")` on create (`methods_projects.py:98-99`). No kanban event.
- Error: JSON-RPC, not HTTP. `5062` no such project, `5063` invalid argument (duplicate primary path is the create refusal named on the contract, `projects_pets.py:88`), `5061` any other failure (`methods_projects.py:13`, `:38-43`).
- Status: verified handlers. Live RPC was not called. `projects.delete` exists (`:111`) and is not an R4 action. Do not bind it. Not a Cut of R4.

### R46 Undo — landed-status classification; no Undo through bare PATCH

SPEC R46: Undo for move, archive, and reassign within 8 s. Never for approval or stop. Do not cut R46. Do not implement the endpoint in this slice.

Enablement (r3 decision; no Planner round). `PATCH /tasks/{id}` has no `expected_status` (`plugin_api.py:527-528`, `:686`). Therefore no status Undo, no archive Undo, and no reassign Undo is enabled through that PATCH, not even for a pair in Landed-legal. `POST /tasks/{id}/reassign` (`plugin_api.py:1033`) is not an Undo route either: it has no landed-status compare. R46 Undo is enabled only through the named P1 endpoint `POST /api/plugins/kanban/tasks/{id}/undo`, which does not exist. Until that route exists, the 8 s Undo control is not rendered. A click does not call PATCH and does not call reassign. This is a named gap, owner P1, not a Cut, and not an existing adapter.

The control, when P1 ships it, never restores a cancelled run or claim and never re-enters `running`. `*→running` is not a manual destination (`plugin_api.py:603-604` returns 400). Approval and stop have no reverse route. The toast does not offer Undo for them. O29 and O74 are not this control: unblock stays A-unblock, and a reverse PATCH is not a fallback for either row. G27 ownership is unchanged.

Probe paths this contract forbids as Undo. The server still accepts the PATCH on a temporary db (`evidence/P0-02-r2/undo_probe.json`). Acceptance is not enablement. Client-side disable after a received event is not a compare-and-swap and is not the contract.

- `review_to_todo`: a board move `review` → `todo` lands `ready`. The reverse PATCH `ready` → `review` is not an enabled Undo.
- `unobserved_event_race`: `ready` → `todo`, then another actor to `scheduled`, then a stale PATCH back to `ready`, is not an enabled Undo. The stale write overwrites an unobserved change. Do not send it.

Classification (parentless measured matrix, `tests/plugins/test_kanban_workflow_matrix.py:24-26`). A listed pair is the status the card holds after an accepted manual move, not the status the client requested. `review` → `todo` is requested and is not a landed pair: `reopen_review_task` ignores the target and lands `ready` when parents are satisfied (`kanban_workflow.py:132-133`, `kanban_db.py:3779`, `plugin_api.py:580-581`). It is in neither list. Open parents can land `todo` (`kanban_db.py:3718-3721`). That conditional landing is not the measured pair and is not added to either list. The future endpoint compares `expected_status` to the status it observed.

Landed-legal means `can_move(landed, previous)` is true (`kanban_workflow.py:69-79`). Landed-illegal means the forward landed and the reverse is not `can_move`. The two lists are disjoint and exhaustive of the 43 parentless landed forwards, including archive forwards (destination `archived` is always allowed) and unarchive forwards (`archived` → `triage` | `todo` | `ready`). Neither list is a PATCH allow-list.

#### Landed-legal

- triage→todo
- triage→ready
- triage→archived
- todo→triage
- todo→scheduled
- todo→ready
- todo→archived
- scheduled→todo
- scheduled→ready
- ready→triage
- ready→todo
- ready→scheduled
- ready→blocked
- ready→review
- ready→done
- ready→archived
- blocked→ready
- review→ready
- done→ready
- archived→triage
- archived→todo
- archived→ready

#### Landed-illegal

- scheduled→triage
- scheduled→archived
- running→triage
- running→todo
- running→scheduled
- running→ready
- running→blocked
- running→review
- running→done
- running→archived
- blocked→triage
- blocked→todo
- blocked→scheduled
- blocked→done
- blocked→archived
- review→triage
- review→done
- review→archived
- done→triage
- done→todo
- done→archived

#### Not a landed pair

- review→todo is requested and lands ready on the parentless matrix. Not in Landed-legal. Not in Landed-illegal.

Future endpoint, owner P1, absent: `POST /api/plugins/kanban/tasks/{id}/undo`. Body `{kind: "move"|"archive"|"reassign", expected_status, expected_revision, expected_claim, previous_status?, previous_assignee?}`. `expected_revision` is the task revision or the last event id the client observed. One transaction compares `expected_status` to the landed status, the revision or last event id, and the claim. Mismatch: 409, nothing written. It does not restore a cancelled run or claim. It does not write `running`. Until the route exists, render no 8 s control.

## 7. Section 12.8 actions not already named

| ID | Action | Contract |
|---|---|---|
| O3 | Dispatch creates a task | `POST /tasks` section 6. Optional `POST /tasks/{id}/estimate`. No canned router. |
| O8 | Toast Approve | section 3.2. Truncated preview is `[Review]`, not Approve. |
| O14 | New profile | `POST /api/profiles` `profiles.py:810`. Body `ProfileCreate` name, optional `clone_from` (`web_models.py:434`). Auth inherited. Storage: new profile dir. Event: none. Error: 400. `FileExistsError` and `ValueError` map to 400 via `_profile_errors` (`profiles.py:824-825`, `:175-188`), not 409. Status: verified. A5 does not apply to an empty create. Delete profile is forbidden (section 3.4). |
| O15 | New task | `POST /tasks` section 6. |
| O16 | Run now | `POST /api/cron/jobs/{id}/trigger` section 5. Template half is a Cut (ledger). |
| O29 | Steer/Stop, Approve, Comment, Unblock | sections 3 and 4 steer, 6 comment. Unblock is A-unblock, not the three-call composition, and not an R46 reverse PATCH. |
| O40 | Default model menu | `POST /api/model/set` section 5. Not the profile-model PUT. A6 absent; chip stays read-only until A6. |
| O41 | Agent autonomy | `PUT /api/config` section 5. Wire values `manual` / `smart` / `off`. Not the Orbit labels. Not raw YAML. |
| O50 | Model chip write | `PUT .../model` section 5, through A5/A6 when those exist. Until A6, the chip menu is read-only. Owner of the write UI: P5. The default-model menu is O40, not this row. |
| O62 | Blocked toast | `[Open]` only. Unblock needs a note, so the toast does not call A-unblock. Status: UI rule, no extra endpoint. |
| O72 | Inline Approve/Deny/Comment | section 3.2 and `POST .../comments`. One click. |
| O74 | Unblock / Retry ready | A-unblock. Retry-ready is the same op when expected_status is `blocked` or `scheduled`. Not a bare PATCH. Not R46 Undo. |
| G7 | Connect / Manage | section 5 G7. Concrete onboarding and MCP bodies. Not implied by the platform PUT. |
| G10 | Starter packs + Add all | Cut. Same missing bundle resource as G82. Ledger crosswalk, outside the 20-id set. No bundle endpoint is proposed. Single-skill install is G72 Browse, not this row. |
| G72 | Starter-pack metadata + Browse library | Adapt, partial cut of pack metadata. Browse stays: `GET /api/skills/hub/official` and `EmbeddedHubPicker` (`apps/desktop/src/app/capabilities/skills/embedded-hub-picker.tsx`). Install is section 5 hub/install, one identifier. Do not render "8 skills" or "2.4k installs": the official payload has no install count (`skills.py:77-81`). |
| G12 | Create / open skill | Handler: `POST /api/skills` `create_skill` (`hermes_cli/web_routers/skills.py:418-430`) and `PUT /api/skills/content` `update_skill_content` (`:433-444`). Schema: create body `SkillCreate` `{name, content, category?, profile?}` (`web_models.py:485-489`); content body `SkillContentUpdate` `{name, content, profile?}` (`web_models.py:491-494`). Auth: inherited dashboard session token; 401 before routing (`web_server.py:719`) and, when the gate is on, `dashboard_auth/middleware.py:84-86`. Scope / profile precedence: `body.profile` wins over query `?profile=` (`skills.py:426`, `:438`; `scoped_to_thread` `web_routers/_common.py:40-46`). Omitted is the launch profile (section 2), not the focused Ops profile. A named selector resolves through `_profile_scope` (`web_server_profiles.py:243-268`). Storage: that profile's `SKILL.md`. Default home is `get_hermes_home()/skills`; a named profile retargets `SKILLS_DIR` to `profile_dir/skills` (`web_server_profiles.py:267-268`, `skill_manager_tool.py:73-81`). Create writes `<base>/[category/]<name>/SKILL.md` (`skill_manager_tool.py:200-208`, `:476`); `skills.create_dir` may replace the base (`:204-205`). Edit rewrites the existing skill's `SKILL.md` (`skill_manager_tool.py:494-500`). Event: none (`_clear_skills_prompt_cache` is not a subscriber event). Errors: POST 400 when `success` is false (`skills.py:427-428`); PUT 404 when the error contains "not found" (`skills.py:441`, text `skill_manager_tool.py:337`), else 400 (`skills.py:441-442`); named profile 400 invalid name (`web_server_profiles.py:195-196`) and 404 profile missing (`:197-198`); 401 inherited. No 409 on these two writes. Status: verified. A5 owner P2. Not hub install. |
| G20 | Save / Export | Per-node saves are section 5. Handler: `POST /api/profiles/{name}/export` `export_profile_endpoint` (`hermes_cli/web_routers/profiles.py:1095-1110`). Schema: body `ProfileExport` `{extra_files, output}` (`web_models.py:456-458`); `extra_files` defaults `{}`, `output` defaults `""`. Auth: inherited dashboard session token; 401 (`web_server.py:719`; gated `dashboard_auth/middleware.py:84-86`). Scope / profile precedence: path `{name}` is the only selector. `ProfileExport` has no profile field. The handler takes no `?profile=` argument, so a query profile does not win and is ignored. Path resolution: `export_profile` calls `_existing_profile_dir` (`hermes_cli/profiles.py:421-427`) then `get_profile_dir` (`:430-434`); `default` is the Hermes home, a named profile is `profiles/<canon>`. Empty `output` uses `get_profile_export_path` (`web_routers/profiles.py:1098-1101`, `hermes_cli/profiles.py:2199-2218`): a `<canon>-<stamp>.tar.gz` under `_profile_export_directory`, default `<HERMES_HOME>/profile-exports` (`:2171-2174`), else `~/.hermes-profile-exports` or the OS temp `hermes-profile-exports` (`:2183-2188`). An explicit `output` is that archive path. Source profile is not mutated: `copytree` into a temp dir, extra files and redaction apply to the staged copy only (`hermes_cli/profiles.py:2307-2336`, scrub comment `:2281-2284`). Storage: the archive file, not the source profile dir. Event: none. Errors: 400 ValueError when empty `output` has no safe dest (`web_routers/profiles.py:1102-1103`; `hermes_cli/profiles.py:2191-2195`, `:2208-2216`); 500 OSError creating the export dir (`web_routers/profiles.py:1104-1105`); 404 unknown profile (`FileNotFoundError` from `_unknown_profile_error` `hermes_cli/profiles.py:325`, mapped by `_profile_errors` `web_routers/profiles.py:175-186` at the call `:1107`); 400 invalid name (`ValueError`, `:187-188`); 500 any other exception (`:191-193`); 401 inherited. Status: verified. Share is this export, not a new endpoint. |
| G21, G43 | Test run / Stop | section 3.5 and 3.3. Header is the profile pill plus the prompt. No 7-day parameter. |
| G25 | Stop, steer, attach | Stop and steer: sections 3.3 and 4. Attach is a Cut of this row's third control. No attach endpoint is implied. |
| G32, G86 | Owner / change note | No owner field. Owner = last writer on the A5 manifest. Change note is an A5 field. Both proposed, owner P2. Do not write them into SOUL.md frontmatter from the client. |
| G46 | Steer send-gating | section 4. UI only. |
| G57 | Save disabled at 0 dirty | UI. The writes are section 5. No "save all" endpoint. P5 may loop the per-node writes; a failed one stops the loop and does not claim the rest saved. A5, when present, is still per node. |
| G82 | Add all | Cut. Ledger. No bundle endpoint. Do not loop hub/install. |
| R4 | Projects list / create / archive / favourites | section 6b. Favourites local. Create and archive are `projects.create` / `projects.archive`. |
| R6, R17, R19, R39, R47 | Drag, body, done/ready, pickers, title | `PATCH` section 6. Pin (R19) is a local pref, storage `none` on the server, event `none`. |
| R20 | Open, Duplicate, Copy link, Archive, Reassign | Open is navigation. Duplicate has no route: client `POST /tasks` with copied title/body/assignee/priority, new id. Copy link is the clipboard, storage `none`. Archive is PATCH `archived`. Reassign is section 6. Delete is forbidden. |
| R21, R49 | Bulk archive / reassign / ready | `POST /tasks/bulk` section 6. |
| R22 | Palette Create task / Create project | Create task: `POST /tasks` section 6. Create project: section 6b `projects.create`. Go to, Search, Switch theme, Shortcuts: existing Desktop palette. No new endpoint. |
| R42 | Within-column reorder | Disabled. Ledger. No position write. |
| R46 | Undo within 8 s | section 6b. No status, archive, or reassign Undo through bare PATCH or reassign, including Landed-legal pairs. 8 s control is not rendered until `POST /api/plugins/kanban/tasks/{id}/undo` exists. Owner P1. Named gap, not a Cut. Never for approval or stop. Never restores a cancelled run or claim. Never re-enters running. |
| R48 | Column add | `POST /tasks` on todo and ready only. |
| R57 | Unarchive | `PATCH` to `triage`, `todo`, or `ready`. Ledger. |
| O47 | Dirty / event dots | Local stores only. No server write. |
| O52 | Open palette | Existing Desktop `openCommandPalettePage`. No new endpoint. |
| O58 | Create with triage | `POST /tasks` with `triage: true` (section 6). Not a router. |
| O71 | Handoff | `POST /reassign` or `POST /links`. `delegate_task` spawn is not an Ops route. |
| O73 | Open git review | Navigation to the existing review surface. Ops does not call `POST /api/git/review/commit` or `/push`. Those routes exist (`hermes_cli/web_routers/git.py:187`, `:192`) and are not planned Ops actions. |
| R44 | Live update keeps focus | UI invariant. No write. |

Rows in sections 3-5 and 12.8 whose citation is a read, a local pref, a Cut with no write, or an existing Desktop surface are not given a fake write. Examples: O1-O2 fleet reads, O7 activity, O56 sigil, R4 favourites (local; create/archive are section 6b), G28 filter (cut), G10/G82 bundles (cut), R23 keys (no new bind in this slice).

## 8. Phase owners for anything not verified

| Endpoint | Owner | Why it is not implied by an existing adapter |
|---|---|---|
| `POST /api/plugins/kanban/tasks/{id}/unblock` | P1 | three current calls are not one transaction and do not check claim revision |
| `POST /api/plugins/kanban/tasks/{id}/undo` | P1 | the only R46 Undo route. Atomic compare of `expected_status` (landed status) + task revision or last event id + claim. Bare `PATCH /tasks/{id}` and `POST /tasks/{id}/reassign` are not this route, including for Landed-legal pairs. Does not exist. Not a bundle endpoint. Not a Cut of R46. |
| `POST /api/approvals/{id}/respond` and `GET /api/approvals/pending` | P1 A3 | in-process pop is not cross-profile durable dedupe |
| A5 inside each Canvas mutation, plus restore | P2 | `atomic_write_text` is not a backup transaction |
| A6 on model, raw YAML, restore, fallback_providers, auxiliary | P2 | model PUT accepts any pair today |
| A7 SSE | P1 | WebSocket exists; the SPEC path does not |
| R23 chord implementation (BR-CLOSE, BR-DISPATCH, BR-ESC-*, BR-FOCUS-SURFACE) | P0.5 | documentary contract only |

P0 exit is blocked on the R23 dynamic signature (ledger). That block is not a license to call any proposed route from a client fallback.
