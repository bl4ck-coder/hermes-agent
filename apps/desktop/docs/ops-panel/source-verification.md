# Ops panel source verification (P0-01)

Status: documentation only. Round 3 keeps the round-2 repairs (gateway `session_id`/`usage`, ACK-vs-settlement, O66 cut limited to the kanban join). Rows assigned to this card: O16, O41, O56, O58, O60, O66, O67, G28, G61, G68, G70, G84, R4, R34.
SHA of the handlers: `865ba906c1a`. Contracts: `apps/desktop/docs/ops-panel/read-contracts.md`.
A failed cited source is a proposed Cut. An unread live payload is a blocker for live confirmation, not a fake verify. Handler inspection is the existence evidence.

Other SPEC section 12.6 verify rows (O64, G27, G82, R23, R42, R57) are not this card. Coverage is not recomputed here. Recomputing 85.2% without those rows would invent a number.

## Live probe log (no credentials)

| Probe | Result | What it proves |
|---|---|---|
| `GET http://127.0.0.1:8642/health` | 200 `status=ok`, `version=0.21.5`, `platform=hermes-agent` | Gateway process is up. Matches SPEC section 0 version. |
| `GET http://127.0.0.1:8642/v1/capabilities` | 401 `gateway_auth_failed` | `/v1/*` is not anonymous. Key not sent. |
| `GET http://127.0.0.1:8642/v1/runs/does-not-exist` | 401 `gateway_auth_failed` | Same gate, before run lookup. |
| Desktop serve `127.0.0.1:56809` `GET /api/health` | 200 `ok`, `version=0.21.5`, `commit=865ba906c1a`, `auth_required=false` | Ephemeral Desktop backend matches this SHA. Port is not stable. |
| same `GET /api/status` | 200 `gateway_running=true`, `gateway_state=running`, `active_agents=0`, `active_sessions=1` | Public status read. Paths and pids omitted. |
| same `GET /api/dashboard/plugins` | 200, names include `kanban` and `workflow-studio` | Those plugins are loaded on that process. |
| same `GET /api/does-not-exist-p0` | 401 `Unauthorized` | 401 is the auth gate, not a routing result. |
| same `GET /api/ops/fleet`, `/api/approvals/pending`, `/api/plugins/kanban/workflow`, `/api/plugins/workflow-studio/health` | 401 | Does not prove those paths exist. |
| `127.0.0.1:9119` | connection refused | Not the Hermes dashboard in this session. |
| `100.81.3.121:9119/api/status` | non-JSON 404 | Not the Hermes dashboard. |

Blocker: gated JSON bodies were not read. No session token was loaded. Do not treat any row below as live-payload-verified unless the table above is the evidence.

## Verdicts

### O16 Workflow pipelines + Run — proposed Cut of the kanban-template mapping

SPEC citation: `/api/cron/jobs/{id}/trigger`; workflow-studio plugin; equivalent text says kanban `workflow_template_id`.

| Source | Result | Evidence |
|---|---|---|
| Cron "Run now" | handler verified, write | `hermes_cli/web_routers/cron.py:729` `trigger_cron_job`. List read is `cron.py:668`. |
| workflow-studio plugin | handler verified, external tree | Plugin yaml `C:\Users\nachi\AppData\Local\hermes\plugins\workflow-studio\plugin.yaml`. Routes in that tree's `dashboard/plugin_api.py:107` `GET /workflows`, `:162` `POST /workflows/{id}/runs`. Mount `/api/plugins/workflow-studio`. Live plugin name present. Payload not read (401). |
| kanban `workflow_template_id` as a pipeline catalog | failed | Column exists (`hermes_cli/kanban_db.py:796`, schema add `kanban_db_connect.py:820`). Docs say v1 kernel ignores it (`website/docs/user-guide/features/kanban.md:1398`). No template table, no template GET. `GET /api/plugins/kanban/workflow` is the status-column machine (`plugin_api.py:1619`, `kanban_workflow.py:114`), not a template library. Plugin tree search for `workflow_template_id`: no matches. |

Proposed Cut: do not ship "workflow pipelines" as kanban `workflow_template_id`. That source failed.

What remains, as separate sources, not as that mapping:

- Cron Run now can stay, pointed at `POST /api/cron/jobs/{job_id}/trigger`.
- workflow-studio can stay only if a later slice cites its own `/workflows` API. It is not the kanban template column.

Reason: an Adapt that displays kanban template ids as pipelines would show an empty or client-written string with no step definition behind it.

### O41 Agent autonomy (Ask first / Safe / Full) — verified Adapt

Cited source: `approvals.mode` via `/api/config`.

- Key exists. Schema select: `manual`, `smart`, `off` (`hermes_cli/web_server_config.py:143`).
- Desktop read is JSON-RPC `config.get` key `approvals.mode`, profile-scoped (`apps/desktop/src/store/approval-mode.ts:16` and `:69`). REST `GET /api/config?profile=` returns the config document including non-underscore keys (`config_env.py:80`), so the key is on that read too.
- Stored enum is not Ask first / Safe / Full. Those Orbit labels have no matching config values. The Adapt is the three real modes.
- Unknown read normalizes to `manual` (`approval-mode.ts:40`). The in-memory cache before a read defaults to `smart` (`approval-mode.ts:44`). Ops must not paint `smart` until `config.get` returns.
- Live `config.get` was not called (token not used). Handler evidence is enough to mark the key verified. Live value per profile is a blocker for a screenshot, not for the contract.

Not a Cut. P2 does not govern this key.

### O56 Coloured profile sigil — verified Adapt, path corrected

Cited path `themes/profile-theme` does not exist.

Real source:

- `apps/desktop/src/lib/profile-color.ts:21` `profileColor`: HSL from the name. `default` and empty return null.
- `resolveProfileColor` (`profile-color.ts:35`): local override map, else the hash.
- Overrides are client state (`$profileColors`), not `GET /api/profiles`. List shape has no colour (`profiles.py:83`).
- Skins are a different store: `apps/desktop/src/themes/context.tsx` key `hermes-desktop-profile-themes-v1`.

Not a Cut. The colour exists. It is not a server field. "Use the profile's colour if one exists" means the local override, else the hash, else neutral for default.

### O58 Composer routing line / triage — verified

Cited question: kanban triage exists?

- Status `triage` is a real column (`kanban_workflow.py:116`). Manual moves from triage: `todo`, `ready` (`kanban_workflow.py:126`).
- `POST /api/plugins/kanban/tasks` accepts `triage: bool = False` (`plugin_api.py:417`).
- Dispatcher decomposes triage tasks (`gateway/kanban_watchers_dispatcher.py:248`).
- `GET /workflow` publishes the column (`plugin_api.py:1619`).

Honest line is allowed: assigned profile, or "Unassigned — triage" when the create sets `triage: true` or status is `triage`. Do not say "routes to the right agent". That sentence has no router behind it.

Not a Cut.

### O60 Steps n/m — proposed Cut of the n/m display

Cited: `tasks.current_step_key`, workflow template step count.

- `current_step_key` column exists (`kanban_db.py:797`). Clients may write it. Kernel does not route on it (same kanban doc as O16).
- Template step count: no catalog, no `steps[]` on `GET /workflow`. workflow-studio graphs have nodes, but they are not joined to `current_step_key` (plugin has no `workflow_template_id`).

The row already says show n/m only when the count is known. The count source failed. Proposed Cut: never show Steps n/m. Show `current_step_key` when the column is non-null, otherwise omit the steps cell. Do not invent `n` or `m`.

### O66 Chat task chip from a run — proposed Cut of the kanban run-to-session mapping only

Cited: run/session mapping (A2 / verify).

Two stores. They are not the same failure.

| Store | Result | Evidence |
|---|---|---|
| Kanban `task_runs` → session | failed | `task_runs` has no `session_id` (`kanban_db.py:1080-1103`). `metadata` is free JSON, not a contract. `tasks.session_id` (`kanban_db.py:808`) is the originating `HERMES_SESSION_ID`, NULL for CLI/dashboard creates. No handler joins a kanban run id to a chat session id. |
| Gateway `GET /v1/runs/{id}` | verified, not this Cut | `session_id` is set at queued (`api_server_runs.py:718-719`). Terminal native finish writes `usage` and `runtime` (`:986`). `_run_usage` (`:759-766`) coerces a missing counter to 0. A live-owner settled run writes `usage={}` (`:895-896`). GET returns that status dict (`:1057-1061`). Zeros and `{}` are provenance `gateway.session_counters` (unverified-measured), not proof of measurement, and not a license to double-count runs that share a session. Absent `usage` key stays null. |

Proposed Cut, limited to the kanban join: a chat opened from a kanban run must not show a task chip derived from a session lookup. If the user opened the chat from a task tab, the chip is that task id (already known), not a discovered mapping. Do not cut the gateway `session_id` field. It exists.

Profile chip does not need this mapping. Pass the focused profile into the existing Desktop chat (SPEC O69). That part is not this failed source.

A2 remains proposed (`read-contracts.md` section 5.2). It must return null when the usage key is absent, must not re-label gateway zeros as measured per-run tokens, and must not add a shared session total onto each run.

### O67 Clickable task ids in a transcript — verified format, Orbit display cut

Cited: kanban id format.

- Generator: `hermes_cli/kanban_db.py:1161` returns `"t_" + secrets.token_hex(4)`. Pattern: `t_[0-9a-f]{8}`.
- `TASK-142` does not exist. Auto-link that shape would match nothing.

Not a Cut of the feature. Adapt the chip to `t_[0-9a-f]{8}` and open `GET /api/plugins/kanban/tasks/{id}`. Proposed Cut of the `TASK-NNN` display only.

### G28 Trigger filter expression — proposed Cut of the filter

Cited: show a filter only if the webhook model has one.

- List summary fields (`hermes_cli/web_routers/ops.py:140`): events, deliver, deliver_only, prompt, script, skills, created_at, url, secret_set, enabled. No filter.
- `WebhookCreate` (`hermes_cli/web_models.py:376`): name, description, events, prompt, script, skills, deliver, deliver_only, deliver_chat_id, secret. No filter.

Failed source. Proposed Cut: Trigger node lists subscriptions and their `events` array. It does not show a filter expression. Do not invent one from `prompt`.

The trigger list itself stays (SPEC G28 node, read `GET /api/webhooks`). Only the filter half is cut.

### G61 Templates lens — proposed Cut of kanban workflow templates

Cited: `/api/cron/blueprints` and kanban workflow templates.

- Blueprints: verified, and profile-scoped. `cron.py:858` `list_cron_blueprints` takes optional `?profile=` (omitted = launch profile, not all profiles). `_blueprint_catalog_sync` (`cron.py:830-862`) enters `_config_profile_scope(profile)`, lists builtins plus that profile's plugin blueprints (`blueprint_catalog.py:556-562`), and rewrites the `deliver` field's options from that profile's platforms. Each item is `blueprint_catalog_entry` (`blueprint_catalog.py:667-678`), not a bare `{blueprints: ...}` with an unknown inner shape. This is not a process-global catalog.
- Kanban workflow templates: same failure as O16. `GET /workflow` (`plugin_api.py:1620`) takes no `?board=` and is columns, not templates.

Proposed Cut: the Templates lens is cron blueprints only. Do not add a "kanban workflow templates" section. workflow-studio workflows are a different product store; citing them here would smuggle O16's failed mapping back in.

### G68 Skill type tag — verified Adapt, not a fixed enum

Cited: `/api/skills` category field.

- `get_skills` adds nothing that removes `category`. The row is `{name, description, category, enabled, usage, provenance}` (`skills.py:343`, `skills_tool.py:239`).
- `category` is the first directory under the skills root when the relative path has at least 3 parts (`skills_tool.py:130`). Otherwise null.
- It is not a frontmatter tag and not the set Backend/Design/Frontend/Workflow.

Not a Cut. Render the path category, or nothing when null. Gold-tone hue can hash the category string. Do not map null to "Workflow".

### G70 Author avatar and relative Updated — proposed Cut

Cited: `/api/skills` author and updated fields.

- List payload has no `author` and no mtime (`skills.py:366` loop sets `enabled`, `usage`, `provenance` only).
- `GET /api/skills/content` returns raw SKILL.md (`skills.py:397`). The linter knows an optional frontmatter `author` (`tools/skill_linter.py:103`) but the list route does not parse it, and neither route returns mtime.
- File mtime would be a new field. This slice does not add one.

Failed source for both fields. Proposed Cut: no author avatar, no relative Updated column. Name, description, path-category, enabled, provenance remain.

### G84 Models category / provider auth status — verified read, preview must be dropped

Cited: provider/auth status endpoint.

- `GET /api/providers/oauth` `list_oauth_providers` (`oauth.py:683`).
- Status card: `logged_in` boolean plus `token_preview` (`oauth.py:356`). Preview must not reach the renderer.
- Dispatch table includes `openai-codex` (`oauth.py:383`) and `xai-oauth` (`oauth.py:394`). Anthropic is handled as an owned external credential (`oauth.py:644`).
- P2 filtering is not in this handler. The UI filters the ids. Non-OAuth key presence is `GET /api/env` `is_set` only (`config_env.py:278`); that row also has `redacted_value`, which Ops must ignore.

Not a Cut. Live body not read (401). Handler is the verification.

Clicking through to Desktop provider setup is an existing Desktop route, not a new adapter.

### R4 Projects list / create / archive / favourites — verified, favourites stay local

Cited: `projects.db`; create via existing Desktop projects.

- Schema: `hermes_cli/projects_db.py:29`. Columns include `archived`, `color`, `icon`, `board_slug`, `primary_path`. No favourites column.
- Reads: JSON-RPC `projects.list` / `projects.get` (`tui_gateway/methods_projects.py:81`, `:86`). REST `GET /api/profiles/projects/tree` (`profiles.py:717`).
- Create: JSON-RPC `projects.create` (`methods_projects.py:91`), Desktop `apps/desktop/src/store/projects.ts:1102`. Profile is the writable owner, not the "All profiles" filter (`projects.ts:1111`).
- Archive: `projects.archive` (`methods_projects.py:104`).
- Favourites: the row already says local. No server field. Local pref is the Adapt, not a missing column.

Not a Cut. Live RPC was not called (socket auth not used). Handlers and the Desktop caller are the evidence.

### R34 Project templates via kanban workflow templates — proposed Cut

Cited source is only "kanban workflow templates (verify in P0)".

That source failed (O16, G61). There is no template catalog, no step list, and `workflow_template_id` is an unused nullable column.

Proposed Cut the row. Do not alias cron blueprints or workflow-studio graphs onto R34. Those are other rows with their own citations.

## Cuts this card proposes

| Row | What is cut | What is not cut |
|---|---|---|
| O16 | kanban `workflow_template_id` as a pipeline catalog | cron trigger handler; workflow-studio as its own API if a later row cites it |
| O60 | Steps n/m | `current_step_key` text when non-null |
| O66 | task chip discovered from a kanban run→session join | gateway `session_id` on `GET /v1/runs/{id}` (verified); profile chip passed explicitly; task chip when the task id is already the opener |
| O67 | `TASK-NNN` display | link `t_[0-9a-f]{8}` |
| G28 | filter expression | webhook subscription list and `events` |
| G61 | kanban workflow templates section | cron blueprints |
| G70 | author avatar and relative Updated | skill name, description, category, provenance |
| R34 | the whole row | nothing on this citation |

Not cut: O41, O56, O58, G68, G84, R4.

## Blockers (not verified, not cuts)

- Gated REST and JSON-RPC response bodies on the live Desktop serve. Auth gate returns 401 before routing. Token was not loaded, so no redacted payload exists for `/api/profiles`, `/api/skills`, `/api/cron/jobs`, `/api/webhooks`, `/api/providers/oauth`, kanban board, or workflow-studio.
- `:9119` is not the Hermes dashboard in this session. SPEC section 0 said it was down; it is still not the FastAPI app.
- Global coverage percentage. Six verify rows are outside this card.

## Source discrepancy (do not edit SPEC)

SPEC §1 (line 52), §3.2 (line 94), and R36 (line 656) name `approval.received` next to settlement: live-update invalidation, "Resolved elsewhere", and a Resolved-tab history. The handler does not do that.

`approval.received` (`methods_prompt.py:1193`) calls `ack_gateway_approval` (`approval.py:210-217`), which sets `acknowledged=True` and leaves the entry queued. The call that pops and settles is `resolve_gateway_approval` (`approval.py:139-173`).

This card records the mismatch. It does not edit SPEC. It does not invent a universal resolution event. The contract in `read-contracts.md` §4.6 and §6 uses the real signals: `approval.respond` `resolved>0`, HTTP 409 `approval_not_pending`, SSE `approval.responded`, push `approval.cancelled`, or a re-read of `approval.pending`. An ACK never retires a pending.

## Self-check against the card acceptance

- Documentation only. No config write, no mutation, no adapter code.
- Read routes and event sources from SPEC sections 3-5 and 12.8 are in `read-contracts.md` section 11, including proposed A1-A4/A7. O24 `command_allowlist`, G5 `store/free-tier*`, R2 `kanban_notify_subs`, and `/links` (embedded, no GET) are inventoried there.
- Read-contract axes are labeled, or `inherited exact §X` / `none` / `not exposed` / `proposed`. This file does not claim live-payload exhaustivity and does not claim a schema audit of every SPEC sentence. A 230/230 id match is a name classification. An axis that could not be read from source would be `incomplete`; this round does not mark one. Gated JSON bodies remain a blocker, not a verify.
- These 14 rows are resolved above with file locations. O66's Cut is the kanban join only. Gateway `session_id` and terminal `usage` are verified, with null/provenance and no double count. Live bodies that need a token are blockers, not verifies.
- Failed sources are proposed Cuts with reasons. Inaccessible live payloads stay blockers.
- Delegation is separated from live sub-agents. Null usage keeps provenance, including gateway zeros vs a missing key. A3 ownership, expiry, status, and respond dedupe are specified. `approval.received` is an ACK and does not drop a pending. Not implemented.
- A1 mixed gate is one policy. Old running + fresh gateway-up is stale (rule 2), not idle. `observed_at` is a successful observation. `updated_at` is `event_at`. No adapter and no run was created to test it.
