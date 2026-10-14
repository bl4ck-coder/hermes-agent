# Ops panel release evidence (P5 task 3, updated P6, P7, P8 batches 1-2)

Generated 2026-10-13 ART from SPEC §12.8 (230 rows). Screenshots: live GUI/screenshot checks waived by Nacho; real-data screenshots are therefore NOT attached. Evidence = jsdom/integration tests named per row.

Totals: Built 159, Cut 25, Live-only 11, Not built 32, Partial 3

Status values: Built (acceptance covered by the named test), Partial (gap stated), Not built, Cut (reason kept), Live-only (needs a live gateway/GUI; GUI checks waived), NOT VERIFIED (none remain after P7).

| ID | Disposition | Status | Acceptance line | Evidence |
|---|---|---|---|---|
| O1 | Adapt | Built | Orrery with sandhi at the centre, 3 rings, cap 8 + overflow | src/app/ops/office/office.test.tsx |
| O2 | Keep | Built | Agent card tab (presence, model, policy, runs, needs-you) | src/app/ops/detail/details.test.tsx |
| O3 | Adapt | Built | Dispatch composer creates a kanban task, @assignee parsed | src/app/ops/office/office.test.tsx, feed/ops-data.test.ts |
| O4 | Adapt | Built | Chips = recent task templates/workflow_template_id and cron blueprints | src/app/ops/office/office-p7.test.tsx |
| O5 | Keep | Built | Needs-you actions per origin: jsonrpc Approve (full args only), review Approve/Request changes (note), blocked Unblock (note)/Open, cron Run now; server refusal shown | src/app/ops/office/needs-you.test.tsx |
| O6 | Keep | Built | In flight = running board column | src/app/ops/office/office.test.tsx |
| O7 | Keep | Built | Activity = resolved approvals with who/what/when + live task_events feed (stream reconnects with backoff, P8) | src/app/ops/feed/kanban-stream.test.tsx, src/app/ops/p8-batch1.test.tsx |
| O8 | Adapt | Built | Approval toast: Approve only when full command fits unabridged (char budget + geometry); otherwise [Review] focuses the Needs-you row | src/app/ops/office/office-toasts.test.tsx, primitives/toast-queue tests |
| O9 | Adapt | Built | Lenses deep-link existing Desktop routes | src/app/ops/navigation.test.tsx |
| O10 | Keep | Built | Rail Fleet with presence (P0.5) | src/app/ops/navigation.test.tsx |
| O11 | Keep | Built | Badge on Office rail item | src/app/ops/navigation.test.tsx |
| O12 | Keep | Built | Board filter + Projects lens | src/app/ops/lenses/lenses.test.tsx |
| O13 | Keep | Built | Orrery/Table switch | src/app/ops/office/office.test.tsx |
| O14 | Adapt | Not built | New profile = Canvas 'New' (clone-from) | Canvas has no clone-from New flow; Desktop profile creation remains the entry point |
| O15 | Keep | Built | Board + Add per column; drawer assignee picker and subtask form | src/app/ops/board/board-extras.test.tsx |
| O16 | Adapt | Partial | Cron Run now on failing jobs (Needs-you); workflow templates not built | Cron Run now built (needs-you test); workflow templates Cut: kanban /workflow exposes only the default workflow, no template source (src/app/ops/office/needs-you.test.tsx) |
| O17 | Adapt | Built | Task attachments listed in task tab; workspace files not built | src/app/ops/detail/task-actions.test.tsx |
| O18 | Adapt | Live-only | O18 = the Desktop sessions list scoped to the profile. O20 = the Activity lens (link it to R26). | Desktop sessions list reused, scoping only observable against a live gateway |
| O19 | Adapt | Built | Tokens show null as "" with provenance until A2 exists | src/app/ops/primitives/identity.test.tsx |
| O20 | Adapt | Built | O18 = the Desktop sessions list scoped to the profile. O20 = the Activity lens (link it to R26). | src/app/ops/lenses/lenses.test.tsx |
| O21 | Keep | Built | Inspector Fleet (P0.5) | src/app/ops/navigation.test.tsx |
| O22 | Adapt | Built | Inspector 'Context' for selected task/agent; secrets shown set/unset only | src/app/ops/feed/ops-actions.test.ts |
| O23 | Adapt | Built | Run footer hidden without focus (P0.5) | src/app/ops/navigation.test.tsx |
| O24 | Keep | Built | Agent card: sigil, display name, presence, model, skills, next cron, policy, runs, needs-you | src/app/ops/detail/agent-run.test.tsx, detail/details.test.tsx |
| O25 | Cut | Cut | No fake states (no mock data rule) | reason kept |
| O26 | Adapt | Live-only | For bot profiles, Message must open the canonical "Bot Chat" (identified by profile + title, no stored session id); otherwise a side-chat | Bot Chat identity resolved by Desktop chat; needs a live bot profile |
| O27 | Adapt | Built | Task tab shows current_step_key and child tasks (task_links) with add-subtask | src/app/ops/detail/task-tab.test.tsx |
| O28 | Keep | Built | Task timeline from task_events | src/app/ops/detail/task-tab.test.tsx |
| O29 | Adapt | Built | Comment, Unblock (note), Retry, Approve/Request changes built; Steer/Stop not built | src/app/ops/detail/task-actions.test.tsx |
| O30 | Keep | Built | Timeline expand/collapse all | src/app/ops/detail/task-tab.test.tsx |
| O31 | Keep | Built | Tab strip with pinned Office/Canvas/Board (P0.5) | src/app/ops/navigation.test.tsx |
| O32 | Adapt | Built | Reuse Desktop chat; Ops opens it scoped to profile | src/app/ops/split-host.test.tsx |
| O33 | Adapt | Live-only | Diff of task worktree via Desktop git review | Delegated to Desktop git review; needs a real worktree |
| O34 | Keep | Built | Attachment/markdown preview | src/app/ops/detail/task-tab.test.tsx |
| O35 | Adapt | Built | Run log panel (worker log) | src/app/ops/detail/task-actions.test.tsx |
| O36 | Adapt | Built | Branch shown only when the task has branch_name | src/app/ops/detail/task-tab.test.tsx |
| O37 | Cut | Cut | No mock data | reason kept |
| O38 | Adapt | Built | Register an "Ops" palette page and commands in the existing cmdk palette; do not build a second palette | src/app/ops/keymap.test.tsx |
| O39 | Keep | Built | Motion Full/Reduced/System persisted + prefers-reduced-motion | src/app/ops/motion/motion.test.tsx |
| O40 | Adapt | Built | Default model shown + policy source; model write via Canvas model node (A5/A6) | src/app/ops/canvas/canvas-p7.test.tsx |
| O41 | Adapt | Not built | Shows Not available yet (no approvals.mode source) | src/app/ops/motion/motion.test.tsx |
| O42 | Adapt | Built | Secret presence: names + set/unset only, never values | src/app/ops/motion/motion.test.tsx, feed/ops-actions.test.ts |
| O43 | Adapt | Built | Shortcut sheet (OpsShortcutSheet) also reachable from Settings | src/app/ops/motion/motion.test.tsx |
| O44 | Adapt | Built | Rail full/icons/hidden (P0.5) | src/app/ops/navigation.test.tsx |
| O45 | Keep | Built | Connection / profile / view breadcrumb | src/app/ops/chrome.test.tsx |
| O46 | Adapt | Built | Real-event-driven pulse; streaming only from SSE | src/app/ops/feed/ops-data.test.ts |
| O47 | Keep | Built | Unsaved Canvas draft marked in the editor; tab-strip dot not wired | src/app/ops/navigation.test.tsx |
| O48 | Keep | Built | Lucide kind icons, overflow chevron menu, Ctrl+Tab to cycle, Ctrl+W closes non-pinned tabs | src/app/ops/primitives/foundations.test.tsx |
| O49 | Adapt | Built | Lenses open as closable tabs, so Board, Runs and Skills can stay open together | src/app/ops/navigation.test.tsx |
| O50 | Adapt | Built | Chip shows the focused profile's effective default model. The menu lists P2-allowlisted models only. A write goes through the A5/A6 transaction | src/app/ops/chrome.test.tsx |
| O51 | Keep | Built | [ and ] toggles (P0.5) | src/app/ops/navigation.test.tsx |
| O52 | Keep | Built | Centred "Search Ops" trigger that opens the Desktop palette | src/app/ops/chrome.test.tsx |
| O53 | Keep | Built | Rail headers OPS / LENSES / FLEET  N online | src/app/ops/navigation.test.tsx |
| O54 | Keep | Built | Fleet rows ordered, idle folded (P0.5) | src/app/ops/navigation.test.tsx |
| O55 | Keep | Built | kbd hints on rail items (G O, G C, G B, Ctrl+,) | src/app/ops/keymap.test.tsx |
| O56 | Adapt | Built | Deterministic sigil (resolveSigil hash) on agent card | src/app/ops/detail/agent-run.test.tsx |
| O57 | Adapt | Built | Drift runs only while A1 reports live runs. Halo intensity = active-run count. No idle blink (decorative only). Static under reduced motion | src/app/ops/motion.test.ts |
| O58 | Adapt | Built | Honest routing line: "Assigned to X", or "Unassigned triage" only if kanban triage exists. Keep the kbd hint | src/app/ops/office/office-p7.test.tsx |
| O59 | Keep | Built | Needs-you columns Agent, Kind, Waiting on, Age, Why, Actions | src/app/ops/office/needs-you.test.tsx |
| O60 | Keep | Built | In-flight and Board Table. Show Steps n/m only when the template's step count is known, otherwise show the step key | src/app/ops/office/needs-you.test.tsx |
| O61 | Keep | Built | describeEvent maps task_events.kind to verb + payload target | src/app/ops/detail/task-tab.test.tsx |
| O62 | Adapt | Built | Blocked toast offers only [Open], never takes focus, dismissal per item id | src/app/ops/office/office-toasts.test.tsx |
| O63 | Adapt | Built | Subtitle = task title, approval summary, or sub-state. Bar = step i/n when known, otherwise an indeterminate hairline (never fake progress). Selection is synced across rail, orrery and inspector | src/app/ops/primitives/identity.test.tsx |
| O64 | Adapt | Built | Ops dock with Log (worker-log tail), Events (run SSE) and Problems(n) (policy, cron failures, validation, 401). Interactive terminal is cut unless Desktop already has one (verify) | src/app/ops/primitives/foundations.test.tsx |
| O65 | Keep | Built | Ops statusbar item group. Tokens = today's total, with a provenance tooltip | src/app/ops/chrome.test.tsx |
| O66 | Adapt | Live-only | A chat opened from Ops shows a task chip and a profile chip | Chips rendered by Desktop chat header; needs a live chat session |
| O67 | Adapt | Not built | Kanban task ids are auto-linked in the transcript and open a task tab | Transcript auto-linking of task ids lives in Desktop chat renderer; not changed (outside src/app/ops) |
| O68 | Keep | Cut | Already in Desktop chat. Reuse it; no Ops copy | SPEC: already in Desktop chat, reuse, no Ops copy |
| O69 | Adapt | Cut | Handled by the Desktop composer; Ops only passes the profile scope | SPEC: handled by the Desktop composer; Ops only passes profile scope (covered by O32 test) |
| O70 | Keep | Built | Task timeline. Exit code and duration come from tool-result payloads | src/app/ops/detail/task-tab.test.tsx |
| O71 | Adapt | Built | Handoff = reassign event flagged; child-link/delegate_task handoffs not flagged | src/app/ops/detail/task-actions.test.tsx |
| O72 | Adapt | Built | Inline Approve (full args) in Needs-you; Deny/Comment inline not built for jsonrpc | src/app/ops/detail/task-actions.test.tsx |
| O73 | Adapt | Live-only | Snippet built from patch/write_file tool args. Open git review | Snippet needs real patch/write_file tool payloads; git review delegated to Desktop |
| O74 | Adapt | Built | Run-failure block from task_runs error/outcome with [Unblock] (note) and [Retry → ready] | src/app/ops/detail/task-tab.test.tsx |
| O75 | Cut | Cut | Security §7 | reason kept |
| O76 | Adapt | Not built | No source: /api/profiles carries no description field |  |
| O77 | Adapt | Built | Sub-states of "working", taken from live events: thinking, tool:<name>, done (fades to idle after 10 s). No state is shown without an event behind it | src/app/ops/primitives/identity.test.tsx |
| O78 | Adapt | Built | Agent card "Next cron run" = earliest enabled next_run_at; none/unknown kept distinct | src/app/ops/detail/agent-run.test.tsx |
| O79 | Keep | Built | Ops settings rows keep the same promise | src/app/ops/motion/motion.test.tsx |
| O80 | Keep | Built | Ops settings opens as a lens tab | src/app/ops/live-panels.test.tsx |
| O81 | Keep | Built | One A1 query key feeds every surface; no surface derives its own copy | src/app/ops/chrome.test.tsx |
| O82 | Keep | Built | Run tab: active run + task_runs history (status/outcome/duration/error, task link); no Runs lens | src/app/ops/lenses/lenses.test.tsx |
| O83 | Cut | Cut | Single local user | reason kept |
| O90 | Adapt | Built | Toast queue: max 1 per kind + "+n more → Needs-you", never takes focus | src/app/ops/office/office-toasts.test.tsx, primitives/toast-queue tests |
| G1 | Adapt | Built | Office Dispatch composer empty state | src/app/ops/office/office-p7.test.tsx |
| G2 | Adapt | Built | P2-filtered picker (Anthropic*, gpt-6.1-sol, grok-4.7) | src/app/ops/canvas/node-editor-view.test.tsx |
| G3 | Adapt | Cut | Delegated to Desktop chat | SPEC: delegated to Desktop chat |
| G4 | Adapt | Built | Cron blueprints as cards | src/app/ops/lenses/lenses.test.tsx |
| G5 | Adapt | Cut | No quota source exists. Use the free-tier/billing status where present, otherwise a user-set budget in Ops settings compared with real usage | SPEC: no quota source exists; budget fallback deferred |
| G6 | Adapt | Not built | Channels & MCP lens: embedded CapabilitiesView + Messaging view (category rail, All/Connected, search) | Channels & MCP lens not built in Ops; Desktop Capabilities/Messaging views remain the surface |
| G7 | Adapt | Not built | Per-card connection state; Connect = existing onboarding/OAuth flows; Manage = open server/platform config | Depends on G6 lens |
| G8 | Cut | Cut | N/A | reason kept |
| G9 | Cut | Cut | No mock data | reason kept |
| G10 | Adapt | Not built | Skill hub bundles as starter packs; "Add all" installs into the scoped profile (with A5 backup) | Skill hub bundle lens not built |
| G11 | Adapt | Cut | The Type, Author and Updated sources are unverified (see G68/G70) | SPEC: Type/Author/Updated sources unverified |
| G12 | Keep | Not built | Create / open skill editor | Skill editor stays in Desktop |
| G13 | Adapt | Built | Must not duplicate Desktop's profile groups or Bot roster in the sidebar | src/app/ops/navigation.test.tsx |
| G14 | Keep | Built | Palette | src/app/ops/keymap.test.tsx |
| G15 | Adapt | Not built | Channels library entry | Depends on G6 lens |
| G16 | Adapt | Live-only | Command Center  usage section | Command Center usage section is Desktop-owned; needs live usage data |
| G17 | Keep | Built | Rail collapse persisted | src/app/ops/navigation.test.tsx |
| G18 | Adapt | Live-only | Gold Night default + Desktop themes | Theme default verified visually only; GUI checks waived |
| G19 | Cut | Cut | N/A | reason kept |
| G20 | Adapt | Built | Breadcrumb + Save (per node) + Export profile as Share | src/app/ops/canvas/node-editor-view.test.tsx |
| G21 | Adapt | Built | Run panel: 'Test run' a profile prompt via gateway run, live stream | src/app/ops/canvas/canvas.test.tsx |
| G22 | Keep | Built | Live elapsed + tokens | src/app/ops/canvas/canvas.test.tsx |
| G23 | Keep | Built | Tool-call list from run events | src/app/ops/canvas/canvas.test.tsx |
| G24 | Adapt | Live-only | Use live delegated subagents, which Desktop already tracks. A4 covers configured delegation only | Live delegated subagents need a running gateway |
| G25 | Adapt | Built | Stop + Steer follow-up; attach cut | src/app/ops/detail/task-actions.test.tsx |
| G26 | Keep | Built | Collapse run panel | src/app/ops/canvas/canvas-p7.test.tsx |
| G27 | Adapt | Built | Ownership = job origin profile (D9) | src/app/ops/canvas/canvas-extras.test.tsx |
| G28 | Adapt | Cut | Show a filter expression only if the webhook model has one (verify) | SPEC: webhook model has no filter expression |
| G29 | Keep | Built | Channels node | src/app/ops/canvas/canvas.test.tsx |
| G30 | Keep | Built | Memory node | src/app/ops/canvas/canvas-p7.test.tsx |
| G31 | Keep | Built | Identity node | src/app/ops/canvas/canvas-p7.test.tsx |
| G32 | Adapt | Built | No owner field exists. Owner = last writer from the A5 manifest; version = backup sequence | src/app/ops/canvas/node-editor-view.test.tsx |
| G33 | Adapt | Built | Outglow "tools" are connectors. In Hermes they are toolsets plus the profile's enabled MCP servers | src/app/ops/canvas/canvas.test.tsx |
| G34 | Adapt | Built | Delegation node read-only | src/app/ops/canvas/canvas.test.tsx |
| G35 | Keep | Built | Skills node from /api/profiles skill_count; unknown when not loaded | src/app/ops/canvas/canvas-extras.test.tsx |
| G36 | Keep | Built | Model node w/ P2 picker | src/app/ops/canvas/node-editor-view.test.tsx |
| G37 | Keep | Built | Per-node collapse and collapse/expand all | src/app/ops/canvas/canvas-extras.test.tsx |
| G38 | Adapt | Cut | The screenshots colour ports by state, not edges by kind (see G49) | SPEC: superseded by G49 port colours |
| G39 | Keep | Built | Zoom in/out + Fit built; pan not built | src/app/ops/canvas/canvas-p7.test.tsx |
| G40 | Keep | Built | Badges: New (changed since last backup), Unset, Policy | src/app/ops/canvas/canvas-p7.test.tsx |
| G41 | Adapt | Built | Nodes must never animate in on load (that was the replay). They only light up on real run events | src/app/ops/motion.test.ts |
| G42 | Adapt | Not built | Every child item opens a detail popover | Per-child detail popover not built; collapse/expand only |
| G43 | Adapt | Built | Header = profile pill plus prompt. Stop asks for confirmation | src/app/ops/detail/task-actions.test.tsx |
| G44 | Adapt | Built | Tool-call tree. Each call goes from spinner to  or , shows the toolset icon and its duration | src/app/ops/canvas/canvas.test.tsx |
| G45 | Keep | Built | GlyphSpinner "breathe" plus ActivityTimerText. When tokens are null, show "" | src/app/ops/primitives/identity.test.tsx |
| G46 | Keep | Built | Steer send-gating | src/app/ops/detail/task-actions.test.tsx |
| G47 | Keep | Live-only | Gold dot grid at 6% | Dot grid is CSS; visual check waived |
| G48 | Keep | Built | Fixed layout: left = inputs, centre = Identity / Prompt / Model, right = Tools / Skills / Delegation. No free-form layout in v1 | src/app/ops/canvas/canvas-p7.test.tsx |
| G49 | Adapt | Built | Port colour = node state: gold = changed since backup, amber = unset, garnet = policy/validation, champagne = ok. Unset edges are dashed | src/app/ops/canvas/canvas-p7.test.tsx |
| G50 | Adapt | Built | Tint = changed since the last backup | src/app/ops/canvas/canvas-p7.test.tsx |
| G51 | Adapt | Not built | The unset CTA opens the real setup flow | Unset CTA does not yet open setup flows |
| G52 | Keep | Built | Prompt node: wheel scrolls the node, not the canvas. Edit appears on hover or focus and is reachable by keyboard | src/app/ops/primitives/foundations.test.tsx |
| G53 | Adapt | Built | Lucide icon per kind, platform logo for channels | src/app/ops/primitives/identity.test.tsx |
| G54 | Adapt | Built | Per-node skeleton tied to that node's own query, with independent failure | src/app/ops/states.test.tsx |
| G55 | Keep | Built | Zoom + Fit controls built; bottom-centre placement not verified (GUI waived) | src/app/ops/canvas/canvas-p7.test.tsx |
| G56 | Keep | Built | Keep pan. The bug must not carry over: overlays never intercept node controls | src/app/ops/canvas/canvas-p7.test.tsx |
| G57 | Keep | Not built | Per-node Save plus a header "Save all (n)", disabled at 0 | Per-node Save built; header Save all (n) not built |
| G58 | Adapt | Built | Connection  profile switcher, with a "read-only" badge on remote connections | src/app/ops/navigation.test.tsx |
| G59 | Adapt | Built | Typing filters Fleet and lenses inline; K opens the palette | src/app/ops/navigation.test.tsx |
| G60 | Adapt | Built | "N more"  Fleet table | src/app/ops/office/office.test.tsx |
| G61 | Adapt | Partial | Templates lens: cron blueprints and kanban workflow templates | Cron blueprints built (lenses test); kanban workflow templates Cut, no backend source (src/app/ops/lenses/lenses.test.tsx) |
| G62 | Adapt | Not built | Rail "+" opens a popover over the MCP catalog and platforms. Picking one runs the existing connect flow | Rail + popover over MCP catalog not built |
| G63 | Adapt | Not built | Reuse Desktop Capabilities  Connectors and Messaging. Ops adds only the category grouping | Depends on G6 lens |
| G64 | Cut | Cut | No source | reason kept |
| G65 | Adapt | Live-only | Static Gold Night Hermes mark | Static mark is an asset; visual check waived |
| G66 | Keep | Partial | Dispatch: @profile sets the assignee, #project sets the project | @profile built (office test); #project Cut: kanban task creation has no project field (src/app/ops/feed/ops-data.test.ts) |
| G67 | Adapt | Not built | Blueprint chips show the icons of the toolsets/platforms they use | Blueprint chips show names only, no toolset icons |
| G68 | Adapt | Not built | Tag = skill category, in gold-tone hue variants | Skills lens not built |
| G69 | Keep | Not built | Profile links open Canvas; +N opens a popover | Skills lens not built |
| G70 | Adapt | Not built | Author from SKILL.md frontmatter, "" if absent. Updated = mtime | Skills lens not built |
| G71 | Keep | Built | DataTable primitive | src/app/ops/primitives/foundations.test.tsx |
| G72 | Adapt | Not built | Install counts shown only if the hub reports them. Browse = existing hub picker | Skills lens not built |
| G73 | Adapt | Cut | "Profile settings" opens the profile in Canvas; org is cut | SPEC: org is cut; profile settings = Canvas (navigation covered) |
| G74 | Adapt | Cut | Hermes update/changelog via Command Center maintenance | Desktop Command Center owns maintenance; no Ops work per SPEC |
| G75 | Keep | Built | /ops/canvas/:profile, /ops/task/:id, /ops/run/:id, plus "Copy link" | src/app/ops/navigation.test.tsx |
| G76 | Adapt | Live-only | Gold Night app-wide default (D5); System/other themes selectable | Theme default visual check waived |
| G77 | Cut | Cut | N/A | reason kept |
| G80 | Keep | Built | Same pattern in the DataTable cell. It must also be reachable by keyboard. | src/app/ops/primitives/foundations.test.tsx |
| G81 | Keep | Not built | SearchField that filters by name, category and description. | Skills lens not built |
| G82 | Adapt | Not built | Install and enable the whole bundle on the focused profile, after a confirm that lists every skill. If the hub has no bundles, Cut this. | Skills lens not built |
| G83 | Adapt | Not built | "Connected" = configured MCP servers plus platforms whose credentials are set. | Depends on G6 lens |
| G84 | Adapt | Not built | Provider auth status (OAuth or key present: yes/no), filtered by P2. Clicking it goes to Desktop's provider setup. | Provider auth status card not built in Ops |
| G85 | Adapt | Built | A Needs-you (W8) entry in the rail, with the same A3 count badge. | src/app/ops/navigation.test.tsx |
| G86 | Adapt | Not built | An optional change note captured on Save and shown on the Prompt node. | Change note on Save not built |
| G87 | Cut | Cut | /v1/runs has no time-window parameter. The window goes in the prompt text. | reason kept |
| R1 | Adapt | Built | Office 'Today' strip: tasks due, cron runs next 24h, overdue (stale heartbeat) | src/app/ops/office/office-p7.test.tsx |
| R2 | Adapt | Built | Merged into Needs-you + notify subs | src/app/ops/detail/details.test.tsx |
| R3 | Adapt | Built | 'Mine' = tasks created_by/assigned to user | src/app/ops/board/board-model.test.ts |
| R4 | Adapt | Built | Projects lens (read), favourites local | src/app/ops/lenses/lenses.test.tsx |
| R5 | Adapt | Built | Board overview: counts per status/profile, throughput | src/app/ops/lenses/lenses.test.tsx |
| R6 | Keep | Built | Board | src/app/ops/board/board-bench.test.tsx |
| R7 | Keep | Built | List | src/app/ops/board/board.test.tsx |
| R8 | Keep | Built | Table | src/app/ops/board/board.test.tsx |
| R9 | Adapt | Built | Calendar of cron runs + task completions | src/app/ops/board/board-model.test.ts |
| R10 | Adapt | Built | Gr8r's timeline uses start/due dates, which are cut (R14). Ours is runs startedcompleted | src/app/ops/board/board-model.test.ts |
| R11 | Adapt | Not built | Attachments across tasks | Cross-task attachments view not built |
| R12 | Keep | Built | Task drawer + full-page tab | src/app/ops/detail/details.test.tsx |
| R13 | Adapt | Built | Status, priority, assignee(profile), project, skills (as labels), estimate | src/app/ops/board/board-extras.test.tsx |
| R14 | Cut | Cut | Schema lacks fields | reason kept |
| R15 | Keep | Built | Links parent/child | src/app/ops/detail/task-actions.test.tsx |
| R16 | Keep | Built | Child tasks | src/app/ops/board/board-extras.test.tsx |
| R17 | Adapt | Not built | Markdown body editor | Markdown body editor not built (comment only) |
| R18 | Keep | Built | Task tab comments (with add) + events | src/app/ops/detail/task-tab.test.tsx |
| R19 | Adapt | Built | Pin (local) / move to done / back to ready | src/app/ops/board/board.test.tsx |
| R20 | Adapt | Not built | Open, Duplicate, Copy deep link, Archive, Reassign; Delete cut | Duplicate/Copy deep link menu items on the card not built; reassign/archive built |
| R21 | Adapt | Built | Bulk archive done | src/app/ops/board/board.test.tsx |
| R22 | Keep | Built | Merged palette | src/app/ops/keymap.test.tsx |
| R23 | Adapt | Built | Active only inside Ops and only when focus is not in an editable field. "P" is undefined in the fusion. / must not collide with composer slash commands | src/app/ops/keymap.test.tsx |
| R24 | Adapt | Built | Search tasks + sessions + profiles | src/app/ops/detail/details.test.tsx |
| R25 | Adapt | Built | Fleet = members (profiles); teams = kanban lanes/tenants; invite cut | src/app/ops/navigation.test.tsx |
| R26 | Keep | Built | Activity lens | src/app/ops/lenses/lenses.test.tsx |
| R27 | Adapt | Built | Ops settings subset (motion, default tab, date fmt); theme/accent live in Desktop settings (D5) | src/app/ops/motion/motion.test.tsx |
| R28 | Cut | Cut | N/A | reason kept |
| R29 | Cut | Cut | N/A | reason kept |
| R30 | Keep | Built | Gold shimmer skeletons, empty/error states, toasts | src/app/ops/shell.test.tsx |
| R31 | Keep | Built | The row still holds a review note. Replace it with the resolved spec: 140/220/320 ms plus the 2 eases, with SPEC §6 updated. | src/app/ops/motion/motion.test.tsx |
| R32 | Keep | Built | Ops layout grid with one gutter | src/app/ops/split-host.test.tsx |
| R33 | Cut | Cut | N/A | reason kept |
| R34 | Adapt | Cut | Workflow templates (kanban workflow_template_id) | Kanban /workflow exposes no workflow templates (workflow_template_id has no listing source) |
| R35 | Adapt | Built | "Pinned" rail section for tasks, profiles, runs and lenses | src/app/ops/navigation.test.tsx |
| R36 | Adapt | Built | Needs-you "Resolved" tab: the last 50, with who, when and how | src/app/ops/lenses/lenses.test.tsx |
| R37 | Adapt | Built | "Seen" on review and cron items (local). Never available on approvals or policy items | src/app/ops/primitives/foundations.test.tsx |
| R38 | Adapt | Built | Review lens: tasks in review, with worktree diff | src/app/ops/board/board.test.tsx |
| R39 | Adapt | Built | Assignee picker in drawer/task tab via PATCH assignee (not /reassign); server refuses illegal moves | src/app/ops/detail/task-actions.test.tsx |
| R40 | Keep | Not built | Desktop ConfirmDialog plus a New-task modal | New-task modal not built (inline + Add per column instead) |
| R41 | Keep | Built | Themed radix Select | src/app/ops/primitives/foundations.test.tsx |
| R42 | Adapt | Cut | Reorder only if kanban has a priority/order field (verify), otherwise disabled. "land" plays on success; a rejected drop snaps back with the reason | Kanban has no priority/order field to reorder; disabled per SPEC |
| R43 | Keep | Built | @dnd-kit keyboard sensor: Space to pick, arrows to move, Space to drop (Sol #10) | src/app/ops/board/board.test.tsx |
| R44 | Keep | Built | Invariant: live updates (push, or the fallback poll) never reset scroll, focus, an open drawer or a drag in progress | src/app/ops/states.test.tsx |
| R45 | Adapt | Built | View choice stored per (connection, profile filter, project) | src/app/ops/shell.test.tsx |
| R46 | Adapt | Built | Undo for move, archive and reassign within 8 s. Never for approval or stop | src/app/ops/primitives/foundations.test.tsx |
| R47 | Keep | Not built | Commit on blur or Enter; Esc cancels | Inline title edit not built |
| R48 | Adapt | Built | Only on todo and ready columns | src/app/ops/board/board.test.tsx |
| R49 | Adapt | Built | Bulk reassign, archive, and move to ready | src/app/ops/board/board.test.tsx |
| R50 | Adapt | Built | Over task_runs | src/app/ops/lenses/lenses.test.tsx |
| R51 | Keep | Built | UI | src/app/ops/split-host.test.tsx |
| R52 | Adapt | Built | Groups by status and age (stale heartbeat = overdue), since there are no due dates | src/app/ops/office/office-p7.test.tsx |
| R53 | Keep | Built | Under 1280 px the inspector overlays. Under 1024 px the rail shows icons. Under 800 px tabs become a dropdown | src/app/ops/split-host.test.tsx |
| R54 | Adapt | Not built | Opt-in OS notifications on approval.pending and blocked. No focus steal | OS notifications opt-in not built |
| R55 | Adapt | Not built | "Open Ops on launch" plus default tab, checked against the Desktop startup route | Open Ops on launch not built |
| R56 | Keep | Built | lucide-react | src/app/ops/primitives/identity.test.tsx |
| R57 | Adapt | Built | Board Archived toggle + Unarchive (→ todo) | src/app/ops/board/board-extras.test.tsx |
| R58 | Adapt | Not built | Child-task progress chip on the card | No child-progress source on board rows |
| R60 | Adapt | Built | Recent searches on the palette's Ops page, stored locally per connection + profile. | src/app/ops/keymap.test.tsx |
| R61 | Adapt | Built | An Office header with the date and the connection, no greeting copy. | src/app/ops/office/office-p7.test.tsx |
| R62 | Adapt | Built | A Projects lens row opens an overview (counts and throughput) filtered to that project. | src/app/ops/lenses/lenses.test.tsx |


## P8 batch 1 (2026-10-14 ART): P7 self-review hardening

No status flips (totals unchanged). Rows re-verified with new behavioural assertions in src/app/ops/p8-batch1.test.tsx:
- O7 / A7 stream: ended or failed stream reconnects with backoff (2/5/15/30 s), stop cancels the retry; dedupe set bounded at 1000 ids.
- O29 Stop/Steer: refused Steer keeps the typed text; Stop on an already-ended run (409) says 'Run already ended.' and reloads; one action in flight; failure block only for the newest run.
- O27/O28 task tab: a slow response for a previous task id never overwrites the current task; per-task view state resets on id change; timeline times are local, not UTC.
- O12/O16/R26 lenses: empty states for Projects, Templates, Resolved; Activity shows 'Connecting' while the stream opens; favourites survive blocked localStorage.
- G39/G56 canvas pan: pointer capture + cancel/lost-capture end the drag; pan clamped to +/-2000 px.
- O47 board dot: switching profile or connection no longer re-marks the Board tab unread.

## P8 batch 2 (2026-10-14 ART): Office control room + SPEC-v2 delta rows

SPEC-v2 delta rows (from SPEC-v2-release-delta.md) now tracked here. Tests: src/app/ops/office/office-control-room.test.tsx (18), src/app/ops/feed/kanban-stream-faults.test.ts (5).

| ID | Disposition | Status | Acceptance line | Evidence |
|---|---|---|---|---|
| R63 | Adapt | Built | Stat cards working (n stuck), open (n for focused profile), done this week, needs attention (garnet >0, deduped); click focuses its section; values asserted against a fixture board | office-control-room.test.tsx "R63 stat cards" |
| R64 | Adapt | Built | My queue Upcoming/Overdue/Completed with counts; overdue = heartbeat >10 min or review >24 h with the reason; opens on Overdue when non-empty; "You're all caught up." | office-control-room.test.tsx "R64 my queue" |
| R65 | Adapt | Built | Project progress: derived status, done/total %, meter, team sigils (+N), updated age; row opens the Board filtered to the project | office-control-room.test.tsx "R65 project progress" |
| R66 | Adapt | Built | Header New task (primary, focuses the composer) + New profile (Desktop /profiles); no Invite; local date | office-control-room.test.tsx "R66 header actions" |
| X1 | Keep | Built | Every Office section has its own state: loading / unavailable (server reason) / stale (last answer + warning) / ok; a synchronously throwing request only breaks its own section | office-control-room.test.tsx "X1", "F5 container hardening" |
| X2 | Adapt | Built | Stuck = failing (consecutive_failures>0) > stale heartbeat > blocked (block_kind) > failing cron, with reason and age; count equals the board | office-control-room.test.tsx "X2 stuck" |
| X3 | Keep | Built | Needs-you covers approval, review, unblock, policy (Fix on Canvas) and cron (Run now); empty copy | office-control-room.test.tsx "X3" |
| X4 | Adapt | Built | Delivered row: one click saves/opens the newest attachment through Desktop's gateway file download; file name + size + "+N more"; per-row loading/unavailable | office-control-room.test.tsx "X4 / X8" |
| X5 | Adapt | Built | Tasks (in flight, stuck, queue, delivered), cron jobs (strip + stuck to /cron?job=) and live runs (fleet table to the run's task) each open in one click; live Office routes tasks via the host when no task opener is passed | office-control-room.test.tsx "X5", "F5" |
| X8 | Adapt | Built | Delivered today = done in last 24 h, newest first, latest summary + outputs | office-control-room.test.tsx "X4 / X8" |

F1 stream faults (Built, kanban-stream-faults.test.ts): mid-stream drop then reconnect with Last-Event-ID replay deduped and dead-subscription frames ignored; 401/403 wait the longest backoff step and record "auth refused"; 500 retries on the short step; an open with no answer in 10 s falls back to poll and the late answer is closed unused; stop during a slow open closes it.
F5 Office review fixes: header date and activity times local (were UTC); dispatch keeps text + shows the server reason, one in flight; sections no longer render stale answers from a previous profile/client; synchronous request errors contained; live Office tasks were unclickable (no onOpenTask passed), now routed via the host.
## P8 Office to 9 + batch 3 (2026-10-14 ART): Board

Office: Stuck/Overdue thresholds are now named defaults (DEFAULT_THRESHOLDS: stale heartbeat 10 min, review overdue 24 h) and an Ops setting (Settings > Office thresholds, clamped, reset). A container test switches profile mid-load and asserts no stale section leaks (office/office-p8b3.test.tsx). Commit 7b0b2c2807.

Board tests: src/app/ops/board/board-p8b3.test.tsx (14). Commit 72efcc7a41.

| ID | Disposition | Status | Acceptance line | Evidence |
|---|---|---|---|---|
| R67 | Adapt | Built | Saved views: current filter + layout saved as a named tab per (connection, project) in local storage; restoring one gives the same filters, layout and cards; same name replaces | board-p8b3 "R67 saved views" |
| R68 | Adapt | Built | Timeline: Weeks/Months, group by profile or project, today line, parent→child curves for visible links (dangling links dropped); links fetched lazily only while open (cap 40) | board-p8b3 "R68 timeline" |
| R69 | Adapt | Built | List/table group by status/profile/project/priority with counts; collapsible groups (aria-expanded); sort manual/priority/updated | board-p8b3 "R69" |
| R70 | Adapt | Built | Files view: list/grid, type, size, uploader, age; upload button + drop zone; refusal shows the server reason; scope note (40 most recent tasks; no list-all endpoint) | board-p8b3 "R11 / R70 files" |
| R71 | Adapt | Built | Rich card: priority, tag chips (skills + #tenant), subtasks n/m, comment count, heartbeat colour (fresh/aging/stale, running only); quick actions all keyboard reachable | board-p8b3 "R71 / R58" |
| R74 | Adapt | Built | Favourites view: starred tasks, profiles, projects, runs (legacy project favourites folded in); each opens in one click; empty copy | board-p8b3 "R74" |
| R11 | Keep | Built | Upload attaches through POST /tasks/{id}/attachments and the file appears without a board reload | board-p8b3 "R11 / R70 files" |
| R17 | Keep | Built | Description renders safe Markdown (no innerHTML; only http(s)/mailto links); drawer editor with toolbar + live preview, PATCH body, refusal keeps the editor | board-p8b3 "R17" |
| R20 | Adapt | Built | Card menu (right-click, Shift+F10, ⋯): Open, Duplicate, Copy link, Archive (confirmed), Reassign; Delete is Cut (no endpoint, archive is the reversible path) | board-p8b3 "R20" |
| R40 | Adapt | Built | New-task modal ("n" or button): title with @profile, Markdown body + preview, column, priority; Ctrl+Enter; refusal keeps the modal and the text | board-p8b3 "R40" |
| R47 | Keep | Built | Inline title rename (double-click/F2): Enter or blur commits exactly once, Esc cancels, unchanged title sends nothing | board-p8b3 "R47" |
| R58 | Adapt | Built | Heartbeat tone thresholds shared with Office | board-p8b3 "R71 / R58" |

## P8 batch 4 (2026-10-14 ART): Fleet, Skills, Channels lenses

Agents, Skills and Channels & MCP are now live Ops lenses (lenses/b4-lenses.tsx, pure model lenses/b4-model.ts). Tests: src/app/ops/lenses/b4.test.tsx (10).

| ID | Disposition | Status | Acceptance line | Evidence |
|---|---|---|---|---|
| R72 | Adapt | Built | Fleet table agent (role subtitle) / model / lane (most-worked tenant) / active tasks / runs 7d (task starts) / last active / status (running, failing, idle, unknown); sortable DataTable, search by name/model/lane/role; partial note if the board does not answer | b4.test "R72" |
| R73 | Adapt | Built | Teams tab = tenant lanes: projects (open the board), open tasks, members; Roles tab read-only | b4.test "R72 / R73" |
| O14 | Adapt | Built | New agent opens Desktop's profile create flow (/profiles?new=1) | b4.test "R72 / R73" |
| O76 | Adapt | Built | Role = first clause of the profile description; absent = "No role" | b4.test "model" |
| G6 / G63 | Adapt | Built | Channels & MCP: category rail (Messaging, Tools (MCP), Models) with counts, sectioned two-column cards (glyph, name, one line), search | b4.test "Channels lens" |
| G7 | Adapt | Built | Per-card ✓ Connected + Manage, or Connect; both open Desktop's own flow (messaging, connectors, provider settings); warnings (gateway stopped, disabled) | b4.test "Channels lens" |
| G15 | Adapt | Built | "Connect more apps" rail footer opens the quick-connect library | b4.test "G62/G15" |
| G62 | Adapt | Built | "+" quick-connect popover: search, kind filter, grouped by category, Esc closes, a pick runs the connect route | b4.test "G62/G15" |
| G83 | Adapt | Built | All / Connected counts; connected = configured MCP server or installed entry, platform with credentials, provider signed in | b4.test "Channels lens", "model" |
| G84 | Adapt | Built | Models category = OAuth providers with signed-in state; click goes to provider setup | b4.test "Channels lens" |
| G67 | Adapt | Built | Blueprint tags naming a known app/platform show its monogram icon | b4.test "G67" |
| G10 / G82 | Adapt | Built | Starter packs = official hub catalog grouped by category (>= 2 skills; the hub has no bundle field). Add all confirms with every missing skill listed, installs into the focused profile, reports per-skill failures. A5 backup not taken (install is additive) | b4.test "G82" |
| G12 | Keep | Built | Create skill and per-row Open go to Desktop's skill editor | b4.test "Skills lens" |
| G68 | Adapt | Built | Type tag = category in one of six gold-family tones, stable per category | b4.test "Skills lens", "model" |
| G69 | Keep | Built | Agents column: first 3 profiles with the skill enabled + "+N" popover; each opens the profile (scan capped at 12 profiles) | b4.test "Skills lens" |
| G70 | Adapt | Cut | /api/skills has no author or mtime; shows Source (provenance) and Uses instead. Rebuild when the route reports them | n/a |
| G71 | Keep | Built | Sortable headers on every data column; "Individual skills n" count pill tracks the search | b4.test "Skills lens" |
| G72 | Adapt | Built | Pack metadata "n skills · m installed" (the hub reports no install counts, so none shown); Browse library = Desktop hub picker | b4.test "Skills lens", "G82" |
| G81 | Keep | Built | Search by name, category, description | b4.test "Skills lens" |

## P8 batch 5 (2026-10-14 ART): Canvas, partials, settings and lifecycle

Tests: src/app/ops/motion/b5.test.tsx (16). Commit 20b8910f1c.

| ID | Disposition | Status | Acceptance line | Evidence |
|---|---|---|---|---|
| Canvas edges | Adapt | Built | Every CANVAS_EDGES pair is a drawn SVG cubic (column slots, gold, muted when an end is collapsed, lit during a test run); the text list stays for screen readers | b5.test "drawn edges" |
| Canvas wheel | Adapt | Built | Ctrl/Cmd+wheel zooms one ZOOM_STEP, plain wheel pans (Shift = horizontal), clamped to PAN_LIMIT | b5.test "wheel" |
| G42 | Adapt | Built | Every node title opens a detail popover with its real fields (unknown stays unknown); Esc/Close | b5.test "G42" |
| G51 | Adapt | Built | Unset Identity shows an amber "Set identity" CTA to Desktop's profile setup; disabled on remote | b5.test "G51" |
| G57 | Keep | Built | Header "Save all (n)", hidden on remote, disabled at 0; saves each dirty node through its own A5 save (with its note); refused nodes named | b5.test "G57" |
| G86 | Adapt | Built | Prompt node shows "last change: <note>" from the newest Prompt backup; detail popover shows it too | b5.test "G86" |
| G66 | Keep | Built | Dispatch: leading @profile assigns, #project anywhere sets project_id; routing line says both | b5.test "G66" |
| O67 | Adapt | Built (Ops surfaces) | Kanban ids (t_ + hex) in task comments are links to the task tab; hostile text stays text. Desktop chat transcript not touched (outside Ops) | b5.test "O67" |
| O16 / G61 | Adapt | Cut (workflow templates) | Templates lens = cron blueprints with app icons; kanban workflow templates have no backend (stated in the lens) | lenses.test, b4.test "G67" |
| O41 | Adapt | Built | Approval mode read per profile; Change opens Desktop's approvals settings (Ops does not write config.yaml outside A5) | canvas-p7.test, motion.test |
| R54 | Adapt | Built | Opt-in silent OS notifications for new approvals and newly blocked tasks; first load only primes (no burst); never focuses the window | b5.test "R75 ... R54" |
| R55 | Adapt | Partial | "Open Ops on launch" + default tab stored; opsLaunchRoute() gives the route. Desktop's startup does not read it yet (host change) | b5.test "R55" |
| R75 | Adapt | Built | Settings grouped General / Ops / Notifications / Shortcuts / Diagnostics / Security; theme Gold Night (default) / Light / Dark / System | b5.test "R75" |
| R77 | Adapt | Built | Dev-only Simulate offline / slow (> 10 s) / 401 on every Ops request; not rendered and forced off when import.meta.env.DEV is false | b5.test "R77 / L4" |
| L1 | Adapt | Built | Capability probe over A1-A7: 404 = "needs Hermes with <feature>", 401/403 = refused, other = error | b5.test "L1" |
| L4 | Adapt | Built (client side) | Simulation drives each section's unavailable/stale states; stream drop/401/slow-open recovery covered by kanban-stream-faults.test.ts | b5.test, kanban-stream-faults.test |
| L6 | Adapt | Built | Diagnostics: stream mode + reason, policy source, probe, last 50 redacted request errors, Copy diagnostics (redacted), Clear | b5.test "L6", "Diagnostics panel" |
| S2 | Keep | Built | No dangerouslySetInnerHTML / innerHTML / insertAdjacentHTML in any Ops source (static test); Markdown and linkified text render hostile payloads inert | b5.test "S2", board-p8b3 "R17" |
| S7 | Keep | Built | Redaction of provider keys, Bearer tokens, JWTs, KEY=value and query tokens in the error ring and the copy | b5.test "S7", "L6" |
| X10 | Adapt | Partial | Today strip shows input/output tokens with provenance and no $ (no price). Per-profile split not in /api/ops/usage/today | b5.test (n/a), office.test |
| X7 / X11 / X12 / X9 | Keep | Not changed in P8 | Handoff rows exist (data-ops-handoff); orrery motion gating, deep-link copy for every Office row and the evidence-flow test are still open | n/a |
| L2 / L5 / L8 / L9 / S5 / S6 | Adapt | Deferred to P9 | Connection state matrix, skew glyph, profile create/delete, teardown counts, legacy-write network test, Host header pytest | n/a |

## P11 re-audit (2026-10-14 ART)

- Re-read every P8 table above against the code on ops/P8-polish. Rows marked Built have a named test that asserts the acceptance line; Partial and Cut rows say what is missing.
- Open after P8: R55 (host startup hook), X10 per-profile split (backend), X7/X9/X11/X12 (Office motion + deep links), G70 (skills author/mtime, backend), O67 in Desktop chat, and the P9 lifecycle rows.
- Ops suite 40 files / 371 tests green; typecheck clean; lint 0 errors.

## P8 B6 - push to 9 (2026-10-14)

Commits (fork only): 61ecc74657 (backend: GET /runs/stats, GET /attachments keyset paging, S6 Host-header test, 9 pytest), cb57cff625 (desktop).
SPEC v2.1 from the 02:41 Sol review: not in the vault at pull time, so nothing was folded in.

| Row | Status | Evidence |
|---|---|---|
| R55 startup hook | Done | motion/launch.ts applyOpsLaunchRoute() called in main.tsx before mount. It only replaces a cold-start hash, so deep links and session resume still win. Route is /ops/<tab>. Tested in b6.test.tsx |
| O67 chat task-id links | Done | lib/ops-task-links.ts remark plugin plus a MarkdownLink branch (data-ops-task-link) linking to #/ops/task/<id>. Skips code and existing links. 3 tests; assistant-ui suite 729/729 |
| X7 Office motion | Done | Handoff arcs (10 s window, 320 ms), drift/halo only while a run is live, honours reduced motion |
| X9 evidence flow | Done | Task tab is evidence first: timeline, runs, worker log, diff (run metadata diff/diffstat), outputs. Then actions (assignee, live controls, unblock). DOM-order test |
| X10 per-profile usage | Done | /api/ops/usage/today?profile=, capped at 12 profiles |
| X12 copy link | Done | CopyLink on stuck/queue/project/delivered/fleet/run/in-flight/event rows; copied/failed state tested |
| Files 40-task limit | Done | Board-wide /attachments keyset paging with Load more; falls back to the 40-task scan on older Hermes |
| Fleet Runs 7d | Done | Real task_runs counts plus failed7d (data-ops-runs-source=runs); falls back to task-starts |
| Timeline drag-to-reschedule | Cut | Kanban has no due or scheduled-date field to write. Rescheduling would need a schema change, which is out of scope for a safe small change |
| Skills / Settings polish, L2/L5/L8/L9/S5, full UI sweep | Not done in B6 | Carried to B7 |

Gates: tsc 0 errors; Ops suite 42 files / 381 tests pass; eslint 0 errors (warnings only).
## P8 B7 - SPEC v2.1 must-folds + polish (2026-10-14 ART)

Vault: SPEC-v2.1.md and SPEC-v2-sol-review.md pulled (vault HEAD 6b0d458e). `git ls-remote origin HEAD` = 6b0d458e5267, the same as local HEAD, so the B6 vault push reached origin.

Commits on ops/P8-polish (fork only, fast-forwarded into feat/ops-panel): a8d027cd27, d22f2c458f, a9a0914acf (backend); 9c6cb3d645, 6af069dd83, 4a5d1e3c14, 812ba87dd0, 443f404d12, 0dc44d8c8a, d4f105615c, bc3422cf17, 631ec2e378, b0f3619a50 (desktop); plus the restore-drill commit.

### Must-folds (Sol review, SPEC v2.1)

| MF | SPEC | Status | Evidence |
|---|---|---|---|
| MF1 matrix | §9b | Closed | The P8 tables plus this one are the row matrix; every Built row names a test, every Cut row has a reason. No coverage percentage is used in place of critical rows |
| MF2 layers | §9a/§9c | Closed | Rows are tagged backend (pytest), client (vitest) or host. Host-only rows (R55) say so |
| MF3 A5 contracts | §2b | Closed | op_id on every save and restore; duplicate op_id is 409 duplicate_op; GET .../ops/{op_id} gives applied, rejected, indeterminate or not_found; the client goes to "outcome unknown" when the response is lost and reconciles. Save all stays independent and sequential. test_ops_v21_folds, node-editor.test, b7.test |
| MF4 policy | §1.6 | Closed | An invalid override fails closed: source "invalid", fail_closed true, 423 policy_invalid on PUT and restore. Overrides are restrict-only (cannot enable, add a provider or widen a model glob). Settings shows the alert. test_ops_v21_folds, test_ops_policy, b7.test |
| MF5 Origin/auth/secrets | §5b/§5c | Closed | Middleware refuses POST/PUT/PATCH/DELETE on /api/ops, /api/approvals and /api/plugins/kanban from a foreign Origin with 403 origin_not_allowed. Allowed: app://, file://, loopback, and accepted hosts. raw_yaml is never kept in drafts; secrets in backups are sealed (DPAPI/AES-GCM). test_ops_v21_folds, restore drill |
| MF6 live protocol | §0b | Closed | Stream generation counter; stop() invalidates in-flight opens and clears timers; resources() accounting. 20 start/stop cycles leave 0 timers, and a late open after stop is dropped. b7.test |
| MF7 Needs-you | §4c | Closed (approvals); residual noted | Approvals resolve bound to request_id. One-click only for short commands (160 chars or fewer, 3 lines or fewer) that carry an approve action; distinct copy for resolved_elsewhere, expired, stale_revision and duplicate. Residual: the kanban review "approve" carries no revision token (backend has none); it is a status move, not an approval, so Sol's §4c guard does not apply to it |
| MF8 Office counts | §4a-§4d | Closed | Open = todo/ready/running/blocked/review; done-this-week = ISO week from Monday 00:00 in the Ops timezone; working = fleet presence; upcoming = ready/todo sorted by priority then updated. Pinned to America/Buenos_Aires in b7.test |
| MF9 Board | §7 | Closed | View scope = connection + project + tenant + profile; Manual sort Cut (no backend order field; falls back to priority); "parent/child relations", never "dependencies"; undo validated and expires after 8 s; uploads need a target task. No invented due dates. b7.test |
| MF10 Compose/choice | §6 | Cut | G91 Compose and G92 inline choices are Cut: no typed backend contract exists for either, and SPEC v2.1 allows Cut over untyped. Revisit when Hermes ships typed compose and choice events |
| MF11 compat, drafts, restore drill | §3/§3b | Closed | OPS_COMPAT window: min 0.21.0, tested 0.21.5, exclusive max 0.23.0, plus required capability tokens from /api/status ops_capabilities. Connection states: connecting / connected / version-skew / incompatible / auth-failed / unreachable. Prompt and model drafts are kept; raw_yaml is not. Restore drill: byte-exact, corrupt blob (409 backup_corrupt), wrong key and tampered envelope (envelope_invalid), wrong node. test_ops_capabilities, test_ops_restore_drill, b7.test |
| MF12 live/perf evidence | §8 | Closed (proxies labelled) | Every perf and live claim here is a test proxy (jsdom or pytest TestClient), labelled as such. No live-host perf numbers are claimed. Per Sol, no screenshot mandate |

### B7 list decisions

| Item | Decision | Reason / evidence |
|---|---|---|
| L2 connection matrix | Built (classify + show); write gating Partial | connectionView() classifies the states and exposes writesEnabled; Diagnostics shows them. Server-side guards (423/403/409) already refuse unsafe writes; global client-side disabling is not wired |
| L5 skew glyph / unknown enums | Built | presenceOf() maps unknown presence values to "unknown"; the version-skew state shows in Diagnostics. b7.test |
| L8 profile lifecycle | Adapt | Canvas drafts built. New profile hands off to Desktop /profiles; A6-governed create/clone/delete is Cut until an ops.profiles.create capability exists |
| L9 teardown counts | Built | See MF6 |
| S5 legacy write paths | Deferred (Nacho) | Documented in Settings > Security (data-ops-legacy-routes="deferred"). A static test asserts that Ops source calls no legacy write route. The legacy routes are not removed (Sol REJECT) |
| Manual board sort | Cut | No order field in the backend |
| Skills | Built | State and type filters, Clear, "Showing n of m", scan-cap note, "Installing k of n", empty copy. b7.test |
| Settings | Built | Ops timezone, Reset to defaults, policy-invalid alert, policy source and error in Diagnostics, security boundary, Forget drafts. b7.test, motion.test |
| UI/UX sweep | Built | Static sweep: no raw HTML injection, no legacy routes, every icon-only button has an aria-label (fixed 2 in rail.tsx) |

Gates: Ops vitest 43 files / 402 tests pass; tsc 0; eslint 0 errors. Ops pytest 131 pass + 1 env failure (test_ops_fleet_stream async test: pytest-asyncio is not installed in the venv; it fails on pre-B7 code too). Wider web-server pytest set: the same 112 failures with and without the B7 changes, so B7 adds no regression.

## P8 B8 - final close (2026-10-14 ART)

| Item | Status | Evidence |
|---|---|---|
| L2 write gate | Built | feed/write-gate.ts. The host's pinned /api/status read (chrome.tsx useOpsBackendSources) and the Diagnostics probe feed connectionView() into one gate. OpsShell disables every `[data-ops-write]` control (25 tagged: Canvas save/confirm/restore/save-all/test run; Board create/upload/save body/undo/bulk move/archive; Task stop/steer/unblock/retry; Needs-you approve/deny/review/request changes/unblock/comment/cron run; Office dispatch; Skills add-all). Each gets `disabled`, `aria-disabled` and a reason tooltip ("Writes are off: ..."). A MutationObserver covers controls mounted later, and a capture-phase guard drops clicks that get through. Board drag and bulk moves refuse in board-container. Only a definite answer closes writes (auth-failed, unreachable, incompatible); "connecting" leaves writes to the server guards; a scope change resets to unchecked. b8.test.tsx (states, apply/restore, live gate + late mount + click guard, static coverage per file and per handler) |
| MF7 leftover | Built | PATCH /api/plugins/kanban/tasks/{id} takes an optional `expected_status`: on a mismatch it returns 409 `stale_status` with `current_status` and changes nothing; older clients that omit it behave as before. Capability token `kanban.tasks.expected_status`. Ops review approve sends `{status:'done', expected_status:'review'}`; a stale result shows "Changed; review again". test_kanban_expected_status.py (3), b8.test.tsx (2) |
| pytest-asyncio | Done | Installed pytest-asyncio==1.3.0 in the venv (the repo's dev pin in pyproject.toml). test_ops_fleet_stream 2/2 pass |

Gates: Ops vitest 44 files / 417 tests pass; tsc 0; eslint 0 errors. Pytest (kanban plugin + Ops): 244 pass, 0 fail.
Commits: f2ecae28d3 (L2), f668a19415 (MF7 backend), c041302d3f (MF7 client), plus this evidence commit.
Grades after B8: every section is 9; Diagnostics/lifecycle is 9 (was 8.5).

## B9: live pass, 60 fps, S5 flag, PR

Tip: `ops/P8-polish` = `feat/ops-panel` = 07eed7622a.

**Live pass.** Built dist from ops/P8-polish and drove it with Playwright `_electron` (`apps/desktop/scripts/ops-live/live.mjs`) against the real Hermes home on Ignacio. Gateway :8642 was pid 6816 before and after; no restart. Only reads were made, plus one Canvas draft that was typed and then discarded. No profile was saved. The board fingerprint (task ids per column) was identical before and after.

| Section | Status | console err | page err | HTTP≥400 / failed |
|---|---|---|---|---|
| Office | OK | 0 | 0 | 0/0 |
| Board (41 cards) | OK | 0 | 0 | 0/0 |
| Canvas (10 nodes) | OK | 0 | 0 | 0/0 |
| Canvas draft (typed + discarded) | OK | 0 | 0 | 0/0 |
| Fleet | OK | 0 | 0 | 0/0 |
| Teams | OK | 0 | 0 | 0/0 |
| Skills | OK | 0 | 0 | 0/0 |
| Channels | OK | 0 | 0 | 0/0 |
| Settings | OK | 0 | 0 | 0/0 |
| Diagnostics (connected, A1–A7, writes on) | OK | 0 | 0 | 0/0 |

**Bugs fixed:**
- The Ops UI was unstyled in the real app; fixed with ops-base.css.
- Fleet showed "unavailable" because the host fed it nothing.
- A stray "0" appeared under every panel.
- The rail count had no label.
- Office showed "unknown connection".
- Canvas edges were misaligned.
- The icon rail was clipped.

**Frame timing** (rAF sampler in the running app, 75 Hz display, ms):

| Scenario | frames | p50 | p95 | p99 | >16.7 | >33 |
|---|---|---|---|---|---|---|
| Office motion | 451 | 13.3 | 13.4 | 13.5 | 3 | 1 |
| Board scroll | 378 | 13.3 | 13.4 | 13.5 | 1 | 0 |
| Board drag (cancelled) | 358 | 13.3 | 13.4 | 13.5 | 3 | 2 |
| Canvas pan/zoom | 377 | 13.3 | 13.4 | 13.5 | 0 | 0 |

p95 is well under 16.7 ms everywhere, so no optimization was needed.

**S5.**
- `hermes_cli/legacy_writes.py` adds a `legacy_write_gate` dependency on 9 legacy write routes: PUT config/raw, profiles soul/description/model, skills/toggle, and toolsets {name}/model/provider/env.
- `HERMES_RETIRE_LEGACY_WRITES=1` makes them return 410 `legacy_write_retired`. The flag is off by default because the classic Desktop Settings still calls these routes, and it is reversible.
- It is env-only, so there is no config read per request.
- Capability token `ops.legacy_writes.flag`; `/api/status` also exposes `legacy_writes_retired`.
- Settings > Security reads `data-ops-legacy-routes="flag"`.
- Tests: `tests/hermes_cli/test_ops_legacy_writes.py` (14).

**Tests.**
- vitest Ops: 45 files / 424 tests pass. tsc: 0 errors. eslint: 0 errors.
- pytest S5/capabilities: pass.
- Broad 40-file pytest selection: 693 pass. The remaining failures are pre-existing on Windows at base 2fcb5d61ee, plus 9 that fail only because the clone sits inside the real HERMES_HOME (real-home I/O guard). Those 9 pass with the new code from a %TEMP% worktree.

## B10: real Inspector, Fleet presence, live UI/UX polish

Tip: `ops/P8-polish` = `feat/ops-panel` = 82b758bc34.

**Inspector.** A per-kind selection store (`inspector-detail.ts`) replaces the "detail not built in this shell" stub:
- **Board:** the open card, or column totals when no card is open.
- **Canvas:** the selected node, or the profile summary plus history.
- **Settings:** the profile's Ops settings.
- **Empty state:** an honest "Nothing selected" message.

Tests: `b10.test.tsx` (17).

**Fleet "unknown".** Rule 3.4 needs a fresh empty `gateway_runs` before it can report idle, and no provider supplied one. `gateway_runs_observation` now reads it from the gateway heartbeat (`runtime.active_agents`):
- 0 on a live, non-stale gateway is an authoritative empty for every profile it serves.
- A positive count is work only for the profile whose home the gateway runs under.
- A stopped or stale gateway is missing.

Live, default changed from unknown to idle. The other 38 profiles stay unknown because A3 approvals can only be observed for the backend's own profile. Tests: `test_ops_fleet_gateway_runs.py` (9); the fleet suite is 33/33.

**UX rounds.**
- r1–r3 fixed card overlap, inspector layout, the Settings detail race, the secrets list, needs-you age and reason, icon-rail noise, tab close, checkbox spacing, Office chips, Canvas row placement and stretch, the card quick bar covering the title, and Fleet hierarchy. Full list in FINAL-REPORT.
- Final r4 pass: every section had 0 console errors, 0 page errors and 0 HTTP failures. The board was unchanged and the gateway stayed pid 6816.
- Frame times: p50 13.3 ms and p95 13.4 ms in all four scenarios.

**Tests:** vitest 46 files / 441 tests; tsc 0; eslint 0 errors.

## B11 — orbit collisions, inspector i18n, honest unknown, driver safety, live round (2026-10-14)

Code tip on `ops/P8-polish` = `feat/ops-panel`: see PR #1. Commits: `70f9539383` orbit, `e30f8e3d66` inspector i18n,
`7f97111e83` honest unknown, `a9f89b2afb` driver preflight + toasts + spike timing, `4598015134` live r1 fixes,
`010689b4f5` live r2 fix.

| Item | Result | Evidence |
|---|---|---|
| Office orbit label collisions | Fixed. `spreadOrbs` stretches rings into an ellipse and relaxes overlapping label boxes (centre fixed, clamped to the 240px stage, deterministic); orbs are centred on their point | `office/orrery.ts`, b11.test (raw layout overlaps, spread never does, 3 presence mixes) |
| Inspector labels i18n | All 9 Ops locales: labels, values (`unset`, `loading`, `yes/no`…), templates (`3 of 5`, `41 cards`, `2 failing`, `n bytes`), footers and hints. 7 locales still said "detail not built in this shell"; replaced | `inspector-i18n.ts`, `locales.ts` (`inspector.fields`), b11.test, locales.test |
| Per-profile approvals | Not safely readable: pending approvals live in each profile's own process; this backend only sees its own queue (no read-only cross-process API). So `unknown` is now explained: a localized "Not observable from here" row under the Fleet unknown group with the full reason as tooltip; Office unknown chip and orbs carry the same tooltip | `navigation-store.ts` (`hint` row), `rail.tsx`, b11.test |
| Test-instance toast | Driver dismisses status toasts (any locale) before every screenshot; error alerts stay. Before: dismissal ran before boot with an English-only regex | `scripts/ops-live/live.mjs`, `toastDismissed` in live.json |
| First-pickup drag spike | Measured with per-frame timing: no pickup spike. The long frames sit at 4.86–5.07 s of the 5 s window = Escape/release (Escape leaves fullscreen and relayouts). Board has no card drag implementation (only a file drop zone), so nothing to optimise at pickup | live.json `fps.board-drag.spikes` |
| Driver safety | Preflight refuses to launch unless `OPS_LIVE_PYTHON` imports `hermes_cli.web_server` from the checkout (a wrong interpreter made the isolated test window loop on "Hermes couldn't start" on the user's screen). Test window is now off-screen, out of the taskbar, unfocused. desktop.log still lives in the shared HERMES_HOME (the test needs the real home) | `live.mjs` |

Live round (critical UX), found and fixed:
- r1: Agents/Skills/Channels lens sections were laid out as one flex row (a rail-button rule `[data-ops-lens]` also matched `section[data-ops-lens]`): empty left column, header at the bottom. Rule scoped to `button[data-ops-lens]`, lens sections stack.
- r1: kept-alive Settings tab leaked its detail into the inspector of other row-slot tabs (Agents showed "Ajustes"). Details now show only on their owning tab (task→board, node→canvas, settings→`lens:settings`).
- r2: the ownership check first missed lens tab ids (`lens:settings`); fixed.

Final round r3 (isolated instance, real gateway :8642, hermes-agent venv): 14/14 steps ok, 0 console errors, 0 page errors, 0 HTTP ≥400, 0 failed requests, toast dismissed.

| Sample | p50 ms | p95 ms | p99 ms | max ms | long frames (>33 ms, at ms) |
|---|---|---|---|---|---|
| office-motion | 13.3 | 13.4 | 13.5 | 66.7 | 173, 4321 |
| board-scroll | 13.3 | 13.4 | 13.5 | 26.7 | — |
| board-drag | 13.3 | 13.4 | 26.7 | 146.8 | 1187 (40), 4855, 4975 (Escape/release) |
| canvas-pan-zoom | 13.3 | 13.4 | 13.5 | 26.7 | — |

Tests: Ops frontend suite 46 files / 449 tests pass; tsc and eslint clean on touched files.

Remaining: Office, Agents, Skills, Channels and the Settings page body are still English-only copy (only the inspector, rail and nav are localized); the long Escape frame comes from leaving fullscreen, not from the board.
Screenshots: box `/workspace/ops-live/b11/` (contact-sheet.png, before-after.png, before/ = B10).

## B12 — Fusion of Orbit × Outglow × Gr8r (2026-10-14)

- Fusion matrix: `apps/desktop/docs/ops-panel/fusion-matrix.md` (visual language + interaction patterns; adopted / adopted-and-improved / missing).
- Builds: Orbit Sigil avatar orbs in presence-coloured pills with `ops-think` pulse (reduced-motion off); radial stage. Gr8r greeting (locale date), board card mono id + assignee Sigil, column status glyphs. Outglow dotted-grid canvas + card-node chrome.
- Main-content i18n: `T()` codemod over 20 tsx files (420 strings) + `main-i18n-table.ts` with 424 keys for es fr de ru ja zh zh-hant ar; English is identity.
- Tests: ops vitest 46 files / 455 tests pass (new `b12.test.tsx`); tsc clean; build OK.
- Live round (off-screen, venv Python, `%TEMP%\ops-live-b12r1`): pageErrors 0. fps p95 13.4 ms on office/board-scroll/board-drag/canvas; board-drag max 133 ms at release (fullscreen exit, as in B11).
- Deferred: free card-drag; Outglow chat→canvas auto-compose (needs a proposal-only backend path, never auto-apply). Residual English: stat-card labels, composer placeholder/quick prompts, column ids, presence pills (JS constants, not JSX).

## B13 — Card drag, Chat→Canvas compose, residual i18n (2026-10-14)
- Commits: 4c57428840 (drag + compose + i18n + tests), b0242556e8 (r2 i18n + driver), plus docs.
- Drag: HTML5 dragstart/dragover/drop on Board columns → existing props.move (optimistic, Undo 8 s, server refusal snaps back). Same-column drop is a no-op (no rank field in backend). Keyboard Alt+←/→ and Move… kept.
- Compose: `canvas/compose.ts` + `compose-view.tsx`. Proposal is shown, never applied; Accept stages drafts consumed by the Prompt/Model editors; saving still needs Review & save (A5 + op_id). Read-only disables Accept.
- Tests: 48 files / 462 pass (new b13.test.tsx); tsc clean; build OK.
- Live r2 (off-screen, venv Python): pageErrors 0, all sections ok, boardUnchanged=true (no real moves; drag measured with dragend-without-drop). fps p95 13.4 ms everywhere; board-drag max 40 ms (B12: 133 ms).
- Evidence: /workspace/ops-live/b13/ (before-after.png, before-after-canvas.png, contact-sheet.png, sbs-outglow-vs-compose.png, sbs-gr8r-vs-drag.png, live.json).

## B14 — Plurals, layout pills, lens strings, status chips (2026-10-14)
- `P(n, other, one)` uses Intl.PluralRules per locale (ru one/few/many, ar zero/one/two/few/many, ja/zh single form) with locale number formatting. 8 plural keys × 8 locales.
- Translated: board layout pills, inspector column ids (falls back to the main table), card counts, skills installed, violations, comments, Agents tabs Fleet/Teams/Roles, status values, kits "N skills · N installed", Add all/All added, on/off, Showing N of M.
- Fleet status chips: failing garnet, running gold, idle muted.
- Tests: 49 files / 468 pass (new b14.test.tsx); tsc clean.
- Live b14r1 (off-screen, venv Python): pageErrors 0, all sections ok, boardUnchanged; fps p95 13.4 ms. Evidence /workspace/ops-live/b14/.

## B15 — Channels/Settings/Diagnostics i18n, empty-state reset, compact compose (32b282ed1f)
- Channels: Manage/Connect, All/Connected counts, categories, Install {n}, Installing…; the empty search has a "Show all apps" reset.
- Diagnostics probe text, Settings legacy-routes/start-page text, Office "source:", and the Ops settings tab label are localized.
- The compose textarea starts at 1 row and grows when there is text.
- Tests: 50 files / 472 pass. Live b15r1: pageErrors 0, every section ok, board unchanged. Evidence: /workspace/ops-live/b15/.

## B16 — Diagnostics capability i18n + drag screen-reader announcements (95908cb5d9)
- Capability rows and the connection line are localized at render time; the copied report stays English.
- Board drag: a polite aria-live region announces start, move and same-column drops (visually hidden via :where([data-ops-sr])).
- 540 keys per locale. Tests: 51 files / 475 pass; tsc clean.
- Live b16r1: pageErrors 0, board unchanged, drag p95 13.4 ms / max 13.7 ms. Evidence: /workspace/ops-live/b16/ (before-after.png, before-after-drag.png, contact-sheet.png).
## B17–B19 — design critique loop (scored per lens; lowest fixed first)
Scores (1–10): Office 4→7, Board 5→7, Canvas 5→5, Fleet 5→6, Teams 4→5, Skills 4→5, Channels 6→6, Settings 4→6, Diagnostics 4→6.
- B17 (f88e8956d2): last connection-state and notification English (all diag variants, Task blocked, approvals via plural P). Every button gets a press sink; the selected tab gets a gold baseline; filter chips go quiet; stat values lead at 26 px; the Orbit gets two orbital rings and a slow centre glow (reduced motion: static).
- B18 (5004bda328): type scale greeting 20 > lens 16 > section label 11 caps > body 13; 12 px section rhythm; the three Office count strips merge into one hairline-separated line; cards lift on hover (transform only, pitch-safe); table rows highlight on hover.
- B19 (ee2bbcb5e6): Needs-you kinds/actions/retry localized; while a card is dragged, hover lift and transitions turn off (drag max 53 ms → 26.8 ms, 0 frames over 33 ms); failing/overdue counts carry an alarm colour; empty states get a dashed frame.
- Tests: 54 files / 484 pass; tsc clean. Live b17r1–b19r1: pageErrors 0, board unchanged. Evidence: /workspace/ops-live/b17/, b18/, b19/.
## B20–B22 — toward 9/10 per lens
Scores (1–10, after B19 → after B22): Canvas 5→8, Channels 6→8, Teams 5→8, Skills 5→7, Office 7→8, Board 7→8, Fleet 6→6, Settings 6→6, Diagnostics 6→6.
- B20 (c104761b8f): Canvas Outglow pass: glyph tile per node type, localized node titles, status-tinted tiles, port dots where wires meet, gold ring on the selected node with a floating detail, flowing dashes on lit run wires (static under reduced motion), unavailable nodes recede.
- B21 (cf530f7fec): Channels equal-height cards with the action pinned to the foot, connected apps first with gold glyphs; Teams as cards with member avatars, plural open counts and empty copy; Skills starter packs as a grid with an install progress bar; Canvas leftovers localized; next cron run as a local date instead of ISO.
- B22 (8ca36d36f9): Needs-you rows get avatars, tinted kind pills (garnet for blocked/failing/policy), right-aligned ages, compact inputs; board titles lead at 13/600 with mono ids, blocked/running cards get an inset edge tint, done cards recede; tab switch fades in (opacity only); Channels left-aligned; "No lane" localized.
- Tests: 57 files / 496 pass; tsc clean. Live b20r1–b22r1: pageErrors 0, board unchanged; drag and pan/zoom max 13.5 ms in b22r1, one 40 ms board-scroll frame. Evidence: /workspace/ops-live/b20/–b22/.
## B23–B26 — toward 9/10 (Fleet, Settings, Diagnostics, frame budget)
Scores (after B22 → after B26): Fleet 6→8, Diagnostics 6→8, Settings 6→7, Skills 7→8, Canvas 8→8, Board 8→8, Office 8→8, Channels 8, Teams 8.
- B23 (5307c45eb2): sortable headers become quiet caps with a gold active sort and ↑/↓; non-sortable headers localized (Skills "DESCRIPTION"); Fleet agent cell = avatar + name + quiet role; zero counts recede; failures garnet; Diagnostics capabilities and connection as status lights in a grid; fleet copy localized.
- B24 (5430e1540a): secret presence as a mono chip grid with green lights; board views as a segmented switcher with New task primary; Canvas node detail below its node; Office live cards lifted with a state edge; kit names wrap.
- B25 (f86e28e6c9): Canvas run panel status pill (localized, state light, reduced-motion safe); drifting orbs drop shadows.
- B26 (8dee375052): removed an unscoped `:where(:has(> [data-ops-count]))` and a toolbar `:has()`; Office p99 26.5 → 13.5 ms.
- Tests: 61 files / 510 pass; tsc clean. Live b23r1–b26r1: pageErrors 0, board unchanged. b26r1 max frames: one 66.8 ms Office frame, one 40 ms drag frame (p99 13.5 / 26.6 ms). Evidence: /workspace/ops-live/b23/–b26/.
## B27–B29 — verified in live screenshots before scoring
Scores (after B26 → after B29): Board 8→9, Canvas 8→9, Office 8→9, Settings 7→8, Skills 8→8, Fleet 8, Diagnostics 8, Channels 8, Teams 8.
- B27 (2e18598466): board toolbar was block flow, so the B24/B26 nowrap never applied; it is now a flex row with shrinking filters (verified: Mías and Archivadas on the same line). Canvas node detail expands the node in place (verified: Modelo no longer covered). Settings groups are a label/control grid. Driver: new 08c-settings-top shot.
- B28 (85fb70d768 test only, df37559e3c edits; the first edit script aborted on a CRLF mismatch and was re-applied): Office dispatch input fills the row with a primary submit, routing hint below, "+N más → Te necesita" as a link, larger orbit badges; settings rows top-aligned; node editor heading/badge, dispatch status localized. Driver scroll fixed (verified: Settings top visible).
- B29 (e064d53912): skills agent chips as pills; thresholds as labelled inputs; first-column name rule did NOT take (names still framed), noted for the next batch.
- Tests: 64 files / 521 pass; tsc clean. Live b27r1, b28r2, b29r1: pageErrors 0, board unchanged. b29r1: Office max 26.7 ms (0 over 33), drag max 53.4 ms (2 frames), scroll max 40 ms (1). Evidence: /workspace/ops-live/b27/–b29/.
## B30 (c754ab9635)
- Drop highlight moved from React state to DOM attribute: board-drag 368 -> 748 frames, p99 13.5 ms, max 53.4 -> 40.1 ms (2 frames at drag end).
- Skill names unframed via [data-ops-skill-open]; table cells carry data-col; Fleet model mono/muted, running pulse; Teams 'No lane' spans the row; Settings follow-up dd tucked.
- Live b30r1: pageErrors 0, boardUnchanged true, 65 files / 524 tests, tsc clean.
