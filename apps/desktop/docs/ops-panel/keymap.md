# Ops keymap (P0-04)

Status: r3. Ownership is frozen. Where the tree cannot enforce a row yet, the row names a bounded requirement and an owner phase. No keybind was registered. No production Desktop received a key.
Base: `865ba906c1a`. Branch docs amended on `ops/P0-04`. Companion: `desktop-surface-audit.md`.
Rows: O48, O51, O52, O55, R23, plus the chords named in the task (Ctrl+W, Ctrl+Tab, `/`, Ctrl+J, Ctrl+K, Ctrl+comma, G-chords, Esc).
r2 delta: meta card `t_af2eb38d` comment 625. r3 delta: meta card `t_09ee6747` comment 637. This file does not relax a SPEC row.

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
| Ctrl/Cmd+W | Focused Ops tab strip. Close the active non-pinned Ops tab (O48). Pinned Office/Canvas/Board tabs do not close, and the chord does not then close a Desktop tab. | `view.closeTab`. Bare default `mod+w` (no alt/shift) over a focused interactive terminal is one PTY ^W, not a close. A rebound and Ctrl/Cmd+Shift+W close. | Bounded requirement BR-CLOSE. Not a combo passthrough. |
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
| Esc | Innermost open layer only. §4. | same phases | Bounded requirements BR-ESC-CAPTURE, BR-ESC-REGISTER, BR-ESC-TIE, BR-ESC-SKIP. |
| any single letter used as Approve | nobody | nobody | Resolved by existing code. `approval-keys.ts:35` is Enter/Escape only. R23 "P" stays undefined. "Go to next approval" is a palette command that moves focus. It does not call `approval.respond`. |

R23: this table is the fusion keymap. It is active only inside focused Ops and only outside editables. `/` does not collide with composer slash commands because the soft `/` stands down once BR-FOCUS-SURFACE lands, and a focused composer never sits inside `[data-ops-root]`.

### BR-CLOSE — detection does not write; one producer per entry

Owner phase: P0.5 (PLAN.md task 3, keymap, on the tab strip from task 2). Not this card. No shell code here.

`wordEraseFocusedTerminal` (`src/app/right-sidebar/terminal/terminal-context-menu.ts:56-60`) is not a query. It calls `handle.wordErase()`, and that writes `'\x17'` (`src/app/right-sidebar/terminal/use-terminal-session.ts:875`, body `:867-877`). Calling it both detects and produces the byte. No rung may do both.

Add `focusedInteractiveTerminalOwnsWordErase(): boolean` in that same file. Side-effect-free. `document.activeElement?.closest('[data-interactive-terminal]')`, then `handles.get` for a live handle whose `wordErase` is a function — the same lookup as `:57-60`, without the call. Do not call `wordErase`. Do not write. A read-only mirror has `wordErase: null` (`src/app/right-sidebar/terminal/use-agent-terminal.ts:107`) and returns false, so it stays closeable.

Add `routeCloseTabChord` in `src/app/chat/close-tab.ts`, beside `closeActiveTab` (`:69`). It returns `'pty' | 'ops-closed' | 'ops-pinned-consumed' | 'desktop-closed'`. It never writes and never calls `wordEraseFocusedTerminal`.

The PTY rung applies only to the platform's bare default close shape: `mod+w`, no alt, no shift. That is `windowAcceleratorAction`'s `close-tab` (`electron/window-accelerator.ts:44` excludes alt, `:50` excludes shift, `:55` returns `close-tab`) and the keydown guard (`use-keybinds.ts:567-575`). A rebound `view.closeTab` (handler `:374`) skips this rung and closes. Ctrl/Cmd+Shift+W is `view.closeTerminal` (`src/lib/keybinds/actions.ts:201`), not this function; it never takes the PTY rung.

Order, bare default shape only:

1. Query. `focusedInteractiveTerminalOwnsWordErase()`. If true, return `'pty'`. Stop. No write, no close.
2. Focused Ops strip. DOM focus inside `[data-ops-root]` (IPC: `document.activeElement`; keydown: `event.target`). Not `$hoveredTreeGroup`. Not `tabTargetGroup`. Target is not an editable and not inside `OVERLAY_SURFACE`. Close the active Ops tab when it is not pinned and return `'ops-closed'`. If it is pinned, consume the chord, close nothing, return `'ops-pinned-consumed'`. Do not fall through to `closeActiveTab` while Ops focus holds.
3. `closeActiveTab(loadSessionIntoWorkspace)` (`close-tab.ts:69`). Return `'desktop-closed'`. A focused `[data-terminal]` still closes through `closeActiveTerminal` (`close-tab.ts:76-78`).

A rebound passes a shape flag and starts at step 2. Step 1 does not run.

Exactly one producer of `'\x17'` per entry. These are not two producers on one keydown. The r2 text put the relay and the xterm passthrough on the same entry; that is the defect this section removes.

- IPC entry. `electron/main.ts:6953-6972` already `preventDefault` (`:6954`) and sends `sendClosePreviewRequested()`. That claim stops the key before xterm (`terminal-context-menu.ts:7-9`). Renderer body: `use-desktop-integrations.ts:513-523`. Replace the `wordEraseFocusedTerminal` / `closeActiveTab` body with `routeCloseTabChord` (bare-default shape). On `'pty'`, the caller relays once via `wordEraseFocusedTerminal()` — one `terminalApi.write(sessionId, '\x17')`. Do not also leave the key for xterm. Do not call the writer during detection. If the relay returns false, no byte was written (`use-terminal-session.ts:871-872`, session gone); then run steps 2–3. That is zero bytes plus a close, not a second producer. On any other result, do not call `wordErase`. Update the stale comment at `:508-511` in the same change.
- Keydown entry, bare default. The guard at `use-keybinds.ts:567-575`, before `event.preventDefault()` (`:586`). On `'pty'`, return without `preventDefault` and do not call `wordEraseFocusedTerminal`. Zero relay writes. xterm alone writes `^W`. The handler at `:374` must not also run. This entry's `'pty'` match is the guard's existing `isFocusWithin('[data-interactive-terminal]')` (`:573`, `combo.ts:247-248`). That check is side-effect-free and does not require a registered handle. `use-keybinds-close-tab.test.tsx:99-105` focuses the marker, registers no handle, and requires `defaultPrevented === false` and no close. Do not replace that match with the handle-only query or that test fails. The handle query is the IPC detection rung: a missing handle has nothing to relay, and the close rungs run, as `wordEraseFocusedTerminal()` returns false today. When this guard does not match, call `routeCloseTabChord` and `preventDefault` on `'ops-closed'`, `'ops-pinned-consumed'`, or `'desktop-closed'`.
- Keydown entry, rebound. Handler `:374` calls `routeCloseTabChord` with the rebind shape, so step 1 does not run. `mod+alt+w` inside an interactive terminal closes. It does not word-erase. Contract: `use-keybinds-close-tab.test.tsx:115-128`. Shift+W (`:115-119`) closes via `closeActiveTerminal` and never enters this PTY rung. Rebound `mod+alt+w` (`:121-128`) has `defaultPrevented === true` and `closeActiveTerminal` called.

A contributed `mod+w` with `passthrough` does not satisfy this. The IPC path never enters the combo loop.

P0.5 verify, per entry, not a production keypress:

- IPC default, live session → one `\x17` and no close.
- Keydown default → `defaultPrevented === false` and 0 relay writes.
- Rebind `mod+alt+w` in a terminal → close.
- Pinned Ops tab → consumed, nothing closed (`'ops-pinned-consumed'`).

If one physical bare `mod+w` is observed on both entries, that is two producers and fails "exactly one `'\x17'` per chord". Main's claim is what keeps those entries apart (`terminal-context-menu.ts:7-9`). Do not stack the relay and the xterm write on either entry.

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

One Esc does one thing. The table is phase order, then numeric order inside the escape-layers phase. It is not an enumerated list that puts `narrowOverlay` (10) ahead of an Ops layer at 15. Higher `ESCAPE_PRIORITY` closes first (`escape-layers.ts:20`). Capture-phase items are not priorities. They run before phase C because they are window capture listeners, not because one of them suppresses the other. See BR-ESC-CAPTURE.

### Phase A — capture, before combo dispatch

Not one listener. The switcher Esc and the find-bar Esc are sibling `window` capture listeners. `stopPropagation` does not suppress the other one. Their order is registration order: the dispatcher is mounted at app start (`use-keybinds.ts:631`); the find listener is added when the bar opens (`find-bar.tsx:256`). The source already says this (`find-in-page.ts:109-114`, and the comment at `use-keybinds.ts:510-516`).

| Step | Layer | Source | One Esc does |
|---|---|---|---|
| A1 | Session switcher, if `switcherActive()` | Dispatcher `use-keybinds.ts:497-502`. Listener `:631`. | `closeSwitcher`, `preventDefault`, `stopPropagation`, return from this listener only. That return does not suppress the find-bar sibling. |
| A2 | Find bar, if `$findInPage.active` and the combo is `escape` | Find bar's own capture listener `src/components/find-bar.tsx:237-258` (`addEventListener` at `:256`). `findBarKeyAction` returns `'close'` for bare Escape (`find-in-page.ts:78-79`). It does not check `switcherActive()` or `defaultPrevented`. The dispatcher yields at `use-keybinds.ts:517-519` via `findBarClaimsCombo` (`find-in-page.ts:116-118`) and does not itself close the bar. | Today this sibling also closes the bar. With both open, one Esc closes both. That is not innermost-only. BR-ESC-CAPTURE is the fix. It is not true of this tree yet. |
| A3 | Approval deny | `handleApprovalKey(event)` at `use-keybinds.ts:521`. Body `approval-keys.ts:29`. Deny selector `[data-approval-deny]` at `:79`, click at `:91`. | Deny, never approve. Only when the stack owns the target. BR-ESC-SKIP: if `event.target` is inside `[data-ops-root]` and not inside `[data-approval-stack]`, return false and do not click deny. |

A1 and A2 are overlays, not a hover claim. Until BR-ESC-CAPTURE lands they are not exclusive of each other. A return in the dispatcher does not suppress the find-bar sibling.

### BR-ESC-CAPTURE — one Esc, one of these two siblings

Owner phase: P0.5 (PLAN.md task 3). Not this card.

Mechanism, one: the dispatcher owns find-bar Escape. Not mutual exclusion. Opening the switcher does not close the find bar, and opening the find bar does not close the switcher.

Enforcement site: `use-keybinds.ts` `onKeyDown`, the existing `findBarClaimsCombo` branch at `:517-519`, which already runs after the switcher check at `:497-502`.

- Switcher wins when both are open. The check at `:497-502` stays first in that function. One Esc closes only the switcher.
- A second Esc, switcher already closed, find bar still open, hits `:517-519`. When `combo === 'escape'`, that branch calls `closeFindBar()` (`src/store/find-in-page.ts:46`), `preventDefault`, and returns. It must close, not only yield.
- The find-bar sibling (`find-bar.tsx:237-258`) must not act on Escape. If `findBarKeyAction` returns `'close'`, return without `preventDefault`, `stopPropagation`, or `closeFindBar`. Keep `mod+g` / `mod+shift+g` on that listener. After this, registration order cannot close both: only the dispatcher closes on Escape, and it closes one layer.
- That `preventDefault` is what keeps the rest of this listener from running approval deny (`:521`) and what makes composer cancel bail (`use-composer-esc-cancel.ts:35` checks `defaultPrevented`; listener is bubble at `:65`). Ops full-screen and the Ops sheet are phase C. They join the escape-layers stack (BR-ESC-REGISTER) and bail on `defaultPrevented` (`escape-layers.ts:12-13`). They do not run on this Esc.

Layer that wins: the switcher. Not because it registered last — sibling order is not the owner. It wins because the single dispatcher tests it before the find-bar branch. A second Esc closes the find bar.

P0.5 verify: switcher and find bar open, in both mount orders, one Esc closes exactly one. Ops full-screen / sheet underneath is untouched. No approval deny. No composer cancel.

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

A row is unresolved only when it has none of: an existing-code resolution, a named bounded requirement with an owner phase, or a recorded P0 decision. Unresolved count is 0 on that definition. It is not a claim that P0.5 has landed, and it is not a judge signature. Judge r3 signs, or records a concrete blocker and keeps the signature pending.

| Id | Chord | Verdict |
|---|---|---|
| K1 | Ctrl/Cmd+W | Bounded requirement BR-CLOSE. Owner phase P0.5. Detection is `focusedInteractiveTerminalOwnsWordErase()` and does not write. IPC (`main.ts:6953-6972` → `use-desktop-integrations.ts:513-523`) relays once on `'pty'`. Keydown bare default (`use-keybinds.ts:567-575`) does not relay. Rebound (handler `:374`) and Ctrl/Cmd+Shift+W skip the PTY rung and close. Not resolved by the current direct `closeActiveTab`. |
| K2 | Ctrl+Tab | Bounded requirement BR-DISPATCH. Owner phase P0.5. Pre-dispatch check in `use-keybinds.ts` after `:523`, before `:541`. Not a contributed passthrough (`actions.ts:263-272`). |
| K3 | `/` | Tied to BR-FOCUS-SURFACE. Owner phase P0.5. Rail filter only inside focused `[data-ops-root]`, outside editables. |
| K4 | Ctrl/Cmd+J | P0 decision D-CTRLJ, per SPEC.md:256. Desktop keeps `mod+j`. Not a SPEC change. |
| K5 | Ctrl/Cmd+K | Bounded requirement BR-DISPATCH. Owner phase P0.5. Same check as K2. `mod+p` stays the Desktop alias. |
| K6 | Ctrl/Cmd+, | Bounded requirement BR-DISPATCH. Owner phase P0.5. Same check as K2. |
| K7 | G-chords | Tied to BR-FOCUS-SURFACE. Owner phase P0.5. Root-local leader. `mod+g` stays review. Lone G is not approve. |
| K8 | Esc | Bounded requirements BR-ESC-CAPTURE, BR-ESC-REGISTER, BR-ESC-TIE, BR-ESC-SKIP. Owner phase P0.5. Phase table in §4. A1/A2 are sibling capture listeners; BR-ESC-CAPTURE makes exactly one act (dispatcher owns find-bar Escape at `use-keybinds.ts:517-519`, after the switcher check at `:497-502`; switcher wins; a second Esc closes the find bar). Equal-priority tie-break is not in `isTopEscapeLayer` (`escape-layers.ts:45-49`) today. |
| K9 | single-key approve | Resolved by existing code. `approval-keys.ts:35` rejects every key except Enter and Escape. Enter/Esc inside Ops are enforced by BR-ESC-SKIP so a visible or hidden chat approval is not the Ops key. |

Unresolved count: 0.

Not signed from a keypress. Production Desktop (`apps/desktop/release/win-unpacked/Hermes.exe`) must not receive these chords. Judge r3 runs them in an isolated Desktop (separate `HERMES_HOME` / profile) or records the concrete blocker and keeps the signature pending.

## 7. Evidence for P0-02

O64: interactive terminal exists (`electron/terminal-ipc.ts` `nodePty.spawn` at `:326`). Ops dock reuses `LogTail` (`src/components/chat/log-tail.tsx:39`) and does not spawn a PTY. Detail: `desktop-surface-audit.md` §2. Unchanged in r3.

R23: the focus-ownership table in §3 is the keymap. Active only inside focused Ops, outside editables, focus not hover. `/` does not collide with composer slash once BR-FOCUS-SURFACE lands. No single-key approve. `P` is undefined. Esc closes only the innermost layer once BR-ESC-CAPTURE, BR-ESC-REGISTER, BR-ESC-TIE, and BR-ESC-SKIP land. Until then K8 is a named requirement, not an open collision and not a signed keypress. A1/A2 are not exclusive in this tree; BR-ESC-CAPTURE is the owner. Do not consume an r1 or r2 "unresolved = 0" line as the signature.

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
- `wordEraseFocusedTerminal` writes, it does not query: `src/app/right-sidebar/terminal/terminal-context-menu.ts:56-60`; byte at `src/app/right-sidebar/terminal/use-terminal-session.ts:875`
- mirror `wordErase: null`: `src/app/right-sidebar/terminal/use-agent-terminal.ts:107`
- `closeActiveTab` terminal rung: `src/app/chat/close-tab.ts:76-78`
- bare-default shape: `electron/window-accelerator.ts:44`, `:50`, `:55`
- `view.closeTerminal`: `src/lib/keybinds/actions.ts:201`
- keydown passthrough predicate: `src/lib/keybinds/combo.ts:247-248`, used at `use-keybinds.ts:573`
- close-tab contract: `src/app/hooks/use-keybinds-close-tab.test.tsx:99-105`, `:115-128`
- main already consumed the key: `electron/main.ts:6954`; claim stops the key before xterm: `src/app/right-sidebar/terminal/terminal-context-menu.ts:7-9`
- find-bar Escape is `'close'`: `src/lib/find-in-page.ts:78-79`; sibling note `:109-114`; `findBarClaimsCombo` `:116-118`
- dispatcher yield comment: `src/app/hooks/use-keybinds.ts:510-516`; find-bar branch `:517-519`
- `closeFindBar`: `src/store/find-in-page.ts:46`
- composer cancel bails on `defaultPrevented`: `src/app/chat/composer/hooks/use-composer-esc-cancel.ts:35`; bubble listener `:65`
- SPEC collision-check delegation: `01-Projects/Hermes/desktop-ops-panel/SPEC.md:256`
- SPEC responsive row, unchanged: `SPEC.md:673`

Do not send those chords to the installed Desktop.
