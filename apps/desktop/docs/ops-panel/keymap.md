# Ops keymap (P0-04)

Status: r2. Ownership is frozen. Where the tree cannot enforce a row yet, the row names a bounded requirement and an owner phase. No keybind was registered. No production Desktop received a key.
Base: `865ba906c1a`. Branch docs amended on `ops/P0-04`. Companion: `desktop-surface-audit.md`.
Rows: O48, O51, O52, O55, R23, plus the chords named in the task (Ctrl+W, Ctrl+Tab, `/`, Ctrl+J, Ctrl+K, Ctrl+comma, G-chords, Esc).
r2 delta: meta card `t_af2eb38d` comment 625. This file does not relax a SPEC row.

Invariant already in tree (`src/lib/find-in-page.ts:112-114`): keyboard ownership follows focus, and one cancel gesture does one thing. Ops joins that invariant. It does not add a second dispatcher.

## 1. How Desktop owns keys today

Source of truth: `src/lib/keybinds/actions.ts` `KEYBIND_ACTIONS`. Handlers: `src/app/hooks/use-keybinds.ts` (window `keydown`, capture, `:631`). Editable gate: `isEditableTarget` (`combo.ts:260`) and `actionAllowedInInput` (`combo.ts:291`). A primary-modifier chord (Ctrl/Cmd) fires even inside a text field (`combo.ts:314-315`). Bare letters do not, unless the action is on `INPUT_SAFE_ACTIONS` (`combo.ts:271-280`).

Unbound printables on empty chrome type into the composer (`use-keybinds.ts:527-534`, `typeToFocusChar`). Soft `/` and Enter are `composer.focus` (`actions.ts:84`) and only run when `composerFocusKeysAllowed` (`composer-focus-keys.ts:172`). That function stands down for editables, overlays, the session switcher, full pages, and `[data-terminal]` (`composerFocusBlockedBySurface`, `:149-155`). A split pane is not a full page, so an Ops pane does not get this stand-down until `[data-ops-root]` is added there. That addition is bounded requirement BR-FOCUS-SURFACE (below). It is not an unresolved collision: the owner is already assigned.

Approval keys are Enter and Escape only (`approval-keys.ts:35`). There is no Y/A/single-key approve. Enter on an active `[data-approval-stack]` clicks `[data-approval-run]` (`:79-91`). Escape clicks `[data-approval-deny]` (`:79`). That is the hazard Ops Enter and Ops Esc must not inherit. The hook is BR-ESC-SKIP, not a second listener racing `handleApprovalKey`.

Electron does not register a menu accelerator for Ctrl/Cmd+W. Windows Close is click-only (`electron/window-menu.ts:16-26`, `registerAccelerator: false`). macOS Close has no accelerator (`electron/main.ts:6772-6779`). Main-process `windowAcceleratorAction` (`electron/window-accelerator.ts:33`) classifies Ctrl/Cmd+W as `close-tab` (`:55`) and swallows auto-repeat and the 200ms focus grace (`:51-53`) so a foreign Ctrl+W cannot close a tab here.

On every platform, including Windows, `installPreviewShortcut` claims `close-tab` in `before-input-event`, calls `preventDefault`, and sends `sendClosePreviewRequested()` (`electron/main.ts:6936-6972`). The renderer receives that on `onClosePreviewRequested` (`src/app/contrib/hooks/use-desktop-integrations.ts:513-523`), which today calls `wordEraseFocusedTerminal()` and then `closeActiveTab`. The comment at `:508-511` that says Win/Linux Ctrl+W is only the `view.closeTab` keybind is stale against `:6953-6972`. The keydown handler (`use-keybinds.ts:374` and the guard at `:567-575`) is the second entry: rebinds, and any path that still reaches the dispatcher. A passthrough registered only in the combo loop never sees the IPC entry.

Contributed keybinds cannot implement "decline and fall through". `allKeybindActions` (`actions.ts:263-272`) appends contributions after `KEYBIND_ACTIONS` and copies only `id`, `category`, `defaults`, and `label`. It does not copy `passthrough`. `$comboIndex` (`src/store/keybinds.ts:99-115`) preserves that order. The dispatcher continues to the next id only when `handler() === false` and `keybindAction(actionId)?.passthrough` (`use-keybinds.ts:588`). A contributed handler that returns false does not hand the chord to the built-in, and the built-in has already run. Do not register Ops overrides as `keybinds` contributions on `ctrl+tab`, `mod+k`, or `mod+,`.

Hover is not focus. `tabTargetGroup` (`src/components/pane-shell/tree/store.ts:521-538`) walks `$hoveredTreeGroup` before `$activeTreeGroup`. That is correct for Desktop ⌘1…⌘9 and the existing ⌘W family. It is the wrong test for Ops ownership. Ops ownership is DOM focus inside `[data-ops-root]` only.

## 2. Disputed chords — source inventory

`mod` is Cmd on macOS and Ctrl elsewhere. On Windows the task's Ctrl+* rows are the `mod+*` rows.

These are today's owners. §3 is the frozen owner, including the IPC path this table's keydown column does not reach.

| Chord | Desktop owner today | File:line | Fires in an editable? |
|---|---|---|---|
| Ctrl/Cmd+W | `view.closeTab` = `mod+w`. Main claims it first (`close-tab` → IPC). IPC body is `wordEraseFocusedTerminal` then `closeActiveTab`, with no Ops rung. Keydown guard re-delivers ^W only when focus is already inside `[data-interactive-terminal]`. | `actions.ts:207`; `electron/main.ts:6953-6972`; `use-desktop-integrations.ts:513-523`; `use-keybinds.ts:374`, `:567-575`; `window-accelerator.ts:50-55` | Yes (primary modifier), except the PTY surface |
| Ctrl+Shift+W | `view.closeTerminal` | `actions.ts:201` | Yes |
| Ctrl+Tab | `session.next` = `ctrl+tab`, `ctrl+pagedown`. Ctrl keyup commits the session switcher. | `actions.ts:126`; `use-keybinds.ts:598-611` | Yes (`INPUT_SAFE_ACTIONS`) |
| Ctrl+Shift+Tab | `session.prev` | `actions.ts:127` | Yes |
| `/` | `composer.focus` soft combo, and `composer.slash` when the composer already has focus | `actions.ts:84`, `:322`; `composer-focus-keys.ts:17` | Stays in the field. Does not run the soft focus. |
| Ctrl/Cmd+J | `view.toggleRightSidebar` = `mod+j` | `actions.ts:162` | Yes |
| Ctrl/Cmd+K | `nav.commandPalette` = `mod+k` (also `mod+p`) | `actions.ts:147` | Yes (`INPUT_SAFE_ACTIONS`) |
| Ctrl/Cmd+, | `nav.settings` = `mod+,` | `actions.ts:149` | Yes |
| G then key | no leader. Bare `g` is type-to-focus. | `use-keybinds.ts:527-534` | Types `g` |
| Ctrl/Cmd+G | `view.toggleReview` = `mod+g`. Find bar steals `mod+g` while open. | `actions.ts:180`; `find-in-page.ts:116-117` | Yes, unless find bar is open |
| Esc | several phases; see §4. Not one global "close everything". | `escape-layers.ts:21-30`; capture items in §4 | Depends on phase |
| Enter | `composer.focus` soft, `composer.send` / `composer.steer` inside the composer, and approval-run when a stack is active | `actions.ts:84`, `:316-318`; `approval-keys.ts:79` | Composer owns it. Approval owns it when the stack is the active composer target. |

No default binding is `mod+shift+j`, a G-leader, or a single-key approve. `appearance.toggleMode` is `shift+x` (`actions.ts:224`), unrelated.

Menu accelerators that do exist (`electron/main.ts:6827-6849`): `Ctrl+Shift+I` (devtools), `CommandOrControl+0`, `CommandOrControl+Plus`, `CommandOrControl+-`. They are not Ops chords. Leave them.

## 3. Frozen focus-ownership table

Rule for every Ops shortcut:

1. DOM focus is inside `[data-ops-root]`. Test `event.target` on the keydown path and `document.activeElement` on the IPC path. Do not call `tabTargetGroup` (`tree/store.ts:521-538`). A hovered pane that is not the focused pane does not own the chord. A focused Ops pane owns it even if the pointer is over chat.
2. The target is not an editable (`isEditableTarget`) and not inside `OVERLAY_SURFACE` (`combo.ts:255`).
3. Otherwise the chord keeps the Desktop owner in §2. That fallthrough is the built-in handler, not a contributed keybind returning false.

Ops must not register a global default that fires outside that root. Contributed keybinds (`KEYBINDS_AREA`, `actions.ts:238`) are global, appended after built-ins, and cannot decline (`actions.ts:263-272`). Use a contribution only for an action that ships unbound (`defaults: []`), such as `ops.toggleDock` (D-CTRLJ). Do not contribute a second `mod+w`, `ctrl+tab`, `mod+k`, or `mod+,`.

Bare-letter Ops chords are root-local, after BR-FOCUS-SURFACE. They are not contributed defaults.

| Chord | Owner when Ops is focused and the target is not editable | Owner otherwise | Status |
|---|---|---|---|
| Ctrl/Cmd+W | Focused Ops tab strip. Close the active non-pinned Ops tab (O48). Pinned Office/Canvas/Board tabs do not close, and the chord does not then close a Desktop tab. | `view.closeTab`, or PTY ^W if `[data-interactive-terminal]` has DOM focus | Bounded requirement BR-CLOSE. Not a combo passthrough. |
| Ctrl+Tab / Ctrl+Shift+Tab | Cycle Ops document tabs only. The session switcher does not open. | `session.next` / `session.prev` | Bounded requirement BR-DISPATCH. Not a contributed decline. |
| `/` | Focus the Ops rail filter. Do not insert `/` into the composer. The filter field, once focused, is editable, so the next `/` is a character (rule 2). | Soft `composer.focus`, or a slash command if the composer is focused | Tied to BR-FOCUS-SURFACE. SPEC "Search Ops Ctrl K" is not this key. |
| Ctrl/Cmd+J | Desktop. Ops does not claim it. | `view.toggleRightSidebar` | P0 decision D-CTRLJ. Not a SPEC edit. See §5. |
| Ctrl/Cmd+K | Same palette. Call `openCommandPalettePage('ops')` instead of toggling a new widget (O38, O52). `mod+p` is not claimed. | `nav.commandPalette` (root page), including `mod+p` | Bounded requirement BR-DISPATCH. |
| Ctrl/Cmd+, | Open Ops settings (rail item, O55). Theme still deep-links Desktop settings (W9). | `nav.settings` | Bounded requirement BR-DISPATCH. |
| `G` then `O/C/B/R/S` | Ops leader, 1s timeout, root-local. `G O` Office, `G C` Canvas, `G B` Board, `G R` Runs, `G S` Skills → `/capabilities`, not a new skills view. A lone `G` does nothing (no type-to-focus, no approve). | type-to-focus, or `mod+g` review if a modifier is held | Tied to BR-FOCUS-SURFACE. `mod+g` is not a G-chord. |
| `N` | New task. Focuses the create surface. Does not create a session (`session.new` remains `mod+n`). | type-to-focus | Tied to BR-FOCUS-SURFACE. |
| `?` | Ops shortcut sheet. | `composer.help` if the composer is focused; else type-to-focus | Tied to BR-FOCUS-SURFACE. |
| `E` | Edit the focused Ops object (opens the existing editor route or the Canvas node). No write in this audit. | type-to-focus | Tied to BR-FOCUS-SURFACE. |
| `[` / `]` | Toggle Ops rail / inspector (O51). Not `view.toggleSidebar` (`mod+b`) and not `profile.prev` (`mod+shift+[`). | type-to-focus | Tied to BR-FOCUS-SURFACE. |
| `J` / `K` | Move the Ops selection. Do not scroll the chat. | type-to-focus. Composer history is `up`/`down` (`actions.ts:324`), not J/K. | Tied to BR-FOCUS-SURFACE. |
| Enter | Open the focused Ops row. Must not click `[data-approval-run]`. | Approval Enter only when the target is the approval stack or its composer. Composer Enter sends. | Tied to BR-ESC-SKIP. |
| Alt+Left / Alt+Right | Ops tab history back/forward. | No Desktop default owns Alt+Left/Right (text nav stays in editables, `combo.ts:302-311`). | Free outside editables; Ops claims them only inside the root, same focus test as rule 1. |
| Esc | Innermost open layer only. §4. | same phases | Bounded requirements BR-ESC-REGISTER, BR-ESC-TIE, BR-ESC-SKIP. |
| any single letter used as Approve | nobody | nobody | Resolved by existing code. `approval-keys.ts:35` is Enter/Escape only. R23 "P" stays undefined. "Go to next approval" is a palette command that moves focus. It does not call `approval.respond`. |

R23: this table is the fusion keymap. It is active only inside focused Ops and only outside editables. `/` does not collide with composer slash commands because the soft `/` stands down once BR-FOCUS-SURFACE lands, and a focused composer never sits inside `[data-ops-root]`.

### BR-CLOSE — one close seam, both entries

Owner phase: P0.5 (PLAN.md task 3, keymap, on the tab strip from task 2). Not this card. No shell code here.

Add `routeCloseTabChord(loadSessionIntoWorkspace?)` in `src/app/chat/close-tab.ts`, beside `closeActiveTab` (`:69`). Both entries call it. Neither entry calls `closeActiveTab` on its own for this chord.

Order inside the function:

1. PTY word-erase. `wordEraseFocusedTerminal()` (`src/app/right-sidebar/terminal/terminal-context-menu.ts:56`). If it returns true, stop. The shell keeps ^W. Do not close an Ops tab and do not call `closeActiveTab`.
2. Focused Ops strip, non-pinned. DOM focus is inside `[data-ops-root]` (IPC: `document.activeElement`; keydown: `event.target`, passed in or read before the call). Not `$hoveredTreeGroup`. Not `tabTargetGroup`. If that holds and the target is not an editable and not inside `OVERLAY_SURFACE`: close the active Ops tab when it is not pinned, then stop. If it is pinned, consume the chord and close nothing. Do not fall through to `closeActiveTab` while Ops focus holds.
3. `closeActiveTab(loadSessionIntoWorkspace)` (`close-tab.ts:69`). This is the Desktop owner: chat zone, tool tab, workspace tab.

Call sites, exactly once per chord:

- Native IPC. `use-desktop-integrations.ts` `onClosePreviewRequested` (`:513-523`). Replace the `wordEraseFocusedTerminal` / `closeActiveTab` body with `routeCloseTabChord(id => navigate(sessionRoute(id)))`. This is the path `electron/main.ts:6953-6972` actually delivers on Windows. The stale comment at `:508-511` must be updated in the same change so a later reader does not restore a direct `closeActiveTab`.
- Keydown `view.closeTab`. In `use-keybinds.ts` `onKeyDown`, at the existing guard (`:567-575`), before `event.preventDefault()` (`:586`). Call `routeCloseTabChord` there. If the result is PTY, return without `preventDefault` so xterm writes ^W (the handler at `:374` must not also run). If the result is Ops or Desktop, `preventDefault` and return. The `'view.closeTab'` handler at `:374` becomes the same function for a rebound that does not hit the W-shaped guard, and the guard returns before `handler()` so one keydown cannot close twice.

A contributed `mod+w` with `passthrough` does not satisfy this. The IPC path never enters the combo loop.

### BR-DISPATCH — pre-dispatch Ops owner for Ctrl+Tab, Ctrl+K, Ctrl+comma

Owner phase: P0.5 (PLAN.md task 3). Not this card.

Choice: keep the built-in owner as the fallback, and add one pre-dispatch check. Do not drop the Ops override (O52, O55, and Ctrl+Tab cycle are SPEC keymap rows). Do not implement the override as a contributed keybind.

Add `claimOpsFocusedChord(event, combo): boolean`. Call it from `onKeyDown` in `src/app/hooks/use-keybinds.ts` immediately after `handleApprovalKey` returns false (`:521-523`) and before `$comboIndex` is acted on (before the loop at `:541`, and before `event.preventDefault()` at `:586`). If it returns true, `preventDefault` and return. The built-in does not also run.

It returns true only when all of these hold:

- DOM focus is inside `[data-ops-root]` (`event.target`). Hover does not count. Do not read `$hoveredTreeGroup`.
- The target is not an editable and not inside `OVERLAY_SURFACE`.
- `combo` is `ctrl+tab`, `ctrl+shift+tab`, `mod+k`, or `mod+,`. Not `mod+p`. Not `mod+j`.

Actions when it returns true:

- `ctrl+tab` / `ctrl+shift+tab`: cycle Ops document tabs. Do not call the `session.next` / `session.prev` handlers, so the session switcher does not open. Ctrl keyup (`use-keybinds.ts:610-611`) then no-ops because the switcher is not active.
- `mod+k`: `openCommandPalettePage('ops')` (`src/store/command-palette.ts:20`). Do not mount a second palette.
- `mod+,`: open the Ops settings rail item. Do not also run `nav.settings`.

When it returns false, the built-in owner in §2 runs unchanged, including inside an Ops editable (primary-modifier chords already fire there).

## 4. Esc — one phase table

One Esc does one thing. The table is phase order, then numeric order inside the escape-layers phase. It is not an enumerated list that puts `narrowOverlay` (10) ahead of an Ops layer at 15. Higher `ESCAPE_PRIORITY` closes first (`escape-layers.ts:20`). Capture-phase items are not priorities. They run first because they sit on the window capture listener.

### Phase A — capture, before combo dispatch

Same listener: `use-keybinds.ts:631` (`capture: true`). Source order inside `onKeyDown`:

| Step | Layer | Source | One Esc does |
|---|---|---|---|
| A1 | Session switcher, if `switcherActive()` | `use-keybinds.ts:497-502` | `closeSwitcher`, `preventDefault`, `stopPropagation`, return. Nothing under it runs. |
| A2 | Find bar, if `$findInPage.active` and the combo is `escape` | Find bar's own capture listener `src/components/find-bar.tsx:237-258` (`addEventListener` at `:256`). Dispatcher yields at `use-keybinds.ts:517-519` via `findBarClaimsCombo` (`find-in-page.ts:117`). `stopPropagation` on the bar does not suppress the dispatcher: both listeners are on `window` (`find-in-page.ts:109-114`). | Close the find bar. Do not also run `composer.cancel`. |
| A3 | Approval deny | `handleApprovalKey(event)` at `use-keybinds.ts:521`. Body `approval-keys.ts:29`. Deny selector `[data-approval-deny]` at `:79`, click at `:91`. | Deny, never approve. Only when the stack owns the target. BR-ESC-SKIP: if `event.target` is inside `[data-ops-root]` and not inside `[data-approval-stack]`, return false and do not click deny. |

A1 and A2 still win when Ops is focused underneath. They are overlays, not a hover claim.

### Phase B — Radix self-stop

Not an `ESCAPE_PRIORITY` number. Radix dialogs, alertdialogs, menus, listboxes, and poppers stop the event themselves (`escape-layers.ts:8-9`). App handlers must bail when `event.defaultPrevented` (`escape-layers.ts:12-13`).

The command palette is `DialogPrimitive.Content` (`src/app/command-palette/index.tsx:1610`). On a nested page, the input handler at `:1653-1658` `preventDefault` + `stopPropagation` and calls `goBack` (`:769-771`), which steps `PAGE_PARENTS` (`:165`). On the root page that handler returns (`:1649-1651`) and Radix closes the dialog. `overlay-view.tsx:50-52` already records that a nested Radix dialog (the model picker inside Settings) closes first. Ops does not add a second Esc that also closes the palette. An Ops page uses `goBack`.

Phase B is after phase A because A is window capture and these handlers are on the dialog content. It is before phase C because phase C bails on `defaultPrevented`.

### Phase C — escape-layers stack, higher number first

A layer acts only when it is registered, the event is not `defaultPrevented`, and `isTopEscapeLayer(myPriority)` (`escape-layers.ts:11-16`). Existing handlers are bubble, not capture: `zone-editor.tsx:136` / listener `:148`, `overlay-view.tsx:57` / listener `:66`, `narrow-overlays.tsx:135` / listener `:144`. Ops layers join this stack. They do not add a capture listener that races phase A.

| Priority | Layer | Source | One Esc does |
|---|---|---|---|
| 50 | In-flight pane drag | `ESCAPE_PRIORITY.drag` `escape-layers.ts:29` | Abort the drag. Do not also exit edit mode or leave full-screen. |
| 40 | Full-page overlay | `ESCAPE_PRIORITY.overlay` `:25` | Close that overlay. |
| 30 | Zone editor | `ESCAPE_PRIORITY.zoneEditor` `:24` | Close the editor. |
| 20 | Layout edit | `ESCAPE_PRIORITY.layoutEdit` `:23` | Exit edit mode. |
| 15 | Ops shortcut sheet, Ops inspector popover, or Ops dock while that one is an overlay | Not in `ESCAPE_PRIORITY` today. BR-ESC-REGISTER. | Close that one layer. A narrow overlay at 10 does not close first. |
| 10 | Desktop narrow overlay | `ESCAPE_PRIORITY.narrowOverlay` `:22` | Close the reveal. Does not run while 15 is open, because 15 outranks 10. |
| 5 | Ops full-screen → restore split | Not in the map today. BR-ESC-REGISTER. | Restore the hot-hidden set. ⤢ is the mouse twin. Does not run while any row above is open. Does not deny an approval and does not cancel a run. |

15 sits in the gap the file already documents (`escape-layers.ts:20`: gaps leave room). 5 sits under every existing number. There is no row that lists 10 before 15.

### BR-ESC-REGISTER

Owner phase: P0.5 (PLAN.md task 3). While an Ops shortcut sheet, inspector popover, or overlay dock is open, `pushEscapeLayer(15)` and dispose on close. One registration per open layer. While Ops is full-screen, `pushEscapeLayer(5)` and dispose when the split is restored. Do not register full-screen at 15. Do not register the sheet at 10.

### BR-ESC-TIE

Owner phase: P0.5, before two Ops layers at 15 can be open together. `isTopEscapeLayer` (`escape-layers.ts:45-49`) returns false only when some registration has a strictly greater priority. Two open layers at 15 are both top. `escape-layers.test.ts:22-26` documents that ties act. Innermost-only is therefore not true of the function as it stands.

P0.5 changes the tie-break: among registrations at the winning priority, only the most recently pushed acts. `pushEscapeLayer` already stores a unique symbol per registration (`:35-37`); the `Map` insertion order is the clock. `isTopEscapeLayer` must return true for at most one open registration. Update `escape-layers.test.ts:22` in that same change. Do not paper over the tie by giving nested sheets different numbers that would reorder 10 and 15.

### BR-ESC-SKIP — Ops Esc never denies or cancels the hidden chat

Owner phase: P0.5 (PLAN.md task 3).

`handleApprovalKey` runs in capture, before any phase C bubble handler. `activeApprovalStack` (`approval-keys.ts:14-24`) follows `getActiveComposer()`, not `event.target`. An Esc inside Ops can therefore deny a chat approval that is not the event target, including a chat that is `hot-hidden`.

`composer.cancel` (`actions.ts:325`) is a readonly label. It is not a `$comboIndex` action. The live cancel is `useComposerEscCancel` (`src/app/chat/composer/hooks/use-composer-esc-cancel.ts:31-60`), a bubble listener (`:65`, no capture flag). It bails on `defaultPrevented` and on `composerFocusBlockedBySurface()` (`:54-56`). A split Ops pane is not in that surface list. A hot-hidden composer can still be the active composer while focus is in Ops, so BR-FOCUS-SURFACE alone is not the deny guard.

Required checks, both, in P0.5:

- In `handleApprovalKey` (`approval-keys.ts:29`) or immediately before the call at `use-keybinds.ts:521`: if `event.target` is inside `[data-ops-root]` and not inside `[data-approval-stack]`, return false. Do not click `[data-approval-deny]` or `[data-approval-run]`.
- In `useComposerEscCancel`, before `onCancel()` (`:60`): if `document.activeElement` is inside `[data-ops-root]`, return. Do not cancel a run because the chat pane is hidden.

An Esc inside Ops never triggers approval deny and never triggers composer cancel for the hidden chat.

### BR-FOCUS-SURFACE

Owner phase: P0.5 (PLAN.md task 3). Teach `composerFocusBlockedBySurface` (`composer-focus-keys.ts:149-155`) to treat `[data-ops-root]` like `[data-terminal]`. Without it, `/`, `G`, `N`, `J`, `K`, `E`, `?`, `[`, `]` type into the composer and the bare-letter rows are unimplemented. The owner assignment is not in dispute.

## 5. Ctrl+J is not the dock — P0 decision D-CTRLJ

SPEC.md:256 delegates the collision check to P0: "Ctrl+W, Ctrl+Tab, `/`, and Ctrl+J are collision-checked against Electron/Desktop bindings in P0." SPEC.md:250 and the wireframe at SPEC.md:334 name Ctrl+J as the dock chord. Those lines are the check input. This audit does not edit them and does not treat the refusal as a SPEC change.

Check result: `view.toggleRightSidebar` owns `mod+j` (`actions.ts:162`) and reveals the pane that already hosts the interactive terminal (`src/app/contrib/controller.tsx:235`, `id: 'terminal'`). A default Ops claim would steal that toggle. Hover-first `tabTargetGroup` (`tree/store.ts:521-538`) would also make a "focused Ops" claim lie whenever the pointer sits in another zone.

P0 decision, recorded here, not written back into SPEC:

- Ctrl/Cmd+J stays `view.toggleRightSidebar` in every focus state, including focused Ops.
- Ops dock toggle is the status-bar item (O65, right cluster) plus a later contributed action `ops.toggleDock` shipped unbound (`defaults: []`), same pattern as `view.showFiles` (`actions.ts:181`). Users may bind it. No default is claimed.
- Mouse ⤢ / dock button do not depend on a chord.

A later phase must not "fix" this by rewriting SPEC.md:250. If a default dock chord is still wanted, that is a new SPEC delta from the planner, not a silent edit.

## 6. Ledger

A row is unresolved only when it has none of: an existing-code resolution, a named bounded requirement with an owner phase, or a recorded P0 decision. Unresolved count is 0 on that definition. It is not a claim that P0.5 has landed, and it is not a judge signature. Judge r2 signs, or records a concrete blocker and keeps the signature pending.

| Id | Chord | Verdict |
|---|---|---|
| K1 | Ctrl/Cmd+W | Bounded requirement BR-CLOSE. Owner phase P0.5. Both the IPC path (`main.ts:6953-6972` → `use-desktop-integrations.ts:513-523`) and the keydown path (`use-keybinds.ts:567-575` / handler `:374`) call `routeCloseTabChord`. Order: PTY word-erase → focused Ops strip (non-pinned) → `closeActiveTab`. Not resolved by the current direct `closeActiveTab`. |
| K2 | Ctrl+Tab | Bounded requirement BR-DISPATCH. Owner phase P0.5. Pre-dispatch check in `use-keybinds.ts` after `:523`, before `:541`. Not a contributed passthrough (`actions.ts:263-272`). |
| K3 | `/` | Tied to BR-FOCUS-SURFACE. Owner phase P0.5. Rail filter only inside focused `[data-ops-root]`, outside editables. |
| K4 | Ctrl/Cmd+J | P0 decision D-CTRLJ, per SPEC.md:256. Desktop keeps `mod+j`. Not a SPEC change. |
| K5 | Ctrl/Cmd+K | Bounded requirement BR-DISPATCH. Owner phase P0.5. Same check as K2. `mod+p` stays the Desktop alias. |
| K6 | Ctrl/Cmd+, | Bounded requirement BR-DISPATCH. Owner phase P0.5. Same check as K2. |
| K7 | G-chords | Tied to BR-FOCUS-SURFACE. Owner phase P0.5. Root-local leader. `mod+g` stays review. Lone G is not approve. |
| K8 | Esc | Bounded requirements BR-ESC-REGISTER, BR-ESC-TIE, BR-ESC-SKIP. Owner phase P0.5. Phase table in §4. Equal-priority tie-break is not in `isTopEscapeLayer` (`escape-layers.ts:45-49`) today. |
| K9 | single-key approve | Resolved by existing code. `approval-keys.ts:35` rejects every key except Enter and Escape. Enter/Esc inside Ops are enforced by BR-ESC-SKIP so a visible or hidden chat approval is not the Ops key. |

Unresolved count: 0.

Not signed from a keypress. Production Desktop (`apps/desktop/release/win-unpacked/Hermes.exe`) must not receive these chords. Judge r2 runs them in an isolated Desktop (separate `HERMES_HOME` / profile) or records the concrete blocker and keeps the signature pending.

## 7. Evidence for P0-02

O64: interactive terminal exists (`electron/terminal-ipc.ts` `nodePty.spawn` at `:326`). Ops dock reuses `LogTail` (`src/components/chat/log-tail.tsx:39`) and does not spawn a PTY. Detail: `desktop-surface-audit.md` §2. Unchanged in r2.

R23: the focus-ownership table in §3 is the keymap. Active only inside focused Ops, outside editables, focus not hover. `/` does not collide with composer slash once BR-FOCUS-SURFACE lands. No single-key approve. `P` is undefined. Esc closes only the innermost layer once BR-ESC-REGISTER, BR-ESC-TIE, and BR-ESC-SKIP land; until then K8 is a named requirement, not an open collision and not a signed keypress. Do not consume an r1 "unresolved = 0" line as the signature.

## 8. Verify a later worker can re-run

Static, no production mutation:

- `view.closeTab` defaults include `mod+w`: `src/lib/keybinds/actions.ts:207`
- IPC close-tab claim: `electron/main.ts:6953-6972` `sendClosePreviewRequested()`
- IPC renderer body: `src/app/contrib/hooks/use-desktop-integrations.ts:513-523`
- keydown close guard, before `preventDefault`: `src/app/hooks/use-keybinds.ts:567-575`, handler `:374`, `preventDefault` at `:586`
- `wordEraseFocusedTerminal`: `src/app/right-sidebar/terminal/terminal-context-menu.ts:56`
- `closeActiveTab`: `src/app/chat/close-tab.ts:69`
- contributions append after built-ins and drop passthrough: `actions.ts:263-272`
- combo index preserves that order: `src/store/keybinds.ts:99-115`
- passthrough continue requires the flag: `use-keybinds.ts:588`
- hover before focus: `src/components/pane-shell/tree/store.ts:521-538`
- `session.next` defaults include `ctrl+tab`: `actions.ts:126`
- `composer.focus` defaults include `/`: `actions.ts:84`
- `view.toggleRightSidebar` defaults include `mod+j`: `actions.ts:162`
- `nav.commandPalette` defaults include `mod+k`: `actions.ts:147`
- `nav.settings` defaults include `mod+,`: `actions.ts:149`
- `view.toggleReview` defaults include `mod+g`: `actions.ts:180`
- `view.showFiles` ships unbound: `actions.ts:181`
- no `g o` / chord-leader token in `actions.ts`
- `handleApprovalKey` rejects every key except Enter and Escape: `approval-keys.ts:35`; deny click `:79-91`; called at `use-keybinds.ts:521`
- switcher Esc: `use-keybinds.ts:497-502`
- find bar capture: `src/components/find-bar.tsx:256`; claim list `find-in-page.ts:117`
- `isTopEscapeLayer` has no equal-priority tie-break: `src/lib/escape-layers.ts:45-49`
- ties act today: `src/lib/escape-layers.test.ts:22-26`
- bubble escape handlers: `zone-editor.tsx:148`, `overlay-view.tsx:66`, `narrow-overlays.tsx:144`
- palette Radix content: `src/app/command-palette/index.tsx:1610`; submenu Esc `:1655-1658`
- composer cancel bubble listener: `src/app/chat/composer/hooks/use-composer-esc-cancel.ts:31-65`
- `nodePty.spawn` exists: `electron/terminal-ipc.ts:326`
- `LogTail` export: `src/components/chat/log-tail.tsx:39`
- SPEC collision-check delegation: `01-Projects/Hermes/desktop-ops-panel/SPEC.md:256`
- SPEC responsive row, unchanged: `SPEC.md:673`

Do not send those chords to the installed Desktop.
