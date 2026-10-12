# Desktop surface audit (P0-04)

Status: read-only discovery, r2 docs delta applied. No shell, no new component, no route. SPEC rows are not relaxed.
Base: `hermes-agent` `865ba906c1a` (`feat/ops-panel` / `ops/P0-04` at audit time).
SPEC: `01-Projects/Hermes/desktop-ops-panel/SPEC.md` v4. Rows: O9, O26, O32, O38, O44, O45, O48, O50, O51, O52, O55, O64, O65, G13, G17, G58, R23, R53, R55.
PLAN task: P0 item 4 (titlebar, palette pages, status-bar groups, themes, split host, model picker, notify, subagents, keymap).

Method: follow exported symbols and their call sites. A missing symbol is a named blocker or a bounded implementation requirement. It is not an invitation to invent a second chrome.

Live Desktop (`apps/desktop/release/win-unpacked/Hermes.exe`) was running during this audit. No key was injected. Ctrl+W / Ctrl+Tab would mutate production tabs and sessions. The collision ledger in `keymap.md` is named from source. It is not a keypress signature. Judge r2 signs it, or records a concrete blocker.

## 1. Seam inventory

Reuse these. Do not copy them.

| Seam | Path | Symbol | What Ops may do |
|---|---|---|---|
| Titlebar metrics | `src/app/shell/titlebar.ts:3` | `TITLEBAR_HEIGHT` (34) | Sit under the existing bar. Do not draw a second titlebar. |
| Titlebar tools | `src/app/contrib/panes.tsx:189` `useTitlebarToolContributions`; `:226` `setTitlebarToolGroup` | `TitlebarTool` groups on `titleBar.tools.left/right` | Register tools through the group setter. |
| Titlebar center slot | `src/sdk/areas.ts:10` `TITLEBAR_AREAS.center`; `src/app/shell/titlebar-controls.tsx:325` `<Slot area="titleBar.center" />` | empty on purpose | Breadcrumb (O45) is a `titleBar.center` contribution. `controller.tsx:303-305` says the center stays empty so session title stays in tabs. Ops may fill the slot; it must not add a header row. |
| Palette open state | `src/store/command-palette.ts:6-27` | `$commandPaletteOpen`, `$commandPalettePage`, `openCommandPalettePage(page, seed?)` | One palette. An Ops page is a new key in the existing page map, opened with `openCommandPalettePage('ops')`. |
| Palette pages | `src/app/command-palette/index.tsx:165` `PAGE_PARENTS`; `:1400-1501` `subPages` | pages today: `theme`, `install-theme`, `pets`, `settings` | Add `ops` beside those keys. Esc already steps `PAGE_PARENTS` then closes (`goBack`, `:769-771`). Do not mount a second cmdk. |
| Status bar item | `src/app/shell/statusbar-controls.tsx:46-85` | `StatusbarItem`, `SetStatusbarItemGroup` | One Ops group. |
| Status bar setter | `src/app/contrib/panes.tsx:201-225` | `registryGroupSetter`, `setStatusbarItemGroup` | `setStatusbarItemGroup('ops', items, 'left' \| 'right')`. Empty list clears the group. Same pipe as Capabilities / Messaging (`surfaces.tsx:189-191`). |
| Theme resolver | `src/themes/presets.ts:444-468` | `BUILTIN_THEMES`, `DEFAULT_SKIN_NAME = 'nous'`, `RETIRED_SKINS` includes `'gold'` | Gold Night is not a skin yet. `'gold'` is retired and falls through `normalizeSkin` (`src/themes/context.tsx:59-60`) to `nous`. |
| Theme lookup | `src/themes/user-themes.ts:151` | `resolveTheme(name)` | Built-in, then `$userThemes`, then `$backendThemes`, then `themes` contributions. P0.5 adds `gold-night` here. This audit does not. |
| Accent | `src/themes/accent-override.ts:20` | `$accentOverride`, `setAccentOverride` | Accent variants hook this atom. Do not paint a private palette. |
| Layout host | `src/components/pane-shell/tree/store.ts:71` | `$layoutTree` | Ops is a pane in this tree, not a new splitter. |
| Layout persistence | `src/lib/layout-persistence.ts:13-25` `LAYOUT_KEYS`; `:73` `keyFor` | per interface mode (`advanced` vs `.simple`), not per connection/profile | See D14. Do not fork the tree store. |
| Sash | `src/components/pane-shell/geometry.ts:172` `beginSashDrag`; `src/components/pane-shell/tree/renderer/tree-split.tsx` | existing zone sash | Split width uses this sash. |
| Pane lifecycle | `src/components/pane-shell/pane-lifecycle.ts:1` | `'visible' \| 'hot-hidden' \| 'parked'` | Full-screen hides chat as `hot-hidden`, never `parked` (unmount). |
| Narrow rails (Desktop) | `src/app/layout-constants.ts:30-32` | `SIDEBAR_DOCK_MIN_WIDTH_PX = 640`, `SIDEBAR_COLLAPSE_MEDIA_QUERY` | Desktop's own dock floor. Note only. It is not the Ops rail rule in R53. |
| Tab overflow (Desktop) | `src/components/ui/tab-dropdown.tsx:99` `ResponsiveTabs`; `:115` `md:flex`; `:130` `md:hidden` | Tailwind `md:` is a viewport media query at 768px, not a container query and not 800px | Ops tabs must not reuse these classes unchanged. See R53 / BR-R53. |
| Model picker | `src/components/model-picker.tsx:58` | `ModelPickerDialog` | The only picker. |
| Picker owner | `src/lib/model-picker-owner.ts:22` | `resolveModelPickerOwner` | Focused tile route, else ambient profile. No Ops-profile input. See BR-PICKER-OWNER. |
| Picker open | `src/app/model-picker-overlay.tsx:33` `ModelPickerOverlay`; `src/store/session` `setModelPickerOpen` | composer pill calls it (`src/app/chat/composer/model-pill.tsx`) | Ops chip calls the same opener. It does not render a second dialog. |
| Picker chord | `src/lib/keybinds/actions.ts:88` | `composer.modelPicker` = `mod+shift+m` | Leave it. Ops does not bind another model chord. |
| Toasts | `src/store/notifications.ts:58` `$notifications`; `:249` `notify` | `NotificationInput` | Undo / "resolved elsewhere" go through `notify`. No second toast queue. |
| Native notifications | `src/store/agent-notices.ts` | only credits depleted/restored map to a native notification | Board/fleet events must not raise an OS notification (attention policy). |
| Live subagents | `src/store/subagents.ts:54` `$subagentsBySession`; `:378` `upsertSubagent` | session-scoped progress | This is not the Canvas sub-agent node. A4 is config delegation (`GET /api/config`), still missing. Do not read the progress store as the profile's delegate list. |
| Profile rename | `src/store/session-states.ts:2896` `migrateTilesForProfile` | called from `src/app/profiles/rename-profile-dialog.tsx:104` | Ops tabs persisted per profile must move here. Local connection only. |
| Profile delete | `src/store/session-states.ts:2786` `dropTilesForProfile` | called from `src/app/profiles/delete-profile-dialog.tsx:77` | Delete must drop Ops tabs. A leftover tile resurrects the profile (`:2774-2784`). |
| Interactive terminal | `electron/terminal-ipc.ts:11` `nodePty`; `:326-331` `nodePty.spawn` | user PTY, local shell or SSH | Exists. See O64. |
| Terminal surface | `src/app/right-sidebar/terminal/instance.tsx:61` | `data-interactive-terminal` on the user PTY only | Agent mirror (`:116`) has no PTY input and must not be treated as a shell. |
| Terminal pane | `src/app/contrib/controller.tsx:246-254` | pane id `terminal`, `lifecycleKeepAlive: true`, bottom placement | Desktop chrome. Ops dock does not reuse this pane and does not spawn a PTY. |
| Log tail | `src/components/chat/log-tail.tsx:39` | `LogTail` | Ops dock Log tab. Already used by Command Center and MCP editor. |
| Routes | `src/app/routes.ts:13-23` | `APP_ROUTES` | Lens deep-links. No `/ops` route exists. Adding one is later shell work, not this audit. |
| Profile roster | `src/app/routes.ts:148` `SIDEBAR_PROFILE_GROUP_HEADER_AREA`; `src/app/chat/sidebar/gateway-groups.tsx:361` | `sidebar.profileGroup.header` | Bots plugin already mounts here. Ops must not mount a second roster. |
| Bot Chat identity | `src/plugins/hermes-bots/canonical-chat.ts:50` `CANONICAL_CHAT_TITLE = 'Bot Chat'`; `:610` `openBotCanonicalChat` | `(profile, title)` registry, no stored-id pin | O26 Message opens this. `ui_meta.chat` pins are ignored (`:27-30`). |
| Bot chat flag | `src/store/session-states.ts:2037` | `isBotChatSession` | Surfaces use this to drop coding chrome. Ops must not mint a parallel flag. |

## 2. O64 — interactive terminal exists; Ops does not get one

Resolution, explicit:

Desktop already has an interactive terminal. `electron/terminal-ipc.ts` spawns a real PTY with `node-pty` (`nodePty.spawn` at lines 326-331), local shell or interactive SSH. The renderer marks that surface `data-interactive-terminal` (`instance.tsx:61`). `view.showTerminal` is `ctrl+\`` and `view.newTerminal` is `ctrl+shift+\`` (`actions.ts:194-195`). Ctrl+W on that surface is the shell's word erase, not close-tab (`use-keybinds.ts:559-575`).

Therefore the SPEC clause "interactive terminal is cut unless Desktop already has one" does **not** cut the existing terminal. It also does **not** authorize a second terminal inside Ops.

Ops dock (Adapt, not a new shell):

- Log: `LogTail` over the worker-log tail. Read-only. No stdin.
- Events: run SSE (`/v1/runs/{id}/events`). Not a terminal.
- Problems(n): policy, cron failures, validation, 401. Same count as the status-bar item (O65).
- No "forge zsh" label. No close-kills-pty. No `nodePty.spawn` from Ops.
- The existing terminal stays Desktop chrome (right/bottom pane, `controller.tsx:246`). Ctrl+J is that sidebar's toggle, not the dock. See keymap.

Return this paragraph to P0-02 as the O64 verify outcome. Do not reopen "does a terminal exist?"

## 3. D14 — split, full-screen, chat, badge, persistence, responsive

Ops is a resizable pane beside chat. It does not replace the chat sidebar (D14, SPEC §12.2).

Split:

- Host: `$layoutTree` plus the existing sash. A new `react-resizable-panels` (or any second splitter) is out of scope.
- Default placement: beside the chat/workspace pane, chat remaining visible and focused-able.
- Width: the tree already persists zone shares in `LAYOUT_KEYS.shares` (`hermes.desktop.paneShare.v1`). Those keys are per interface mode, not per connection or profile (`layout-persistence.ts:73`).

Scoped persistence (bounded requirement, not built here):

- Store the Ops split width in a new key, proposed `hermes.desktop.opsSplit.v1`, keyed by `connectionId + profile`.
- Apply it as a width override on the Ops pane when that scope is active.
- Do not write that width into the global layout-tree key. A remote connection must not inherit a local width, and a profile rename must move the key via `migrateTilesForProfile` / drop it via `dropTilesForProfile`.
- Ops document tabs (pins + history) use the same two functions. SPEC §12.2 names them for this reason.

Full-screen round-trip:

- ⤢ hides every non-Ops pane as `hot-hidden` (keep-alive). It does not `park` them and does not unmount the chat composer.
- A second ⤢, or Esc when full-screen is the innermost numbered layer (priority 5, `keymap.md` §4), restores the previous hidden set. The restore snapshot is UI state, not a backend write.
- Chat session id, draft, and stream stay on the existing session tile. Full-screen must not call `session.new` and must not navigate to `/`.

Live-session badge:

- There is no titlebar badge for "chat still running while hidden." Do not invent a presence service.
- When chat is hot-hidden and the active session is working, contribute one badge to `titleBar.center`.
- Source: existing session dot / subagent activity (`src/store/session-dot-state.ts` reading `$subagentsBySession`). Label is the session title, not a fabricated status.
- Click restores the split and focuses that chat. It does not approve, steer, or stop.

Responsive (R53, SPEC.md:673, verbatim, not adapted):

Under 1280 px the inspector overlays. Under 1024 px the rail shows icons. Under 800 px tabs become a dropdown.

Measured width: the Ops pane container, not the window. A wide window with Ops in a half split must still hit these thresholds. Window width is the wrong measure because D14 keeps chat beside Ops.

Bounded requirement BR-R53, owner phase P0.5 (PLAN.md task 2 split and task 3 rail/tabs). Not this card.

- Inspector overlays when the Ops pane container is under 1280px.
- Rail shows icons when that container is under 1024px.
- Tabs become a dropdown when that container is under 800px.
- `ResponsiveTabs` (`src/components/ui/tab-dropdown.tsx:115` `md:flex`, `:130` `md:hidden`) uses Tailwind `md:`. That is a viewport media query at 768px. It is not a container breakpoint and it is not 800px. Reusing the component unchanged does not satisfy R53 when Ops is a pane inside a wider window. P0.5 adds a container-query path (or an Ops-local row) keyed off the Ops pane container. Do not call `md` a container breakpoint.
- `SIDEBAR_DOCK_MIN_WIDTH_PX = 640` (`layout-constants.ts:30`) is a Desktop dock floor so a 1280px window split in half stays docked (`layout-constants.ts:29`). Note only. It does not replace 1280/1024/800.

Three rail collapse states (O44: full / icons / hidden) are an Ops-local preference (G17 says persist it). They are not a second copy of `view.toggleSidebar` (`mod+b`). The icon state is the R53 under-1024px container rule. Hidden-under-640 is the Desktop overlay, not a substitute for the SPEC numbers.

## 4. Lenses and Bot Chat — no duplicate chrome

Lens destinations that exist, and the only legal embed:

| Lens | Destination | Do not |
|---|---|---|
| Skills | `CAPABILITIES_ROUTE` `/capabilities` (`routes.ts:16`) `CapabilitiesView` | rebuild the skills library |
| Channels & MCP | `/messaging` | rebuild platforms |
| Triggers | `/webhooks` | rebuild webhook CRUD |
| Schedule detail | `/cron` | rebuild cron |
| Activity / usage / sessions | `/command-center` | rebuild analytics |
| Memory detail | `/starmap` | rebuild starmap |
| Profiles | `/profiles` | a second profile editor; Canvas writes come later under A5 |
| Agents | `/agents` | a second agent tree |
| Files | pane id `files` (`controller.tsx:257`), alias `file-browser` | a second file browser |
| Review | review pane, `view.toggleReview` = `mod+g` (`actions.ts:180`) | a second diff viewer |
| Conversations | chat sessions / sidebar | a second session list |
| Projects | sidebar project tree | a second project switcher |

Connection / profile switcher (G58): reuse Desktop connection and profile atoms. Remote connections show the existing read-only treatment (D11). Do not build a workspace switcher.

G13: the fleet list is presence cards fed later by A1. It is not `useGatewaySessionGroups` and not the Bots roster (`sidebar.profileGroup.header`). No duplicate profile roster.

O26 Bot Chat: Message on a bot profile calls `openBotCanonicalChat(owner)` (`canonical-chat.ts:610`). Identity is `(profile, CANONICAL_CHAT_TITLE)` with `CANONICAL_CHAT_TITLE = 'Bot Chat'`. Do not store a session id as the identity. Do not open a side-chat that creates a second titled row. Non-bot profiles may open a normal session through the existing session APIs; that path is not Bot Chat.

O32: Ops does not embed a second composer. It opens the existing chat scoped to the profile (Bot Chat for bots, ordinary session otherwise).

O38 / O52: Search Ops is a trigger that calls `openCommandPalettePage('ops')`. The centred field is a button, not an input that steals `/`.

O50 model chip — one visible chip:

- Split mode: the composer `model-pill` is the chip. Ops renders none.
- Full-screen (chat hot-hidden): one Ops chip in the titlebar cluster, label `profile · model`, click `setModelPickerOpen(true)`.
- `setModelPickerOpen(true)` does not take an owner. `ModelPickerOverlay` (`src/app/model-picker-overlay.tsx:59-65`) calls `resolveModelPickerOwner` (`src/lib/model-picker-owner.ts:22`) with the focused/selected session tiles and the ambient profile only. There is no Ops-profile argument.
- Bounded requirement BR-PICKER-OWNER, owner phase P0.5 (PLAN.md task 3, chip): when the opener is the Ops full-screen chip, the overlay must resolve that Ops connection and profile, and must not retarget the visible chat pill. Do not add a second dialog. Do not invent a picker. Writes still wait for A5/A6.
- The dialog is `ModelPickerDialog`. Display filter is policy P2 (SPEC §4.4): anthropic direct `claude-*`, openai-codex/openai `gpt-6.1-sol` / `-900k` / `-pro`, xai-oauth/xai `grok-4.7`. This audit does not add a write path.

O65: one status-bar group id `ops` via `setStatusbarItemGroup`. Tokens today come from `/api/analytics/usage` with a provenance tooltip. No avatar stack component of our own if the group can render the existing item shape.

## 5. Named gaps

Blockers (do not implement around them):

- Templates / Workflows lens has no Desktop route and no `workflow-studio` module under `src/plugins`. `routes.ts` has no workflow path. The lens stays unrouted. Do not invent a workflow UI. Board already has the kanban plugin (`src/plugins/kanban`); that is the Board, not this lens.
- Sub-agent config (A4) has no endpoint. `$subagentsBySession` is live progress only. Canvas Sub-agents stays read-only and empty until A4. Do not parse `config.yaml` in the renderer.

Bounded implementation requirements (owner is frozen; code is a later phase):

- Register palette page `ops` in `subPages` and a root row with `to: 'ops'`.
- Contribute breadcrumb + full-screen live-session badge through `titleBar.center`.
- Contribute one `setStatusbarItemGroup('ops', ...)`.
- Add `gold-night` through `resolveTheme` / `BUILTIN_THEMES` in P0.5. Do not revive the retired `'gold'` name (`RETIRED_SKINS`).
- Ops pane in `$layoutTree`, full-screen via `hot-hidden`, width key `hermes.desktop.opsSplit.v1` scoped by connection+profile, tabs hooked to `migrateTilesForProfile` / `dropTilesForProfile`.
- Teach `composerFocusBlockedBySurface` (`composer-focus-keys.ts:149`) to treat `[data-ops-root]` like `[data-terminal]`, so G-chords and `/` do not type into the composer. Detail in `keymap.md` (BR-FOCUS-SURFACE).
- P2 filter on the existing picker when the opener is the Ops chip. Not a new picker. Owner scope is BR-PICKER-OWNER, not a second dialog.
- BR-R53: container queries at 1280/1024/800 on the Ops pane, not viewport `md:`. Detail in §3.
- Close, dispatch, and Esc seams (BR-CLOSE, BR-DISPATCH, BR-ESC-REGISTER, BR-ESC-TIE, BR-ESC-SKIP) are specified in `keymap.md`. Owner phase P0.5. This card does not implement them.

## 6. Out of scope for this card

No `src/app/ops/`, no route, no theme preset, no keybind registration, no PTY, no backend adapter. Model policy P2 is a constraint on the future chip, not a validator implemented here.
