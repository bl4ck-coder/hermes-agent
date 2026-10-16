# Ops panel source verification (P0-02, merged with P0-01)

Status: documentation only. No production write, no keypress, no new route.
Handlers re-checked on `feat/ops-panel` `005b104a506`. Non-doc tree is byte-identical to `865ba906c1a` (`git diff --stat 865ba906c1a..HEAD` outside `apps/desktop/docs` is empty). Line numbers below are that tree.
P0-01's 14-row ledger (handlers at `865ba906c1a`) is merged into this file. Its detail for each shared row is kept under a `#### P0-01 detail` subheading inside that row's `###` section, its live probe log is its own section below, and its original cuts table, blockers, source discrepancy and self-check are kept verbatim (headings demoted) in the last section. Where the two differ, the P0-02 verdict line is the combined verdict; P0-01 text is kept so no evidence is lost.

This file is the combined section 12.6 ledger. It contains exactly these 20 ids, no others:

O16, O41, O56, O58, O60, O64, O66, O67, G27, G28, G61, G68, G70, G82, G84, R4, R23, R34, R42, R57

Coverage arithmetic is `coverage.md`. Action contracts are `action-contracts.md`. SPEC is not edited.

A failed cited source is a Cut of that source, with the reason kept. A handler that exists is existence evidence. An unread live payload is a blocker for a screenshot, not a fake verify. Mutation behavior is taken from handlers and the existing workflow-matrix test, not from a live board write.

## Verdicts

| ID | Result | What changed |
|---|---|---|
| O16 | partial Cut | kanban `workflow_template_id` is not a pipeline catalog. Cron trigger stays. |
| O41 | verified Adapt | key is `approvals.mode` = `manual` / `smart` / `off`, not the Orbit labels |
| O56 | verified Adapt | colour is a client hash, not `themes/profile-theme` |
| O58 | verified | `triage` is a real column and a create flag |
| O60 | partial Cut | no step-count source. Do not show n/m. |
| O64 | verified Adapt | terminal exists. Ops does not spawn a second one. P0-04 audit incorporated. |
| O66 | partial Cut | no kanban run-to-session join. Gateway `session_id` is a different store. |
| O67 | partial Cut | link `t_[0-9a-f]{8}`. Do not link `TASK-NNN`. |
| G27 | verified, field corrected | ownership is the storing profile, not `job.origin` |
| G28 | partial Cut | webhook model has no filter expression |
| G61 | partial Cut | templates lens is cron blueprints only |
| G68 | verified Adapt | `category` is a path segment, not a fixed enum |
| G70 | Cut | no author, no mtime on the list |
| G82 | Cut | hub has no starter-pack bundles |
| G84 | verified Adapt | OAuth status exists. `token_preview` must not reach the renderer. |
| R4 | verified Adapt | projects handlers exist. Favourites stay local. |
| R23 | documentary verified / dynamic signature pending | P0-04 audit incorporated. Not an implementation PASS. |
| R34 | Cut | only cited source is the failed template catalog |
| R42 | verified Adapt, reorder disabled | `priority` is a rank. No position column. |
| R57 | verified Adapt | unarchive is legal to `triage`, `todo`, `ready` only |

### O16 Workflow pipelines + Run ÔÇö partial Cut

Cited: `/api/cron/jobs/{id}/trigger`; workflow-studio; kanban `workflow_template_id`.

- Cron Run now: `hermes_cli/web_routers/cron.py:729` `trigger_cron_job`. 409 if already claimed (`cron.py:642`).
- `workflow_template_id` is a nullable column (`hermes_cli/kanban_db.py:796`). No template table, no template GET. `GET /api/plugins/kanban/workflow` is the status-column machine, not a catalog.
- workflow-studio is an external plugin tree, not this column. Do not alias it onto this row.

Cut the kanban-template mapping. Keep cron trigger as its own action (`action-contracts.md`). Reason: displaying template ids as pipelines would show a client-written string with no step definition.

#### P0-01 detail (O16 Workflow pipelines + Run ÔÇö proposed Cut of the kanban-template mapping)

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

### O41 Agent autonomy ÔÇö verified Adapt

`approvals.mode` is a schema select of `manual`, `smart`, `off` (`hermes_cli/web_server_config.py:143`). Orbit labels Ask first / Safe / Full have no matching values. The Adapt is the three real modes. Live `config.get` was not called. Not a Cut. P2 does not govern this key.

#### P0-01 detail (O41 Agent autonomy (Ask first / Safe / Full) ÔÇö verified Adapt)

Cited source: `approvals.mode` via `/api/config`.

- Key exists. Schema select: `manual`, `smart`, `off` (`hermes_cli/web_server_config.py:143`).
- Desktop read is JSON-RPC `config.get` key `approvals.mode`, profile-scoped (`apps/desktop/src/store/approval-mode.ts:16` and `:69`). REST `GET /api/config?profile=` returns the config document including non-underscore keys (`config_env.py:80`), so the key is on that read too.
- Stored enum is not Ask first / Safe / Full. Those Orbit labels have no matching config values. The Adapt is the three real modes.
- Unknown read normalizes to `manual` (`approval-mode.ts:40`). The in-memory cache before a read defaults to `smart` (`approval-mode.ts:44`). Ops must not paint `smart` until `config.get` returns.
- Live `config.get` was not called (token not used). Handler evidence is enough to mark the key verified. Live value per profile is a blocker for a screenshot, not for the contract.

Not a Cut. P2 does not govern this key.

### O56 Coloured profile sigil ÔÇö verified Adapt

`themes/profile-theme` does not exist. Colour is `profileColor` (`apps/desktop/src/lib/profile-color.ts:21`): HSL from the name; `default` and empty return null. Overrides are client state, not `GET /api/profiles`. Not a Cut. Use the local override, else the hash, else neutral for default.

#### P0-01 detail (O56 Coloured profile sigil ÔÇö verified Adapt, path corrected)

Cited path `themes/profile-theme` does not exist.

Real source:

- `apps/desktop/src/lib/profile-color.ts:21` `profileColor`: HSL from the name. `default` and empty return null.
- `resolveProfileColor` (`profile-color.ts:35`): local override map, else the hash.
- Overrides are client state (`$profileColors`), not `GET /api/profiles`. List shape has no colour (`profiles.py:83`).
- Skins are a different store: `apps/desktop/src/themes/context.tsx` key `hermes-desktop-profile-themes-v1`.

Not a Cut. The colour exists. It is not a server field. "Use the profile's colour if one exists" means the local override, else the hash, else neutral for default.

### O58 Composer routing line ÔÇö verified

`triage` is a column (`hermes_cli/kanban_workflow.py:116`). `POST /tasks` accepts `triage: bool = False` (`plugins/kanban/dashboard/plugin_api.py:417`). Honest line: assigned profile, or "Unassigned ÔÇö triage" when create sets `triage: true` or status is `triage`. Do not say "routes to the right agent". Not a Cut.

#### P0-01 detail (O58 Composer routing line / triage ÔÇö verified)

Cited question: kanban triage exists?

- Status `triage` is a real column (`kanban_workflow.py:116`). Manual moves from triage: `todo`, `ready` (`kanban_workflow.py:126`).
- `POST /api/plugins/kanban/tasks` accepts `triage: bool = False` (`plugin_api.py:417`).
- Dispatcher decomposes triage tasks (`gateway/kanban_watchers_dispatcher.py:248`).
- `GET /workflow` publishes the column (`plugin_api.py:1619`).

Honest line is allowed: assigned profile, or "Unassigned ÔÇö triage" when the create sets `triage: true` or status is `triage`. Do not say "routes to the right agent". That sentence has no router behind it.

Not a Cut.

### O60 Steps n/m ÔÇö partial Cut

`current_step_key` exists (`kanban_db.py:797`). Template step count does not (same catalog failure as O16). Cut the n/m display. Show `current_step_key` when non-null, otherwise omit the steps cell. Do not invent `n` or `m`.

#### P0-01 detail (O60 Steps n/m ÔÇö proposed Cut of the n/m display)

Cited: `tasks.current_step_key`, workflow template step count.

- `current_step_key` column exists (`kanban_db.py:797`). Clients may write it. Kernel does not route on it (same kanban doc as O16).
- Template step count: no catalog, no `steps[]` on `GET /workflow`. workflow-studio graphs have nodes, but they are not joined to `current_step_key` (plugin has no `workflow_template_id`).

The row already says show n/m only when the count is known. The count source failed. Proposed Cut: never show Steps n/m. Show `current_step_key` when the column is non-null, otherwise omit the steps cell. Do not invent `n` or `m`.

### O64 Dock terminal ÔÇö verified Adapt, P0-04 incorporated

P0-04 merged into `feat/ops-panel` at `2ab328a9c66`. Audit: `apps/desktop/docs/ops-panel/desktop-surface-audit.md` section 2. Re-checked on this tree:

- `apps/desktop/electron/terminal-ipc.ts:326` and `:331` call `nodePty.spawn` (local shell or SSH).
- Renderer surface is `data-interactive-terminal` (`src/app/right-sidebar/terminal/instance.tsx:61`).
- Ops dock Log reuses `LogTail` (`src/components/chat/log-tail.tsx:39`). Events and Problems are not a shell.
- No `nodePty.spawn` from an Ops path.

Do not cut the existing terminal. Do not add a second one. Not a Cut of O64.

### O66 Chat task chip ÔÇö partial Cut

`task_runs` has no `session_id` (`kanban_db.py:1080-1103`). `metadata` is free JSON, not a join contract. Cut a task chip discovered by looking up a session from a kanban run. If the user opened the chat from a task tab, the chip is that already-known task id. Gateway `GET /v1/runs/{id}` `session_id` is a different store (`api_server_runs.py:718`). Do not cut that field. Do not treat it as a kanban join.

#### P0-01 detail (O66 Chat task chip from a run ÔÇö proposed Cut of the kanban run-to-session mapping only)

Cited: run/session mapping (A2 / verify).

Two stores. They are not the same failure.

| Store | Result | Evidence |
|---|---|---|
| Kanban `task_runs` ÔåÆ session | failed | `task_runs` has no `session_id` (`kanban_db.py:1080-1103`). `metadata` is free JSON, not a contract. `tasks.session_id` (`kanban_db.py:808`) is the originating `HERMES_SESSION_ID`, NULL for CLI/dashboard creates. No handler joins a kanban run id to a chat session id. |
| Gateway `GET /v1/runs/{id}` | verified, not this Cut | `session_id` is set at queued (`api_server_runs.py:718-719`). Terminal native finish writes `usage` and `runtime` (`:986`). `_run_usage` (`:759-766`) coerces a missing counter to 0. A live-owner settled run writes `usage={}` (`:895-896`). GET returns that status dict (`:1057-1061`). Zeros and `{}` are provenance `gateway.session_counters` (unverified-measured), not proof of measurement, and not a license to double-count runs that share a session. Absent `usage` key stays null. |

Proposed Cut, limited to the kanban join: a chat opened from a kanban run must not show a task chip derived from a session lookup. If the user opened the chat from a task tab, the chip is that task id (already known), not a discovered mapping. Do not cut the gateway `session_id` field. It exists.

Profile chip does not need this mapping. Pass the focused profile into the existing Desktop chat (SPEC O69). That part is not this failed source.

A2 remains proposed (`read-contracts.md` section 5.2). It must return null when the usage key is absent, must not re-label gateway zeros as measured per-run tokens, and must not add a shared session total onto each run.

### O67 Clickable task ids ÔÇö partial Cut of `TASK-NNN` only

Generator: `kanban_db.py:1161` returns `"t_" + secrets.token_hex(4)`. Pattern `t_[0-9a-f]{8}`. `TASK-142` matches nothing. Adapt the chip to the real pattern and open `GET /api/plugins/kanban/tasks/{id}`. Cut the Orbit display shape only.

#### P0-01 detail (O67 Clickable task ids in a transcript ÔÇö verified format, Orbit display cut)

Cited: kanban id format.

- Generator: `hermes_cli/kanban_db.py:1161` returns `"t_" + secrets.token_hex(4)`. Pattern: `t_[0-9a-f]{8}`.
- `TASK-142` does not exist. Auto-link that shape would match nothing.

Not a Cut of the feature. Adapt the chip to `t_[0-9a-f]{8}` and open `GET /api/plugins/kanban/tasks/{id}`. Proposed Cut of the `TASK-NNN` display only.

### G27 Schedule ownership ÔÇö verified, field corrected

D9 says ownership is `origin` in `jobs.json` as the origin profile. That name is wrong. Do not edit SPEC. Record the correction.

- `cron/jobs.py:1932` stores `origin` as delivery metadata (`{platform, chat_id}`), comment: "where job was created for origin delivery".
- `cron/scheduler.py:2325` refuses to seed session vars from `job["origin"]`. It is not a sender and not a profile name.
- The job lives in one profile's `cron/jobs.json`. List annotation stamps `profile` and `profile_name` (`hermes_cli/web_server_cron.py:127-135`).
- Mutations resolve the storing profile via `_job_profile` (`cron.py:98-105`). A wrong `?profile=` hint does not write another profile's file when the server can locate the job.
- `GET /api/cron/jobs?profile=all` dedupes by id and prefers the default profile's copy (`cron.py:119-154`). Two profiles can hold the same id. The stamp on the returned row is the copy that won, not `origin`.
- `POST /api/cron/blueprints/instantiate` pops `origin` before create (`cron.py:892`) and writes into the `profile` query. Omitted `profile` defaults to the literal `"default"` (`cron.py:878`), not the launch profile. Ops must send the focused profile explicitly.

Ownership for the Schedule node is `profile` / `profile_name` on the list row, i.e. the profile directory that stores the job. Filtering the focused profile's jobs is `?profile=<name>`, not a filter on `origin`. Not a Cut.

### G28 Trigger filter ÔÇö partial Cut

List summary (`hermes_cli/web_routers/ops.py:140-150`) has events, deliver, prompt, script, skills, url, secret_set, enabled. No filter. `WebhookCreate` (`web_models.py:376-386`) has no filter field. Cut the filter expression. Keep the subscription list and the `events` array. Do not invent a filter from `prompt`.

#### P0-01 detail (G28 Trigger filter expression ÔÇö proposed Cut of the filter)

Cited: show a filter only if the webhook model has one.

- List summary fields (`hermes_cli/web_routers/ops.py:140`): events, deliver, deliver_only, prompt, script, skills, created_at, url, secret_set, enabled. No filter.
- `WebhookCreate` (`hermes_cli/web_models.py:376`): name, description, events, prompt, script, skills, deliver, deliver_only, deliver_chat_id, secret. No filter.

Failed source. Proposed Cut: Trigger node lists subscriptions and their `events` array. It does not show a filter expression. Do not invent one from `prompt`.

The trigger list itself stays (SPEC G28 node, read `GET /api/webhooks`). Only the filter half is cut.

### G61 Templates lens ÔÇö partial Cut

`GET /api/cron/blueprints` is real (`cron.py:858`). It is built-ins plus that profile's plugin blueprints (`cron.py:830-836`). Unknown `?profile=` is the scope's 404. It is not a kanban template catalog. Cut the "kanban workflow templates" section. Do not smuggle workflow-studio graphs in to fill it.

#### P0-01 detail (G61 Templates lens ÔÇö proposed Cut of kanban workflow templates)

Cited: `/api/cron/blueprints` and kanban workflow templates.

- Blueprints: verified, and profile-scoped. `cron.py:858` `list_cron_blueprints` takes optional `?profile=` (omitted = launch profile, not all profiles). `_blueprint_catalog_sync` (`cron.py:830-862`) enters `_config_profile_scope(profile)`, lists builtins plus that profile's plugin blueprints (`blueprint_catalog.py:556-562`), and rewrites the `deliver` field's options from that profile's platforms. Each item is `blueprint_catalog_entry` (`blueprint_catalog.py:667-678`), not a bare `{blueprints: ...}` with an unknown inner shape. This is not a process-global catalog.
- Kanban workflow templates: same failure as O16. `GET /workflow` (`plugin_api.py:1620`) takes no `?board=` and is columns, not templates.

Proposed Cut: the Templates lens is cron blueprints only. Do not add a "kanban workflow templates" section. workflow-studio workflows are a different product store; citing them here would smuggle O16's failed mapping back in.

### G68 Skill type tag ÔÇö verified Adapt

`category` is the first directory under the skills root when the relative path has at least 3 parts (`tools/skills_tool.py:130-141`). Otherwise null. `GET /api/skills` does not strip it (`skills.py:343-373` adds enabled, usage, provenance). It is not Backend/Design/Frontend/Workflow. Render the path category, or nothing. Do not map null to "Workflow".

#### P0-01 detail (G68 Skill type tag ÔÇö verified Adapt, not a fixed enum)

Cited: `/api/skills` category field.

- `get_skills` adds nothing that removes `category`. The row is `{name, description, category, enabled, usage, provenance}` (`skills.py:343`, `skills_tool.py:239`).
- `category` is the first directory under the skills root when the relative path has at least 3 parts (`skills_tool.py:130`). Otherwise null.
- It is not a frontmatter tag and not the set Backend/Design/Frontend/Workflow.

Not a Cut. Render the path category, or nothing when null. Gold-tone hue can hash the category string. Do not map null to "Workflow".

### G70 Author and Updated ÔÇö Cut

List payload has no `author` and no mtime. The list route does not parse SKILL.md frontmatter. File mtime would be a new field. This slice does not add one. Cut author avatar and relative Updated. Name, description, path-category, enabled, provenance remain on other rows.

#### P0-01 detail (G70 Author avatar and relative Updated ÔÇö proposed Cut)

Cited: `/api/skills` author and updated fields.

- List payload has no `author` and no mtime (`skills.py:366` loop sets `enabled`, `usage`, `provenance` only).
- `GET /api/skills/content` returns raw SKILL.md (`skills.py:397`). The linter knows an optional frontmatter `author` (`tools/skill_linter.py:103`) but the list route does not parse it, and neither route returns mtime.
- File mtime would be a new field. This slice does not add one.

Failed source for both fields. Proposed Cut: no author avatar, no relative Updated column. Name, description, path-category, enabled, provenance remain.

### G82 Add all ÔÇö Cut

SPEC: if the hub has no bundles, cut this. The hub has no starter-pack bundles.

- `GET /api/skills/hub/official` returns a flat `{skills: [...]}` of `official/<category>/<skill>` (`skills.py:123-141`).
- `GET /api/skills/hub/search` and `/sources` return skills and source ids, not packs.
- `POST /api/skills/hub/install` takes one `identifier` (`web_models.py:423-425`, `skills.py:97-103`).
- "bundle" in `hermes_cli/skills_hub.py` is one skill's fetched files, not a multi-skill pack.
- No `starter pack` / `Add all` route in this tree. `reference-index.md` already says Add all was not given a contract.

Cut the row. Reason: there is nothing to list in the confirm dialog, and inventing a client-side "install every search hit" would not be the hub bundle SPEC asked for. Single-skill hub install is not this row and is not G12 (G12 is `POST /api/skills` create/open). It is the Browse install, contracted in `action-contracts.md` and kept on G72. G10, which is the starter-pack row that required the same bundle, is Cut outside this 20-id set. See the crosswalk below. Do not add a `### G10` heading here.

### G84 Provider auth status ÔÇö verified Adapt

`GET /api/providers/oauth` builds a status card with `logged_in` and `token_preview` (`hermes_cli/web_routers/oauth.py:356-361`). Ops must drop `token_preview`. Non-OAuth key presence is `GET /api/env` `is_set` only; ignore `redacted_value`. P2 filtering is not in this handler. The picker filters. Not a Cut. Live body not read.

#### P0-01 detail (G84 Models category / provider auth status ÔÇö verified read, preview must be dropped)

Cited: provider/auth status endpoint.

- `GET /api/providers/oauth` `list_oauth_providers` (`oauth.py:683`).
- Status card: `logged_in` boolean plus `token_preview` (`oauth.py:356`). Preview must not reach the renderer.
- Dispatch table includes `openai-codex` (`oauth.py:383`) and `xai-oauth` (`oauth.py:394`). Anthropic is handled as an owned external credential (`oauth.py:644`).
- P2 filtering is not in this handler. The UI filters the ids. Non-OAuth key presence is `GET /api/env` `is_set` only (`config_env.py:278`); that row also has `redacted_value`, which Ops must ignore.

Not a Cut. Live body not read (401). Handler is the verification.

Clicking through to Desktop provider setup is an existing Desktop route, not a new adapter.

### R4 Projects ÔÇö verified Adapt

Schema `hermes_cli/projects_db.py:29-42` has `projects.archived` and `project_folders`, no favourites column. JSON-RPC `projects.list` (`tui_gateway/methods_projects.py:81`), `projects.create` (`:91`), `projects.archive` (`:104`).

Write axes are in `action-contracts.md` section 6b, not repeated as a 21st ledger heading: create body `ProjectsCreateParams`, archive body `ProjectsArchiveParams`, profile-scoped `projects.db`, JSON-RPC errors 5061/5062/5063, favourites local (storage none, event none). `projects.delete` is not bound. Live RPC was not called. Not a Cut.

#### P0-01 detail (R4 Projects list / create / archive / favourites ÔÇö verified, favourites stay local)

Cited: `projects.db`; create via existing Desktop projects.

- Schema: `hermes_cli/projects_db.py:29`. Columns include `archived`, `color`, `icon`, `board_slug`, `primary_path`. No favourites column.
- Reads: JSON-RPC `projects.list` / `projects.get` (`tui_gateway/methods_projects.py:81`, `:86`). REST `GET /api/profiles/projects/tree` (`profiles.py:717`).
- Create: JSON-RPC `projects.create` (`methods_projects.py:91`), Desktop `apps/desktop/src/store/projects.ts:1102`. Profile is the writable owner, not the "All profiles" filter (`projects.ts:1111`).
- Archive: `projects.archive` (`methods_projects.py:104`).
- Favourites: the row already says local. No server field. Local pref is the Adapt, not a missing column.

Not a Cut. Live RPC was not called (socket auth not used). Handlers and the Desktop caller are the evidence.

### R23 Key ownership ÔÇö documentary verified, dynamic signature pending

P0-04 audit, incorporated, not re-litigated:

- Contract: `apps/desktop/docs/ops-panel/keymap.md`. Judge `t_73d5bd69` PASS r3 and meta `t_c20823a8` PASS r3 accepted the document at `eaa0f8e1451`. Sandhi merged that document at `2ab328a9c66`.
- Active only on DOM focus inside `[data-ops-root]`, not hover, and outside editables. No single-key approve. `handleApprovalKey` accepts only Enter and Escape (`approval-keys.ts:35`). `P` stays undefined.
- `/` focuses the Ops rail filter only in that focused state. Composer slash is unchanged when the composer is focused.
- Ctrl+J stays `view.toggleRightSidebar` (`mod+j`). Direct Ctrl+W evidence is `apps/desktop/electron/main.ts:6953-6970` (`close-tab` ÔåÆ `preventDefault` ÔåÆ `sendClosePreviewRequested`). The keymap doc nit that cites `terminal-context-menu.ts` for that claim is non-blocking; this line is the main-process claim.
- Bounded requirements not in code yet, owner P0.5: BR-CLOSE, BR-DISPATCH, BR-ESC-CAPTURE / REGISTER / TIE / SKIP, BR-FOCUS-SURFACE. `focusedInteractiveTerminalOwnsWordErase` and `routeCloseTabChord` are not in the tree.

Do not consume an older "unresolved=0" comment as a signature. Documentary contract: verified. Dynamic PTY+Ops innermost-only signature: not signed. Named blocker: isolated Desktop stops at the onboarding veil, with no provider, sessions, PTY, or Ops root (sandhi on this card, judge r3). This is not a Cut of R23. It is a phase-exit blocker. P0 exit is not signed.

### R34 Project templates ÔÇö Cut

The only cited source is kanban workflow templates. That source failed (O16, G61). Cut the row. Do not alias cron blueprints or workflow-studio graphs onto it.

#### P0-01 detail (R34 Project templates via kanban workflow templates ÔÇö proposed Cut)

Cited source is only "kanban workflow templates (verify in P0)".

That source failed (O16, G61). There is no template catalog, no step list, and `workflow_template_id` is an unused nullable column.

Proposed Cut the row. Do not alias cron blueprints or workflow-studio graphs onto R34. Those are other rows with their own citations.

### R42 Reorder within a column ÔÇö verified Adapt, gesture disabled

`tasks.priority` is `INTEGER DEFAULT 0` (`kanban_db.py:953`). `PATCH /tasks/{id}` sets it (`plugin_api.py:703-704`) and `edit_task` writes a `reprioritized` event (`kanban_db.py:3242-3243`). Board order is `priority DESC, created_at ASC` (`kanban_db.py:1582`). There is no `position`, `order_index`, or sort-key column in `SCHEMA_SQL`.

Priority is a rank with ties. It is not a drag-order. Rewriting neighbors' priorities on drop would change importance, not position. Within-column drag reorder is disabled. Priority remains a picker (R39), not a reorder gesture. "land" plays only on a successful cross-column drop. A rejected drop snaps back with the 409 reason (`plugin_api.py:649`). Not a new Cut: the row already says disable when there is no order field. The order field is absent. The priority field is present and is not that order field.

### R57 Unarchive ÔÇö verified Adapt

`archived` is a filter, not a column (`kanban_workflow.py:27-28`). Archiving (any non-archived source ÔåÆ `archived`) is always allowed (`can_move`, `:76-77`) and `PATCH` status `archived` calls `archive_task` (`plugin_api.py:636-637`), which refuses a second archive (`kanban_db.py:3982`).

Legal unarchive destinations, and only these: `triage`, `todo`, `ready` (`kanban_workflow.py:136`). `can_move` returns false for archived ÔåÆ scheduled, running, blocked, review, done.

The existing test `tests/plugins/test_kanban_workflow_matrix.py` requests every srcÔåÆdst pair through `PATCH /tasks/{id}` on a parentless task and asserts the server agrees with `can_move` (`:71-93`), including `archived` as a source (`:65-66`, `:71`). Re-run from this worktree with the install interpreter `C:/Users/nachi/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe -m pytest tests/plugins/test_kanban_workflow_matrix.py -q --tb=line` ÔåÆ `10 passed in 21.79s`. Temp db only. No production write.

Known redirect, not an unarchive path and not an illegal reverse: `review` ÔåÆ `todo` lands in `ready` on a parentless task (`test_kanban_workflow_matrix.py:26`, `kanban_workflow.py:132-133`). That requested pair is not a landed pair. Ops must label the landed status. R46 Undo does not reverse it through PATCH (`action-contracts.md` section 6b).

Unarchive is `PATCH` status to one of the three legal targets. There is no `/unarchive` route. Do not send `running`. Do not call `DELETE`.

## Cuts this ledger records

| Row | What is cut | What is not cut | Reason |
|---|---|---|---|
| O16 | kanban `workflow_template_id` as a pipeline catalog | cron `POST .../trigger` | column is unused by the kernel; no template GET |
| O60 | Steps n/m | `current_step_key` text when non-null | no step-count source |
| O66 | task chip discovered from a kanban runÔåÆsession join | gateway `session_id`; chip when the task id is already known | `task_runs` has no `session_id` |
| O67 | `TASK-NNN` display | link `t_[0-9a-f]{8}` | generator is `t_` + 8 hex |
| G28 | filter expression | webhook list and `events` | create and list schemas have no filter |
| G61 | kanban workflow templates section | cron blueprints | same catalog failure as O16 |
| G70 | the row (author avatar and relative Updated) | other skill columns on other rows | list route has neither field |
| G82 | the row (Add all / starter packs) | single-skill hub install, which is G72 Browse, not G12 | no bundle resource |
| R34 | the row | nothing on this citation | only source failed |

Not cut inside this 20-id set: O41, O56, O58, O64, G27, G68, G84, R4, R23, R42, R57.

R23 stays Adapt. Its dynamic signature stays pending. That pending state is a blocker, not a Cut, and not a PASS of implementation.

## Bundle impact outside the 20-id set

This section is not a verify heading. A parser that collects `### <id>` must still see exactly the 20 names in the header. G10 and G72 are not in SPEC section 12.6. They are the Adapt rows whose cited feature depends on the bundle resource G82 already failed.

Scan of SPEC section 12.8 for bundle / starter / Add all / hub: only G10, G72, G82. No other matrix id cites that resource. W12's "packs row" is the same G10 feature, not a separate id.

| ID | Paper | r2 disposition | What is cut | What survives | Reason |
|---|---|---|---|---|---|
| G10 | Adapt | Cut | the row: starter packs and Add all | nothing on this citation. Single-skill install is G72, not a pack. | `GET /api/skills/hub/official` is a flat skill list (`skills.py:123-141`). `POST /api/skills/hub/install` takes one identifier (`:97-103`). No pack resource. Same failure as G82. No bundle endpoint is proposed. |
| G72 | Adapt | Adapt, partial cut | starter-pack metadata, including "8 skills" and "2.4k installs" | Browse library | SPEC already said install counts only if the hub reports them. Official payload fields are name, description, source, identifier, trust_level, repo, tags (`skills.py:77-81`). No install count. Browse is `EmbeddedHubPicker` (`apps/desktop/src/app/capabilities/skills/embedded-hub-picker.tsx`) plus the flat hub list. Install contract is `action-contracts.md` hub/install. |

G10 is a full-row flip. G72 is not. Flipping G72 would hide the surviving picker. Coverage arithmetic is `coverage.md`. Do not force the r1 total 213/230.

## Blockers (not cuts)

- Gated REST and JSON-RPC bodies were not read. No session token was loaded. 401 is an auth gate, not a routing result.
- R23 dynamic signature. Isolated Desktop does not reach a PTY and an Ops root together. P0 exit is not signed.
- `GET /api/plugins/kanban/events/stream` (A7) is absent. Existing push is the kanban WebSocket. Not this ledger's verify set.
- Live `:9119` was not treated as the Hermes dashboard. No production keypress. No kanban write.

## Source discrepancies (do not edit SPEC)

- G27 / D9: `origin` is delivery metadata, not the owning profile. Owning profile is the jobs.json home, stamped `profile`.
- `approval.received` is an ACK (`tui_gateway/methods_prompt.py:1193` ÔåÆ `ack_gateway_approval`, `tools/approval.py:210-217`). It does not settle. Settlement is `resolve_gateway_approval` (`approval.py:139-173`) via `approval.respond` or `POST /v1/runs/{id}/approval`. A second click after pop returns 0 and the HTTP path answers 409 `approval_not_pending`. An ACK never retires a pending. Action contract: `action-contracts.md` section 3.2.

## P0-01 live probe log (no credentials)


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

## P0-01 original record (kept verbatim, headings demoted)

#### P0-01 header

Status: documentation only. Round 3 keeps the round-2 repairs (gateway `session_id`/`usage`, ACK-vs-settlement, O66 cut limited to the kanban join). Rows assigned to this card: O16, O41, O56, O58, O60, O66, O67, G28, G61, G68, G70, G84, R4, R34.
SHA of the handlers: `865ba906c1a`. Contracts: `apps/desktop/docs/ops-panel/read-contracts.md`.
A failed cited source is a proposed Cut. An unread live payload is a blocker for live confirmation, not a fake verify. Handler inspection is the existence evidence.

Other SPEC section 12.6 verify rows (O64, G27, G82, R23, R42, R57) are not this card. Coverage is not recomputed here. Recomputing 85.2% without those rows would invent a number.

#### Cuts this card proposes

| Row | What is cut | What is not cut |
|---|---|---|
| O16 | kanban `workflow_template_id` as a pipeline catalog | cron trigger handler; workflow-studio as its own API if a later row cites it |
| O60 | Steps n/m | `current_step_key` text when non-null |
| O66 | task chip discovered from a kanban runÔåÆsession join | gateway `session_id` on `GET /v1/runs/{id}` (verified); profile chip passed explicitly; task chip when the task id is already the opener |
| O67 | `TASK-NNN` display | link `t_[0-9a-f]{8}` |
| G28 | filter expression | webhook subscription list and `events` |
| G61 | kanban workflow templates section | cron blueprints |
| G70 | author avatar and relative Updated | skill name, description, category, provenance |
| R34 | the whole row | nothing on this citation |

Not cut: O41, O56, O58, G68, G84, R4.

#### Blockers (not verified, not cuts)

- Gated REST and JSON-RPC response bodies on the live Desktop serve. Auth gate returns 401 before routing. Token was not loaded, so no redacted payload exists for `/api/profiles`, `/api/skills`, `/api/cron/jobs`, `/api/webhooks`, `/api/providers/oauth`, kanban board, or workflow-studio.
- `:9119` is not the Hermes dashboard in this session. SPEC section 0 said it was down; it is still not the FastAPI app.
- Global coverage percentage. Six verify rows are outside this card.

#### Source discrepancy (do not edit SPEC)

SPEC ┬º1 (line 52), ┬º3.2 (line 94), and R36 (line 656) name `approval.received` next to settlement: live-update invalidation, "Resolved elsewhere", and a Resolved-tab history. The handler does not do that.

`approval.received` (`methods_prompt.py:1193`) calls `ack_gateway_approval` (`approval.py:210-217`), which sets `acknowledged=True` and leaves the entry queued. The call that pops and settles is `resolve_gateway_approval` (`approval.py:139-173`).

This card records the mismatch. It does not edit SPEC. It does not invent a universal resolution event. The contract in `read-contracts.md` ┬º4.6 and ┬º6 uses the real signals: `approval.respond` `resolved>0`, HTTP 409 `approval_not_pending`, SSE `approval.responded`, push `approval.cancelled`, or a re-read of `approval.pending`. An ACK never retires a pending.

#### Self-check against the card acceptance

- Documentation only. No config write, no mutation, no adapter code.
- Read routes and event sources from SPEC sections 3-5 and 12.8 are in `read-contracts.md` section 11, including proposed A1-A4/A7. O24 `command_allowlist`, G5 `store/free-tier*`, R2 `kanban_notify_subs`, and `/links` (embedded, no GET) are inventoried there.
- Read-contract axes are labeled, or `inherited exact ┬ºX` / `none` / `not exposed` / `proposed`. This file does not claim live-payload exhaustivity and does not claim a schema audit of every SPEC sentence. A 230/230 id match is a name classification. An axis that could not be read from source or from an exact inheritance is `incomplete`. Round 4 marks only: A2 cache TTL, the kanban per-run store (O66 join absent), the board of an unqualified kanban id on the proposed A2 path, A7 SSE freshness, and an A7 tenant filter. No other axis is marked `incomplete`. Gated JSON bodies remain a blocker, not a verify.
- These 14 rows are resolved above with file locations. O66's Cut is the kanban join only. Gateway `session_id` and terminal `usage` are verified, with null/provenance and no double count. Live bodies that need a token are blockers, not verifies.
- Failed sources are proposed Cuts with reasons. Inaccessible live payloads stay blockers.
- Delegation is separated from live sub-agents. Null usage keeps provenance, including gateway zeros vs a missing key. A3 ownership, expiry, status, and respond dedupe are specified. `approval.received` is an ACK and does not drop a pending. Not implemented.
- A1 mixed gate is one policy, and the single-input table is the same policy. Old running + fresh gateway-up is stale (rule 2), not idle. Old (>5s) gateway-up with no work is unknown (rule 4), not stale. Old authoritative-empty is unknown, not stale and not idle. `observed_at` is a successful observation. `updated_at` is `event_at`. No adapter and no run was created to test it.
