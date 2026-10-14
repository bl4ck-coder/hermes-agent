# Ops panel release evidence (P5 task 3)

Generated 2026-10-13 ART from SPEC §12.8 (230 rows). Screenshots: live GUI/screenshot checks waived by Nacho; real-data screenshots are therefore NOT attached. Evidence = jsdom/integration tests named per row.

Totals: Built 16, Cut 14, NOT VERIFIED 192, Not built 2, Partial 6

Status values: Built (acceptance covered by the named test), Partial (gap stated), Not built, Cut (reason kept), NOT VERIFIED (no Ops-panel work or evidence yet).

| ID | Disposition | Status | Acceptance line | Evidence |
|---|---|---|---|---|
| O1 | Adapt | Built | Orrery with sandhi at the centre, 3 rings, cap 8 + overflow | src/app/ops/office/office.test.tsx |
| O2 | Keep | Built | Agent card tab (presence, model, policy, runs, needs-you) | src/app/ops/detail/details.test.tsx |
| O3 | Adapt | Built | Dispatch composer creates a kanban task, @assignee parsed | src/app/ops/office/office.test.tsx, feed/ops-data.test.ts |
| O4 | Adapt | NOT VERIFIED | Chips = recent task templates/workflow_template_id and cron blueprints |  |
| O5 | Keep | Partial | Needs-you table, one-click Approve for jsonrpc items; kanban/cron origins listed read-only | src/app/ops/office/office.test.tsx |
| O6 | Keep | Built | In flight = running board column | src/app/ops/office/office.test.tsx |
| O7 | Keep | Partial | Activity = resolved approvals; task_events feed not wired | src/app/ops/office/office.test.tsx |
| O8 | Adapt | NOT VERIFIED | The toast preview is truncated. One-click Approve is allowed only when the full command and args fit unabridged; otherwise show [Review], which focuses the card |  |
| O9 | Adapt | Built | Lenses deep-link existing Desktop routes | src/app/ops/navigation.test.tsx |
| O10 | Keep | Built | Rail Fleet with presence (P0.5) | src/app/ops/navigation.test.tsx |
| O11 | Keep | NOT VERIFIED | Badge on Office rail item |  |
| O12 | Keep | NOT VERIFIED | Board filter + Projects lens |  |
| O13 | Keep | Built | Orrery/Table switch | src/app/ops/office/office.test.tsx |
| O14 | Adapt | NOT VERIFIED | New profile = Canvas 'New' (clone-from) |  |
| O15 | Keep | Partial | Board + Add per column; no assignee picker | src/app/ops/board/board.test.tsx |
| O16 | Adapt | NOT VERIFIED | Workflow templates (kanban workflow_template_id) + cron 'Run now' |  |
| O17 | Adapt | NOT VERIFIED | Task attachments + workspace files |  |
| O18 | Adapt | NOT VERIFIED | O18 = the Desktop sessions list scoped to the profile. O20 = the Activity lens (link it to R26). |  |
| O19 | Adapt | NOT VERIFIED | Tokens show null as "" with provenance until A2 exists |  |
| O20 | Adapt | NOT VERIFIED | O18 = the Desktop sessions list scoped to the profile. O20 = the Activity lens (link it to R26). |  |
| O21 | Keep | Built | Inspector Fleet (P0.5) | src/app/ops/navigation.test.tsx |
| O22 | Adapt | NOT VERIFIED | Inspector 'Context' for selected task/agent; secrets shown set/unset only |  |
| O23 | Adapt | Built | Run footer hidden without focus (P0.5) | src/app/ops/navigation.test.tsx |
| O24 | Keep | NOT VERIFIED | Agent card |  |
| O25 | Cut | Cut | No fake states (no mock data rule) | reason kept |
| O26 | Adapt | NOT VERIFIED | For bot profiles, Message must open the canonical "Bot Chat" (identified by profile + title, no stored session id); otherwise a side-chat |  |
| O27 | Adapt | NOT VERIFIED | Workflow steps (current_step_key) + child tasks via task_links |  |
| O28 | Keep | NOT VERIFIED | Task timeline |  |
| O29 | Adapt | NOT VERIFIED | Steer/Stop, Approve, Comment, Unblock (+reclaim) |  |
| O30 | Keep | NOT VERIFIED | Timeline expand/collapse |  |
| O31 | Keep | Built | Tab strip with pinned Office/Canvas/Board (P0.5) | src/app/ops/navigation.test.tsx |
| O32 | Adapt | NOT VERIFIED | Reuse Desktop chat; Ops opens it scoped to profile |  |
| O33 | Adapt | NOT VERIFIED | Diff of task worktree via Desktop git review |  |
| O34 | Keep | NOT VERIFIED | Attachment/markdown preview |  |
| O35 | Adapt | NOT VERIFIED | Run log panel (worker log) |  |
| O36 | Adapt | NOT VERIFIED | Show branch only when the focused task has a worktree |  |
| O37 | Cut | Cut | No mock data | reason kept |
| O38 | Adapt | NOT VERIFIED | Register an "Ops" palette page and commands in the existing cmdk palette; do not build a second palette |  |
| O39 | Keep | Built | Motion Full/Reduced/System persisted + prefers-reduced-motion | src/app/ops/motion/motion.test.tsx |
| O40 | Adapt | Partial | Default model shown + policy source; model write via Canvas model node (A5/A6) | src/app/ops/motion/motion.test.tsx, canvas/node-editor-view.test.tsx |
| O41 | Adapt | Not built | Shows Not available yet (no approvals.mode source) | src/app/ops/motion/motion.test.tsx |
| O42 | Adapt | Not built | Shows Not available yet (env names not wired) | src/app/ops/motion/motion.test.tsx |
| O43 | Adapt | Built | Shortcut sheet (OpsShortcutSheet) also reachable from Settings | src/app/ops/motion/motion.test.tsx |
| O44 | Adapt | Built | Rail full/icons/hidden (P0.5) | src/app/ops/navigation.test.tsx |
| O45 | Keep | NOT VERIFIED | Connection / profile / view breadcrumb |  |
| O46 | Adapt | NOT VERIFIED | Real-event-driven pulse; streaming only from SSE |  |
| O47 | Keep | Partial | Unsaved Canvas draft marked in the editor; tab-strip dot not wired | src/app/ops/canvas/node-editor-view.test.tsx |
| O48 | Keep | NOT VERIFIED | Lucide kind icons, overflow chevron menu, Ctrl+Tab to cycle, Ctrl+W closes non-pinned tabs |  |
| O49 | Adapt | NOT VERIFIED | Lenses open as closable tabs, so Board, Runs and Skills can stay open together |  |
| O50 | Adapt | NOT VERIFIED | Chip shows the focused profile's effective default model. The menu lists P2-allowlisted models only. A write goes through the A5/A6 transaction |  |
| O51 | Keep | Built | [ and ] toggles (P0.5) | src/app/ops/navigation.test.tsx |
| O52 | Keep | NOT VERIFIED | Centred "Search Ops" trigger that opens the Desktop palette |  |
| O53 | Keep | NOT VERIFIED | Rail headers OPS / LENSES / FLEET  N online |  |
| O54 | Keep | Built | Fleet rows ordered, idle folded (P0.5) | src/app/ops/navigation.test.tsx |
| O55 | Keep | NOT VERIFIED | kbd hints on rail items (G O, G C, G B, Ctrl+,) |  |
| O56 | Adapt | NOT VERIFIED | Deterministic profile sigil: monogram on a gold-tint disc hashed from the profile name. Use the profile's colour if one exists |  |
| O57 | Adapt | NOT VERIFIED | Drift runs only while A1 reports live runs. Halo intensity = active-run count. No idle blink (decorative only). Static under reduced motion |  |
| O58 | Adapt | NOT VERIFIED | Honest routing line: "Assigned to X", or "Unassigned triage" only if kanban triage exists. Keep the kbd hint |  |
| O59 | Keep | NOT VERIFIED | Columns: Agent, Kind, Waiting on, Age, Why , Actions |  |
| O60 | Keep | NOT VERIFIED | In-flight and Board Table. Show Steps n/m only when the template's step count is known, otherwise show the step key |  |
| O61 | Keep | NOT VERIFIED | Map task_events.kind to a verb and take the target from the payload |  |
| O62 | Adapt | NOT VERIFIED | Blocked toast offers only [Open], because Unblock needs a note. It never takes focus. Dismissal is stored per item id |  |
| O63 | Adapt | NOT VERIFIED | Subtitle = task title, approval summary, or sub-state. Bar = step i/n when known, otherwise an indeterminate hairline (never fake progress). Selection is synced across rail, orrery and inspector |  |
| O64 | Adapt | NOT VERIFIED | Ops dock with Log (worker-log tail), Events (run SSE) and Problems(n) (policy, cron failures, validation, 401). Interactive terminal is cut unless Desktop already has one (verify) |  |
| O65 | Keep | NOT VERIFIED | Ops statusbar item group. Tokens = today's total, with a provenance tooltip |  |
| O66 | Adapt | NOT VERIFIED | A chat opened from Ops shows a task chip and a profile chip |  |
| O67 | Adapt | NOT VERIFIED | Kanban task ids are auto-linked in the transcript and open a task tab |  |
| O68 | Keep | NOT VERIFIED | Already in Desktop chat. Reuse it; no Ops copy |  |
| O69 | Adapt | NOT VERIFIED | Handled by the Desktop composer; Ops only passes the profile scope |  |
| O70 | Keep | NOT VERIFIED | Task timeline. Exit code and duration come from tool-result payloads |  |
| O71 | Adapt | NOT VERIFIED | Handoff = reassign event, child-task link, or delegate_task spawn |  |
| O72 | Adapt | NOT VERIFIED | Inline [Approve][Deny][Comment]: one click (D3), full args shown |  |
| O73 | Adapt | NOT VERIFIED | Snippet built from patch/write_file tool args. Open git review |  |
| O74 | Adapt | NOT VERIFIED | Run-failure block from task_runs.error/outcome, with CTAs [Unblock] and [Retry  ready] |  |
| O75 | Cut | Cut | Security §7 | reason kept |
| O76 | Adapt | NOT VERIFIED | Role = first clause of the profile description |  |
| O77 | Adapt | NOT VERIFIED | Sub-states of "working", taken from live events: thinking, tool:<name>, done (fades to idle after 10 s). No state is shown without an event behind it |  |
| O78 | Adapt | NOT VERIFIED | Idle scheduled profiles show "Next run 18:00" |  |
| O79 | Keep | NOT VERIFIED | Ops settings rows keep the same promise |  |
| O80 | Keep | Built | Ops settings opens as a lens tab | src/app/ops/live-panels.test.tsx |
| O81 | Keep | NOT VERIFIED | One A1 query key feeds every surface; no surface derives its own copy |  |
| O82 | Keep | Partial | Run tab shows active run; no Runs lens row link | src/app/ops/detail/details.test.tsx |
| O83 | Cut | Cut | Single local user | reason kept |
| O90 | Adapt | NOT VERIFIED | With 36 profiles, toasts need a queue. Show at most 1 per kind, plus a "+n more → Needs-you" chip. Toasts never take focus. |  |
| G1 | Adapt | NOT VERIFIED | Office Dispatch composer empty state |  |
| G2 | Adapt | NOT VERIFIED | P2-filtered picker (Anthropic*, gpt-6.1-sol, grok-4.7) |  |
| G3 | Adapt | NOT VERIFIED | Delegated to Desktop chat |  |
| G4 | Adapt | NOT VERIFIED | Cron blueprints as cards |  |
| G5 | Adapt | NOT VERIFIED | No quota source exists. Use the free-tier/billing status where present, otherwise a user-set budget in Ops settings compared with real usage |  |
| G6 | Adapt | NOT VERIFIED | Channels & MCP lens: embedded CapabilitiesView + Messaging view (category rail, All/Connected, search) |  |
| G7 | Adapt | NOT VERIFIED | Per-card connection state; Connect = existing onboarding/OAuth flows; Manage = open server/platform config |  |
| G8 | Cut | Cut | N/A | reason kept |
| G9 | Cut | Cut | No mock data | reason kept |
| G10 | Adapt | NOT VERIFIED | Skill hub bundles as starter packs; "Add all" installs into the scoped profile (with A5 backup) |  |
| G11 | Adapt | NOT VERIFIED | The Type, Author and Updated sources are unverified (see G68/G70) |  |
| G12 | Keep | NOT VERIFIED | Create / open skill editor |  |
| G13 | Adapt | NOT VERIFIED | Must not duplicate Desktop's profile groups or Bot roster in the sidebar |  |
| G14 | Keep | NOT VERIFIED | Palette |  |
| G15 | Adapt | NOT VERIFIED | Channels library entry |  |
| G16 | Adapt | NOT VERIFIED | Command Center  usage section |  |
| G17 | Keep | NOT VERIFIED | Rail collapse persisted |  |
| G18 | Adapt | NOT VERIFIED | Gold Night default + Desktop themes |  |
| G19 | Cut | Cut | N/A | reason kept |
| G20 | Adapt | NOT VERIFIED | Breadcrumb + Save (per node) + Export profile as Share |  |
| G21 | Adapt | NOT VERIFIED | Run panel: 'Test run' a profile prompt via gateway run, live stream |  |
| G22 | Keep | NOT VERIFIED | Live elapsed + tokens |  |
| G23 | Keep | NOT VERIFIED | Tool-call list from run events |  |
| G24 | Adapt | NOT VERIFIED | Use live delegated subagents, which Desktop already tracks. A4 covers configured delegation only |  |
| G25 | Adapt | NOT VERIFIED | Stop + Steer follow-up; attach cut |  |
| G26 | Keep | NOT VERIFIED | Collapse run panel |  |
| G27 | Adapt | NOT VERIFIED | Ownership = job origin profile (D9) |  |
| G28 | Adapt | NOT VERIFIED | Show a filter expression only if the webhook model has one (verify) |  |
| G29 | Keep | NOT VERIFIED | Channels node |  |
| G30 | Keep | NOT VERIFIED | Memory node |  |
| G31 | Keep | NOT VERIFIED | Identity node |  |
| G32 | Adapt | NOT VERIFIED | No owner field exists. Owner = last writer from the A5 manifest; version = backup sequence |  |
| G33 | Adapt | NOT VERIFIED | Outglow "tools" are connectors. In Hermes they are toolsets plus the profile's enabled MCP servers |  |
| G34 | Adapt | NOT VERIFIED | Delegation node read-only |  |
| G35 | Keep | NOT VERIFIED | Skills node |  |
| G36 | Keep | NOT VERIFIED | Model node w/ P2 picker |  |
| G37 | Keep | NOT VERIFIED | Collapse nodes |  |
| G38 | Adapt | NOT VERIFIED | The screenshots colour ports by state, not edges by kind (see G49) |  |
| G39 | Keep | NOT VERIFIED | Zoom + fit + pan |  |
| G40 | Keep | NOT VERIFIED | Badges: New (changed since last backup), Unset, Policy |  |
| G41 | Adapt | NOT VERIFIED | Nodes must never animate in on load (that was the replay). They only light up on real run events |  |
| G42 | Adapt | NOT VERIFIED | Every child item opens a detail popover |  |
| G43 | Adapt | NOT VERIFIED | Header = profile pill plus prompt. Stop asks for confirmation |  |
| G44 | Adapt | NOT VERIFIED | Tool-call tree. Each call goes from spinner to  or , shows the toolset icon and its duration |  |
| G45 | Keep | NOT VERIFIED | GlyphSpinner "breathe" plus ActivityTimerText. When tokens are null, show "" |  |
| G46 | Keep | NOT VERIFIED | Steer send-gating |  |
| G47 | Keep | NOT VERIFIED | Gold dot grid at 6% |  |
| G48 | Keep | NOT VERIFIED | Fixed layout: left = inputs, centre = Identity / Prompt / Model, right = Tools / Skills / Delegation. No free-form layout in v1 |  |
| G49 | Adapt | NOT VERIFIED | Port colour = node state: gold = changed since backup, amber = unset, garnet = policy/validation, champagne = ok. Unset edges are dashed |  |
| G50 | Adapt | NOT VERIFIED | Tint = changed since the last backup |  |
| G51 | Adapt | NOT VERIFIED | The unset CTA opens the real setup flow |  |
| G52 | Keep | NOT VERIFIED | Prompt node: wheel scrolls the node, not the canvas. Edit appears on hover or focus and is reachable by keyboard |  |
| G53 | Adapt | NOT VERIFIED | Lucide icon per kind, platform logo for channels |  |
| G54 | Adapt | NOT VERIFIED | Per-node skeleton tied to that node's own query, with independent failure |  |
| G55 | Keep | NOT VERIFIED | Bottom-centre zoom plus a Fit () button |  |
| G56 | Keep | NOT VERIFIED | Keep pan. The bug must not carry over: overlays never intercept node controls |  |
| G57 | Keep | NOT VERIFIED | Per-node Save plus a header "Save all (n)", disabled at 0 |  |
| G58 | Adapt | NOT VERIFIED | Connection  profile switcher, with a "read-only" badge on remote connections |  |
| G59 | Adapt | NOT VERIFIED | Typing filters Fleet and lenses inline; K opens the palette |  |
| G60 | Adapt | NOT VERIFIED | "N more"  Fleet table |  |
| G61 | Adapt | NOT VERIFIED | Templates lens: cron blueprints and kanban workflow templates |  |
| G62 | Adapt | NOT VERIFIED | Rail "+" opens a popover over the MCP catalog and platforms. Picking one runs the existing connect flow |  |
| G63 | Adapt | NOT VERIFIED | Reuse Desktop Capabilities  Connectors and Messaging. Ops adds only the category grouping |  |
| G64 | Cut | Cut | No source | reason kept |
| G65 | Adapt | NOT VERIFIED | Static Gold Night Hermes mark |  |
| G66 | Keep | NOT VERIFIED | Dispatch: @profile sets the assignee, #project sets the project |  |
| G67 | Adapt | NOT VERIFIED | Blueprint chips show the icons of the toolsets/platforms they use |  |
| G68 | Adapt | NOT VERIFIED | Tag = skill category, in gold-tone hue variants |  |
| G69 | Keep | NOT VERIFIED | Profile links open Canvas; +N opens a popover |  |
| G70 | Adapt | NOT VERIFIED | Author from SKILL.md frontmatter, "" if absent. Updated = mtime |  |
| G71 | Keep | NOT VERIFIED | DataTable primitive |  |
| G72 | Adapt | NOT VERIFIED | Install counts shown only if the hub reports them. Browse = existing hub picker |  |
| G73 | Adapt | NOT VERIFIED | "Profile settings" opens the profile in Canvas; org is cut |  |
| G74 | Adapt | NOT VERIFIED | Hermes update/changelog via Command Center maintenance |  |
| G75 | Keep | NOT VERIFIED | /ops/canvas/:profile, /ops/task/:id, /ops/run/:id, plus "Copy link" |  |
| G76 | Adapt | NOT VERIFIED | Gold Night app-wide default (D5); System/other themes selectable |  |
| G77 | Cut | Cut | N/A | reason kept |
| G80 | Keep | NOT VERIFIED | Same pattern in the DataTable cell. It must also be reachable by keyboard. |  |
| G81 | Keep | NOT VERIFIED | SearchField that filters by name, category and description. |  |
| G82 | Adapt | NOT VERIFIED | Install and enable the whole bundle on the focused profile, after a confirm that lists every skill. If the hub has no bundles, Cut this. |  |
| G83 | Adapt | NOT VERIFIED | "Connected" = configured MCP servers plus platforms whose credentials are set. |  |
| G84 | Adapt | NOT VERIFIED | Provider auth status (OAuth or key present: yes/no), filtered by P2. Clicking it goes to Desktop's provider setup. |  |
| G85 | Adapt | NOT VERIFIED | A Needs-you (W8) entry in the rail, with the same A3 count badge. |  |
| G86 | Adapt | NOT VERIFIED | An optional change note captured on Save and shown on the Prompt node. |  |
| G87 | Cut | Cut | /v1/runs has no time-window parameter. The window goes in the prompt text. | reason kept |
| R1 | Adapt | NOT VERIFIED | Office 'Today' strip: tasks due, cron runs next 24h, overdue (stale heartbeat) |  |
| R2 | Adapt | NOT VERIFIED | Merged into Needs-you + notify subs |  |
| R3 | Adapt | NOT VERIFIED | 'Mine' = tasks created_by/assigned to user |  |
| R4 | Adapt | NOT VERIFIED | Projects lens (read), favourites local |  |
| R5 | Adapt | NOT VERIFIED | Board overview: counts per status/profile, throughput |  |
| R6 | Keep | NOT VERIFIED | Board |  |
| R7 | Keep | NOT VERIFIED | List |  |
| R8 | Keep | NOT VERIFIED | Table |  |
| R9 | Adapt | NOT VERIFIED | Calendar of cron runs + task completions |  |
| R10 | Adapt | NOT VERIFIED | Gr8r's timeline uses start/due dates, which are cut (R14). Ours is runs startedcompleted |  |
| R11 | Adapt | NOT VERIFIED | Attachments across tasks |  |
| R12 | Keep | NOT VERIFIED | Task drawer + full-page tab |  |
| R13 | Adapt | NOT VERIFIED | Status, priority, assignee(profile), project, skills (as labels), estimate |  |
| R14 | Cut | Cut | Schema lacks fields | reason kept |
| R15 | Keep | NOT VERIFIED | Links parent/child |  |
| R16 | Keep | NOT VERIFIED | Child tasks |  |
| R17 | Adapt | NOT VERIFIED | Markdown body editor |  |
| R18 | Keep | NOT VERIFIED | Comments + events |  |
| R19 | Adapt | NOT VERIFIED | Pin (local) / move to done / back to ready |  |
| R20 | Adapt | NOT VERIFIED | Open, Duplicate, Copy deep link, Archive, Reassign; Delete cut |  |
| R21 | Adapt | NOT VERIFIED | Bulk archive done |  |
| R22 | Keep | NOT VERIFIED | Merged palette |  |
| R23 | Adapt | NOT VERIFIED | Active only inside Ops and only when focus is not in an editable field. "P" is undefined in the fusion. / must not collide with composer slash commands |  |
| R24 | Adapt | NOT VERIFIED | Search tasks + sessions + profiles |  |
| R25 | Adapt | NOT VERIFIED | Fleet = members (profiles); teams = kanban lanes/tenants; invite cut |  |
| R26 | Keep | NOT VERIFIED | Activity lens |  |
| R27 | Adapt | NOT VERIFIED | Ops settings subset (motion, default tab, date fmt); theme/accent live in Desktop settings (D5) |  |
| R28 | Cut | Cut | N/A | reason kept |
| R29 | Cut | Cut | N/A | reason kept |
| R30 | Keep | NOT VERIFIED | Gold shimmer skeletons, empty/error states, toasts |  |
| R31 | Keep | NOT VERIFIED | The row still holds a review note. Replace it with the resolved spec: 140/220/320 ms plus the 2 eases, with SPEC §6 updated. |  |
| R32 | Keep | NOT VERIFIED | Ops layout grid with one gutter |  |
| R33 | Cut | Cut | N/A | reason kept |
| R34 | Adapt | NOT VERIFIED | Workflow templates (kanban workflow_template_id) |  |
| R35 | Adapt | NOT VERIFIED | "Pinned" rail section for tasks, profiles, runs and lenses |  |
| R36 | Adapt | NOT VERIFIED | Needs-you "Resolved" tab: the last 50, with who, when and how |  |
| R37 | Adapt | NOT VERIFIED | "Seen" on review and cron items (local). Never available on approvals or policy items |  |
| R38 | Adapt | NOT VERIFIED | Review lens: tasks in review, with worktree diff |  |
| R39 | Adapt | NOT VERIFIED | Pickers offer only legal transitions; assignee uses /reassign |  |
| R40 | Keep | NOT VERIFIED | Desktop ConfirmDialog plus a New-task modal |  |
| R41 | Keep | NOT VERIFIED | Themed radix Select |  |
| R42 | Adapt | NOT VERIFIED | Reorder only if kanban has a priority/order field (verify), otherwise disabled. "land" plays on success; a rejected drop snaps back with the reason |  |
| R43 | Keep | NOT VERIFIED | @dnd-kit keyboard sensor: Space to pick, arrows to move, Space to drop (Sol #10) |  |
| R44 | Keep | NOT VERIFIED | Invariant: live updates (push, or the fallback poll) never reset scroll, focus, an open drawer or a drag in progress |  |
| R45 | Adapt | NOT VERIFIED | View choice stored per (connection, profile filter, project) |  |
| R46 | Adapt | NOT VERIFIED | Undo for move, archive and reassign within 8 s. Never for approval or stop |  |
| R47 | Keep | NOT VERIFIED | Commit on blur or Enter; Esc cancels |  |
| R48 | Adapt | NOT VERIFIED | Only on todo and ready columns |  |
| R49 | Adapt | NOT VERIFIED | Bulk reassign, archive, and move to ready |  |
| R50 | Adapt | NOT VERIFIED | Over task_runs |  |
| R51 | Keep | NOT VERIFIED | UI |  |
| R52 | Adapt | NOT VERIFIED | Groups by status and age (stale heartbeat = overdue), since there are no due dates |  |
| R53 | Keep | NOT VERIFIED | Under 1280 px the inspector overlays. Under 1024 px the rail shows icons. Under 800 px tabs become a dropdown |  |
| R54 | Adapt | NOT VERIFIED | Opt-in OS notifications on approval.pending and blocked. No focus steal |  |
| R55 | Adapt | NOT VERIFIED | "Open Ops on launch" plus default tab, checked against the Desktop startup route |  |
| R56 | Keep | NOT VERIFIED | lucide-react |  |
| R57 | Adapt | NOT VERIFIED | Archived toggle plus Unarchive |  |
| R58 | Adapt | NOT VERIFIED | Child-task progress chip on the card |  |
| R60 | Adapt | NOT VERIFIED | Recent searches on the palette's Ops page, stored locally per connection + profile. |  |
| R61 | Adapt | NOT VERIFIED | An Office header with the date and the connection, no greeting copy. |  |
| R62 | Adapt | NOT VERIFIED | A Projects lens row opens an overview (counts and throughput) filtered to that project. |  |
