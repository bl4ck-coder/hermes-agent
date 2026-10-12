# Ops keymap (P0-04)

Status: frozen ownership. No keybind was registered. No production Desktop received a key.
Base: `865ba906c1a`. Companion: `desktop-surface-audit.md`.
Rows: O48, O51, O52, O55, R23, plus the chords named in the task (Ctrl+W, Ctrl+Tab, `/`, Ctrl+J, Ctrl+K, Ctrl+comma, G-chords, Esc).

Invariant already in tree (`src/lib/find-in-page.ts:112-114`): keyboard ownership follows focus, and one cancel gesture does one thing. Ops joins that invariant. It does not add a second dispatcher.

## 1. How Desktop owns keys today

Source of truth: `src/lib/keybinds/actions.ts` `KEYBIND_ACTIONS`. Handlers: `src/app/hooks/use-keybinds.ts` (window `keydown`, capture, `:631`). Editable gate: `isEditableTarget` (`combo.ts:260`) and `actionAllowedInInput` (`combo.ts:291`). A primary-modifier chord (Ctrl/Cmd) fires even inside a text field (`combo.ts:314-315`). Bare letters do not, unless the action is on `INPUT_SAFE_ACTIONS` (`combo.ts:271-280`).

Unbound printables on empty chrome type into the composer (`use-keybinds.ts:527-534`, `typeToFocusChar`). Soft `/` and Enter are `composer.focus` (`actions.ts:84`) and only run when `composerFocusKeysAllowed` (`composer-focus-keys.ts:172`). That function stands down for editables, overlays, the session switcher, full pages, and `[data-terminal]` (`composerFocusBlockedBySurface`, `:149-155`). A split pane is not a full page, so an Ops pane does not get this stand-down until `[data-ops-root]` is added there. That addition is a bounded requirement (below). It is not an unresolved collision: the owner is already assigned.

Approval keys are Enter and Escape only (`approval-keys.ts:35`). There is no Y/A/single-key approve. Enter on an active `[data-approval-stack]` clicks `[data-approval-run]` (`:79-91`). That is the hazard Ops Enter must not inherit.

Electron does not register a menu accelerator for Ctrl/Cmd+W. Windows Close is click-only (`electron/window-menu.ts:16-26`, `registerAccelerator: false`). macOS Close has no accelerator (`electron/main.ts:6772-6779`). Main-process `windowAcceleratorAction` (`electron/window-accelerator.ts:33`) classifies Ctrl/Cmd+W as `close-tab` (`:55`) and swallows auto-repeat and the 200ms focus grace (`:51-53`) so a foreign Ctrl+W cannot close a tab here.

## 2. Disputed chords — source inventory

`mod` is Cmd on macOS and Ctrl elsewhere. On Windows the task's Ctrl+* rows are the `mod+*` rows.

| Chord | Desktop owner | File:line | Fires in an editable? |
|---|---|---|---|
| Ctrl/Cmd+W | `view.closeTab` = `mod+w`. Main claims it first (`close-tab`). Focus inside `[data-interactive-terminal]` re-delivers ^W to the PTY and does not close. | `actions.ts:207`; `use-keybinds.ts:568-575`; `window-accelerator.ts:50-55` | Yes (primary modifier), except the PTY surface |
| Ctrl+Shift+W | `view.closeTerminal` | `actions.ts:201` | Yes |
| Ctrl+Tab | `session.next` = `ctrl+tab`, `ctrl+pagedown`. Ctrl keyup commits the session switcher. | `actions.ts:126`; `use-keybinds.ts:598-611` | Yes (`INPUT_SAFE_ACTIONS`) |
| Ctrl+Shift+Tab | `session.prev` | `actions.ts:127` | Yes |
| `/` | `composer.focus` soft combo, and `composer.slash` when the composer already has focus | `actions.ts:84`, `:322`; `composer-focus-keys.ts:17` | Stays in the field. Does not run the soft focus. |
| Ctrl/Cmd+J | `view.toggleRightSidebar` = `mod+j` | `actions.ts:162` | Yes |
| Ctrl/Cmd+K | `nav.commandPalette` = `mod+k` (also `mod+p`) | `actions.ts:147` | Yes (`INPUT_SAFE_ACTIONS`) |
| Ctrl/Cmd+, | `nav.settings` = `mod+,` | `actions.ts:149` | Yes |
| G then key | no leader. Bare `g` is type-to-focus. | `use-keybinds.ts:527-534` | Types `g` |
| Ctrl/Cmd+G | `view.toggleReview` = `mod+g`. Find bar steals `mod+g` while open. | `actions.ts:180`; `find-in-page.ts:116-117` | Yes, unless find bar is open |
| Esc | several layers; see §4. Not one global "close everything". | `escape-layers.ts:21-30` | Depends on layer |
| Enter | `composer.focus` soft, `composer.send` / `composer.steer` inside the composer, and approval-run when a stack is active | `actions.ts:84`, `:316-318`; `approval-keys.ts:79` | Composer owns it. Approval owns it when the stack is the active composer target. |

No default binding is `mod+shift+j`, a G-leader, or a single-key approve. `appearance.toggleMode` is `shift+x` (`actions.ts:224`), unrelated.

Menu accelerators that do exist (`electron/main.ts:6827-6849`): `Ctrl+Shift+I` (devtools), `CommandOrControl+0`, `CommandOrControl+Plus`, `CommandOrControl+-`. They are not Ops chords. Leave them.

## 3. Frozen focus-ownership table

Rule for every Ops shortcut:

1. The event target is inside `[data-ops-root]`, and that pane is the focused zone.
2. The target is not an editable (`isEditableTarget`) and not inside `OVERLAY_SURFACE` (`combo.ts:255`).
3. Otherwise the chord falls through to the Desktop owner in §2. Ops handlers return without `preventDefault` when they decline.

Ops must not register a global default that fires outside that root. Contributed keybinds (`KEYBINDS_AREA`, `actions.ts:238`) are global. Use them only for chords whose handler declines unless rule 1–2 hold. Bare-letter Ops chords are not contributed defaults; they are root-local, after `composerFocusBlockedBySurface` learns `[data-ops-root]`.

| Chord | Owner when Ops is focused and the target is not editable | Owner otherwise | Collision status |
|---|---|---|---|
| Ctrl/Cmd+W | Focused zone's tab strip. If the focused zone is the Ops tab strip, close the active non-pinned Ops tab (O48). Implement as a passthrough that runs before `view.closeTab` and declines when the focused strip is not Ops. Pinned Office/Canvas/Board tabs do not close. | `view.closeTab`, or PTY ^W if `[data-interactive-terminal]` | Resolved. Not a second global. |
| Ctrl+Tab / Ctrl+Shift+Tab | Cycle Ops document tabs only. Decline so `session.next` / the session switcher keep the chord when Ops is not the focused zone. | `session.next` / `session.prev` | Resolved. |
| `/` | Focus the Ops rail filter. Do not insert `/` into the composer. The filter field, once focused, is editable, so the next `/` is a character (rule 2). | Soft `composer.focus`, or a slash command if the composer is focused | Resolved. SPEC "Search Ops Ctrl K" is not this key. |
| Ctrl/Cmd+J | Desktop. Ops does not claim it. | `view.toggleRightSidebar` | Resolved by refusal. The Orbit dock chord is rejected; see §5. |
| Ctrl/Cmd+K | Same palette. Call `openCommandPalettePage('ops')` instead of toggling a new widget (O38, O52). | `nav.commandPalette` (root page) | Resolved by reuse. `mod+p` stays the Desktop alias and is not an Ops chord. |
| Ctrl/Cmd+, | Open Ops settings (rail item, O55). Theme still deep-links Desktop settings (W9). Do not register a second global. | `nav.settings` | Resolved. |
| `G` then `O/C/B/R/S` | Ops leader, 1s timeout, root-local. `G O` Office, `G C` Canvas, `G B` Board, `G R` Runs, `G S` Skills → `/capabilities`, not a new skills view. A lone `G` does nothing (no type-to-focus, no approve). | type-to-focus, or `mod+g` review if a modifier is held | Resolved. `mod+g` is not a G-chord. |
| `N` | New task. Focuses the create surface. Does not create a session (`session.new` remains `mod+n`). | type-to-focus | Resolved. |
| `?` | Ops shortcut sheet. | `composer.help` if the composer is focused; else type-to-focus | Resolved. |
| `E` | Edit the focused Ops object (opens the existing editor route or the Canvas node). No write in this audit. | type-to-focus | Resolved. |
| `[` / `]` | Toggle Ops rail / inspector (O51). Not `view.toggleSidebar` (`mod+b`) and not `profile.prev` (`mod+shift+[`). | type-to-focus | Resolved. |
| `J` / `K` | Move the Ops selection. Do not scroll the chat. | type-to-focus. Composer history is `up`/`down` (`actions.ts:324`), not J/K. | Resolved. |
| Enter | Open the focused Ops row. Must `preventDefault` before `handleApprovalKey` and before soft `composer.focus`. | Approval Enter only when the target is the approval stack or its composer. Composer Enter sends. | Resolved. See §4 for the required hook. |
| Alt+Left / Alt+Right | Ops tab history back/forward. | No Desktop default owns Alt+Left/Right (text nav stays in editables, `combo.ts:302-311`). | Resolved. Free outside editables; Ops claims them only inside the root. |
| Esc | Innermost open layer only. §4. | same stack | Resolved. |
| any single letter used as Approve | nobody | nobody | Resolved by prohibition. R23 "P" stays undefined. "Go to next approval" is a palette command that moves focus. It does not call `approval.respond`. |

R23: this table is the fusion keymap. It is active only inside focused Ops and only outside editables. `/` does not collide with composer slash commands because the soft `/` stands down once `[data-ops-root]` blocks composer focus, and a focused composer never sits inside that root.

## 4. Esc — innermost layer only

Higher number closes first. A layer acts only when it is top (`isTopEscapeLayer`) and the event is not already `defaultPrevented` (`escape-layers.ts:11-16`). Radix dialogs already stop the event; do not also close the pane under them.

| Order (first to close) | Layer | Source | Ops rule |
|---|---|---|---|
| 1 | Radix dialog, alertdialog, menu, listbox, popper | `OVERLAY_SURFACE` | Ops context menus use Radix. They win. |
| 2 | In-flight pane drag (`ESCAPE_PRIORITY.drag` = 50) | `escape-layers.ts:29` | Do not also exit full-screen. |
| 3 | Full-page overlay (40) | `escape-layers.ts:25` | |
| 4 | Zone editor (30), layout edit (20), narrow overlay (10) | `escape-layers.ts:22-24` | |
| 5 | Ops shortcut sheet, Ops inspector popover, Ops dock if it is an overlay | register with `pushEscapeLayer` at 15 (between narrow overlay and layout edit) only while open | One layer per Esc. |
| 6 | Command palette | existing page step (`command-palette/index.tsx:769-771` `goBack`) | Esc steps `PAGE_PARENTS`, then closes. Ops page uses that. Do not add an Ops Esc that also closes the palette. |
| 7 | Find bar | `findBarClaimsCombo` includes `escape` (`find-in-page.ts:117`) | Beats `composer.cancel` so Esc does not abort a turn. |
| 8 | Session switcher | `use-keybinds.ts:497-502` | |
| 9 | Approval deny | `handleApprovalKey` Escape → `[data-approval-deny]` | Deny, never approve. Only when the stack owns the target. |
| 10 | Composer popover / cancel run | `composer.cancel` (`actions.ts:325`) | Not an Ops concern. |
| 11 | Ops full-screen → restore split | new, priority 5, only while full-screen and nothing above is open | ⤢ remains the mouse twin. Esc does not restore the split if a sheet, palette, dialog, or dock is open. |

Enter vs approval (bounded requirement): `handleApprovalKey` runs in the window capture listener before combo dispatch (`use-keybinds.ts:521`). A later Ops listener on the same node cannot beat it. The fix is inside that function, or a check beside it: if `event.target` is inside `[data-ops-root]` and not inside `[data-approval-stack]`, return false and let the Ops root open the row. Do not click `[data-approval-run]`. This is the only way "no single-key approve" survives a visible chat approval while Ops is focused.

`[data-ops-root]` in `composerFocusBlockedBySurface` is the matching requirement for `/`, `G`, `N`, `J`, `K`, `E`, `?`, `[`, `]`. Without it, those keys type into the composer and the ownership table is unimplemented. The table itself is not in dispute.

## 5. Ctrl+J is not the dock

SPEC §12.2 said the dock's Orbit chord was Ctrl+J, collision-checked. The check fails: `view.toggleRightSidebar` owns `mod+j` (`actions.ts:162`), and that chord reveals the pane that already hosts the interactive terminal (`controller.tsx:246`).

Frozen decision:

- Ctrl/Cmd+J stays `view.toggleRightSidebar` in every focus state, including focused Ops.
- Ops dock toggle is the status-bar item (O65, right cluster) plus a contributed action `ops.toggleDock` shipped **unbound** (`defaults: []`), same pattern as `view.showFiles` (`actions.ts:181`). Users may bind it. No default is claimed.
- Mouse ⤢ / dock button do not depend on a chord.

That is a resolution, not an open collision.

## 6. Ledger — zero unresolved

| Id | Chord | Verdict |
|---|---|---|
| K1 | Ctrl/Cmd+W | Resolved. Zone passthrough. PTY keeps ^W. |
| K2 | Ctrl+Tab | Resolved. Ops cycles its own tabs only while focused and not editable. |
| K3 | `/` | Resolved. Rail filter only inside `[data-ops-root]` non-editable. Composer slash unchanged. |
| K4 | Ctrl/Cmd+J | Resolved. Desktop keeps it. Dock has no default chord. |
| K5 | Ctrl/Cmd+K | Resolved. Existing palette, Ops page. |
| K6 | Ctrl/Cmd+, | Resolved. Ops settings only while Ops focused and not editable; else `nav.settings`. |
| K7 | G-chords | Resolved. Root-local leader. `mod+g` stays review. Lone G is not approve. |
| K8 | Esc | Resolved. Innermost layer, §4. Full-screen is last. |
| K9 | single-key approve | Resolved. Prohibited. Approval Enter is not an Ops key. |

Unresolved count: 0.

Signed from source at `865ba906c1a`. Not signed from a keypress in the running production Desktop (`apps/desktop/release/win-unpacked/Hermes.exe` was up). Injecting Ctrl+W there is a close-tab (`windowAcceleratorAction`). A judge who re-tests must use an isolated window or profile and must not drive the production Hermes.exe.

## 7. Evidence for P0-02

O64: interactive terminal exists (`electron/terminal-ipc.ts` `nodePty.spawn`). Ops dock reuses `LogTail` and does not spawn a PTY. Detail: `desktop-surface-audit.md` §2.

R23: the focus-ownership table in §3 is the keymap. Active only inside focused Ops, outside editables. `/` does not collide with composer slash. No single-key approve. `P` is undefined.

## 8. Verify a later worker can re-run

Static, no production mutation:

- `view.closeTab` defaults include `mod+w`: `src/lib/keybinds/actions.ts:207`
- `session.next` defaults include `ctrl+tab`: `actions.ts:126`
- `composer.focus` defaults include `/`: `actions.ts:84`
- `view.toggleRightSidebar` defaults include `mod+j`: `actions.ts:162`
- `nav.commandPalette` defaults include `mod+k`: `actions.ts:147`
- `nav.settings` defaults include `mod+,`: `actions.ts:149`
- `view.toggleReview` defaults include `mod+g`: `actions.ts:180`
- no `g o` / chord-leader token in `actions.ts`
- `handleApprovalKey` rejects every key except Enter and Escape: `approval-keys.ts:35`
- `nodePty.spawn` exists: `electron/terminal-ipc.ts:326`
- `LogTail` export: `src/components/chat/log-tail.tsx:39`

Do not send those chords to the installed Desktop.
