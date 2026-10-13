# Ops panel source verification (P0-02)

Status: documentation only. No production write, no keypress, no new route.
Handlers re-checked on `feat/ops-panel` `005b104a506`. Non-doc tree is byte-identical to `865ba906c1a` (`git diff --stat 865ba906c1a..HEAD` outside `apps/desktop/docs` is empty). Line numbers below are that tree.
P0-01's ledger is not on this branch. The rows it owned were re-read here. Do not treat an unmerged `ops/P0-01` file as this ledger.

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

### O16 Workflow pipelines + Run — partial Cut

Cited: `/api/cron/jobs/{id}/trigger`; workflow-studio; kanban `workflow_template_id`.

- Cron Run now: `hermes_cli/web_routers/cron.py:729` `trigger_cron_job`. 409 if already claimed (`cron.py:642`).
- `workflow_template_id` is a nullable column (`hermes_cli/kanban_db.py:796`). No template table, no template GET. `GET /api/plugins/kanban/workflow` is the status-column machine, not a catalog.
- workflow-studio is an external plugin tree, not this column. Do not alias it onto this row.

Cut the kanban-template mapping. Keep cron trigger as its own action (`action-contracts.md`). Reason: displaying template ids as pipelines would show a client-written string with no step definition.

### O41 Agent autonomy — verified Adapt

`approvals.mode` is a schema select of `manual`, `smart`, `off` (`hermes_cli/web_server_config.py:143`). Orbit labels Ask first / Safe / Full have no matching values. The Adapt is the three real modes. Live `config.get` was not called. Not a Cut. P2 does not govern this key.

### O56 Coloured profile sigil — verified Adapt

`themes/profile-theme` does not exist. Colour is `profileColor` (`apps/desktop/src/lib/profile-color.ts:21`): HSL from the name; `default` and empty return null. Overrides are client state, not `GET /api/profiles`. Not a Cut. Use the local override, else the hash, else neutral for default.

### O58 Composer routing line — verified

`triage` is a column (`hermes_cli/kanban_workflow.py:116`). `POST /tasks` accepts `triage: bool = False` (`plugins/kanban/dashboard/plugin_api.py:417`). Honest line: assigned profile, or "Unassigned — triage" when create sets `triage: true` or status is `triage`. Do not say "routes to the right agent". Not a Cut.

### O60 Steps n/m — partial Cut

`current_step_key` exists (`kanban_db.py:797`). Template step count does not (same catalog failure as O16). Cut the n/m display. Show `current_step_key` when non-null, otherwise omit the steps cell. Do not invent `n` or `m`.

### O64 Dock terminal — verified Adapt, P0-04 incorporated

P0-04 merged into `feat/ops-panel` at `2ab328a9c66`. Audit: `apps/desktop/docs/ops-panel/desktop-surface-audit.md` section 2. Re-checked on this tree:

- `apps/desktop/electron/terminal-ipc.ts:326` and `:331` call `nodePty.spawn` (local shell or SSH).
- Renderer surface is `data-interactive-terminal` (`src/app/right-sidebar/terminal/instance.tsx:61`).
- Ops dock Log reuses `LogTail` (`src/components/chat/log-tail.tsx:39`). Events and Problems are not a shell.
- No `nodePty.spawn` from an Ops path.

Do not cut the existing terminal. Do not add a second one. Not a Cut of O64.

### O66 Chat task chip — partial Cut

`task_runs` has no `session_id` (`kanban_db.py:1080-1103`). `metadata` is free JSON, not a join contract. Cut a task chip discovered by looking up a session from a kanban run. If the user opened the chat from a task tab, the chip is that already-known task id. Gateway `GET /v1/runs/{id}` `session_id` is a different store (`api_server_runs.py:718`). Do not cut that field. Do not treat it as a kanban join.

### O67 Clickable task ids — partial Cut of `TASK-NNN` only

Generator: `kanban_db.py:1161` returns `"t_" + secrets.token_hex(4)`. Pattern `t_[0-9a-f]{8}`. `TASK-142` matches nothing. Adapt the chip to the real pattern and open `GET /api/plugins/kanban/tasks/{id}`. Cut the Orbit display shape only.

### G27 Schedule ownership — verified, field corrected

D9 says ownership is `origin` in `jobs.json` as the origin profile. That name is wrong. Do not edit SPEC. Record the correction.

- `cron/jobs.py:1932` stores `origin` as delivery metadata (`{platform, chat_id}`), comment: "where job was created for origin delivery".
- `cron/scheduler.py:2325` refuses to seed session vars from `job["origin"]`. It is not a sender and not a profile name.
- The job lives in one profile's `cron/jobs.json`. List annotation stamps `profile` and `profile_name` (`hermes_cli/web_server_cron.py:127-135`).
- Mutations resolve the storing profile via `_job_profile` (`cron.py:98-105`). A wrong `?profile=` hint does not write another profile's file when the server can locate the job.
- `GET /api/cron/jobs?profile=all` dedupes by id and prefers the default profile's copy (`cron.py:119-154`). Two profiles can hold the same id. The stamp on the returned row is the copy that won, not `origin`.
- `POST /api/cron/blueprints/instantiate` pops `origin` before create (`cron.py:892`) and writes into the `profile` query. Omitted `profile` defaults to the literal `"default"` (`cron.py:878`), not the launch profile. Ops must send the focused profile explicitly.

Ownership for the Schedule node is `profile` / `profile_name` on the list row, i.e. the profile directory that stores the job. Filtering the focused profile's jobs is `?profile=<name>`, not a filter on `origin`. Not a Cut.

### G28 Trigger filter — partial Cut

List summary (`hermes_cli/web_routers/ops.py:140-150`) has events, deliver, prompt, script, skills, url, secret_set, enabled. No filter. `WebhookCreate` (`web_models.py:376-386`) has no filter field. Cut the filter expression. Keep the subscription list and the `events` array. Do not invent a filter from `prompt`.

### G61 Templates lens — partial Cut

`GET /api/cron/blueprints` is real (`cron.py:858`). It is built-ins plus that profile's plugin blueprints (`cron.py:830-836`). Unknown `?profile=` is the scope's 404. It is not a kanban template catalog. Cut the "kanban workflow templates" section. Do not smuggle workflow-studio graphs in to fill it.

### G68 Skill type tag — verified Adapt

`category` is the first directory under the skills root when the relative path has at least 3 parts (`tools/skills_tool.py:130-141`). Otherwise null. `GET /api/skills` does not strip it (`skills.py:343-373` adds enabled, usage, provenance). It is not Backend/Design/Frontend/Workflow. Render the path category, or nothing. Do not map null to "Workflow".

### G70 Author and Updated — Cut

List payload has no `author` and no mtime. The list route does not parse SKILL.md frontmatter. File mtime would be a new field. This slice does not add one. Cut author avatar and relative Updated. Name, description, path-category, enabled, provenance remain on other rows.

### G82 Add all — Cut

SPEC: if the hub has no bundles, cut this. The hub has no starter-pack bundles.

- `GET /api/skills/hub/official` returns a flat `{skills: [...]}` of `official/<category>/<skill>` (`skills.py:123-141`).
- `GET /api/skills/hub/search` and `/sources` return skills and source ids, not packs.
- `POST /api/skills/hub/install` takes one `identifier` (`web_models.py:423-425`, `skills.py:97-103`).
- "bundle" in `hermes_cli/skills_hub.py` is one skill's fetched files, not a multi-skill pack.
- No `starter pack` / `Add all` route in this tree. `reference-index.md` already says Add all was not given a contract.

Cut the row. Reason: there is nothing to list in the confirm dialog, and inventing a client-side "install every search hit" would not be the hub bundle SPEC asked for. Single-skill hub install is not this row and is not G12 (G12 is `POST /api/skills` create/open). It is the Browse install, contracted in `action-contracts.md` and kept on G72. G10, which is the starter-pack row that required the same bundle, is Cut outside this 20-id set. See the crosswalk below. Do not add a `### G10` heading here.

### G84 Provider auth status — verified Adapt

`GET /api/providers/oauth` builds a status card with `logged_in` and `token_preview` (`hermes_cli/web_routers/oauth.py:356-361`). Ops must drop `token_preview`. Non-OAuth key presence is `GET /api/env` `is_set` only; ignore `redacted_value`. P2 filtering is not in this handler. The picker filters. Not a Cut. Live body not read.

### R4 Projects — verified Adapt

Schema `hermes_cli/projects_db.py:29-42` has `projects.archived` and `project_folders`, no favourites column. JSON-RPC `projects.list` (`tui_gateway/methods_projects.py:81`), `projects.create` (`:91`), `projects.archive` (`:104`).

Write axes are in `action-contracts.md` section 6b, not repeated as a 21st ledger heading: create body `ProjectsCreateParams`, archive body `ProjectsArchiveParams`, profile-scoped `projects.db`, JSON-RPC errors 5061/5062/5063, favourites local (storage none, event none). `projects.delete` is not bound. Live RPC was not called. Not a Cut.

### R23 Key ownership — documentary verified, dynamic signature pending

P0-04 audit, incorporated, not re-litigated:

- Contract: `apps/desktop/docs/ops-panel/keymap.md`. Judge `t_73d5bd69` PASS r3 and meta `t_c20823a8` PASS r3 accepted the document at `eaa0f8e1451`. Sandhi merged that document at `2ab328a9c66`.
- Active only on DOM focus inside `[data-ops-root]`, not hover, and outside editables. No single-key approve. `handleApprovalKey` accepts only Enter and Escape (`approval-keys.ts:35`). `P` stays undefined.
- `/` focuses the Ops rail filter only in that focused state. Composer slash is unchanged when the composer is focused.
- Ctrl+J stays `view.toggleRightSidebar` (`mod+j`). Direct Ctrl+W evidence is `apps/desktop/electron/main.ts:6953-6970` (`close-tab` → `preventDefault` → `sendClosePreviewRequested`). The keymap doc nit that cites `terminal-context-menu.ts` for that claim is non-blocking; this line is the main-process claim.
- Bounded requirements not in code yet, owner P0.5: BR-CLOSE, BR-DISPATCH, BR-ESC-CAPTURE / REGISTER / TIE / SKIP, BR-FOCUS-SURFACE. `focusedInteractiveTerminalOwnsWordErase` and `routeCloseTabChord` are not in the tree.

Do not consume an older "unresolved=0" comment as a signature. Documentary contract: verified. Dynamic PTY+Ops innermost-only signature: not signed. Named blocker: isolated Desktop stops at the onboarding veil, with no provider, sessions, PTY, or Ops root (sandhi on this card, judge r3). This is not a Cut of R23. It is a phase-exit blocker. P0 exit is not signed.

### R34 Project templates — Cut

The only cited source is kanban workflow templates. That source failed (O16, G61). Cut the row. Do not alias cron blueprints or workflow-studio graphs onto it.

### R42 Reorder within a column — verified Adapt, gesture disabled

`tasks.priority` is `INTEGER DEFAULT 0` (`kanban_db.py:953`). `PATCH /tasks/{id}` sets it (`plugin_api.py:703-704`) and `edit_task` writes a `reprioritized` event (`kanban_db.py:3242-3243`). Board order is `priority DESC, created_at ASC` (`kanban_db.py:1582`). There is no `position`, `order_index`, or sort-key column in `SCHEMA_SQL`.

Priority is a rank with ties. It is not a drag-order. Rewriting neighbors' priorities on drop would change importance, not position. Within-column drag reorder is disabled. Priority remains a picker (R39), not a reorder gesture. "land" plays only on a successful cross-column drop. A rejected drop snaps back with the 409 reason (`plugin_api.py:649`). Not a new Cut: the row already says disable when there is no order field. The order field is absent. The priority field is present and is not that order field.

### R57 Unarchive — verified Adapt

`archived` is a filter, not a column (`kanban_workflow.py:27-28`). Archiving (any non-archived source → `archived`) is always allowed (`can_move`, `:76-77`) and `PATCH` status `archived` calls `archive_task` (`plugin_api.py:636-637`), which refuses a second archive (`kanban_db.py:3982`).

Legal unarchive destinations, and only these: `triage`, `todo`, `ready` (`kanban_workflow.py:136`). `can_move` returns false for archived → scheduled, running, blocked, review, done.

The existing test `tests/plugins/test_kanban_workflow_matrix.py` requests every src→dst pair through `PATCH /tasks/{id}` on a parentless task and asserts the server agrees with `can_move` (`:71-93`), including `archived` as a source (`:65-66`, `:71`). Re-run from this worktree with the install interpreter `C:/Users/nachi/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe -m pytest tests/plugins/test_kanban_workflow_matrix.py -q --tb=line` → `10 passed in 21.79s`. Temp db only. No production write.

Known redirect, not an unarchive path and not an illegal reverse: `review` → `todo` lands in `ready` on a parentless task (`test_kanban_workflow_matrix.py:26`, `kanban_workflow.py:132-133`). That requested pair is not a landed pair. Ops must label the landed status. R46 Undo does not reverse it through PATCH (`action-contracts.md` section 6b).

Unarchive is `PATCH` status to one of the three legal targets. There is no `/unarchive` route. Do not send `running`. Do not call `DELETE`.

## Cuts this ledger records

| Row | What is cut | What is not cut | Reason |
|---|---|---|---|
| O16 | kanban `workflow_template_id` as a pipeline catalog | cron `POST .../trigger` | column is unused by the kernel; no template GET |
| O60 | Steps n/m | `current_step_key` text when non-null | no step-count source |
| O66 | task chip discovered from a kanban run→session join | gateway `session_id`; chip when the task id is already known | `task_runs` has no `session_id` |
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
- `approval.received` is an ACK (`tui_gateway/methods_prompt.py:1193` → `ack_gateway_approval`, `tools/approval.py:210-217`). It does not settle. Settlement is `resolve_gateway_approval` (`approval.py:139-173`) via `approval.respond` or `POST /v1/runs/{id}/approval`. A second click after pop returns 0 and the HTTP path answers 409 `approval_not_pending`. An ACK never retires a pending. Action contract: `action-contracts.md` section 3.2.
