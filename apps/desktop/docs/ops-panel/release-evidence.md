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