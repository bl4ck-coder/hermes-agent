# Ops panel wireframes (P0-08)

Status: documentation only. Freeze of SPEC section 12.5. Not a redesign.
Branch base: `feat/ops-panel` at `2ab328a9c66` (P0-04 merged). This card does not edit theme tokens, keymap, or code.
SPEC: vault `01-Projects/Hermes/desktop-ops-panel/SPEC.md` v4, section 12.5 (lines 314-428) and the rows named below.
Split-host: `desktop-surface-audit.md` in this same directory, section 3 (BR-R53), already on `feat/ops-panel`.
Model policy P2 is a constraint on labels in the freeze (P2 models only). This file does not write `ops-policy.yaml`.

Rows this freeze is answerable for: O23, O44, O47, G17, G37, G47, G48, G49, G54, R32, R53.
Decisions kept, not re-litigated: D5 (Gold Night, app-wide), D6 (sandhi at the orrery centre), D14 (split pane beside chat, full-screen toggle).

## 1. Freeze rule

The fenced ASCII and the one-line prose for W6-W12 are copied from SPEC section 12.5. They are not redrawn to match a screenshot. Annotations sit under each block. An annotation may not delete a region, rename a control, or swap a colour inside the fence.

Screenshot palettes are not the theme. Orbit/Aurora is a dark mock. Outglow is a light mock, plus one dark skin. D5 stays Gold Night. Geometry may be compared. Hexes may not be copied from the shots. Token values are not this card.

Where the frozen ASCII and a later SPEC row disagree, the row wins and the ASCII stays as printed. The one case is W4's caption `colour = kind`. G49 is the colour law. The caption is not edited.

## 2. Narrow pane (R53, R32, O44, G17)

Applies to W1, W1b, and W2-W12. Source: SPEC R53, verbatim, and P0-04 `desktop-surface-audit.md` lines 100-114. Not adapted.

Measured width is the Ops pane container, not the window. A wide window with Ops in a half split still hits these thresholds (D14 keeps chat beside Ops).

| Ops pane container | Behaviour |
|---|---|
| 1280 px and above | Inspector docked in the right column. |
| under 1280 px | Inspector overlays the view. It does not push the view into a second column. |
| under 1024 px | Rail shows icons. |
| under 800 px | Tabs become one dropdown. |

One gutter: 24 px (`--gutter`, SPEC section 12.3, R32). The overlay, the dropdown, the dock, and the split handle are not a second gutter. W1 already draws `gutter 24px` in the view. That is the only gutter.

P0-04 note, kept: Desktop `ResponsiveTabs` uses Tailwind `md:` at 768 px viewport. That is not this rule. Do not call `md` a container breakpoint. `SIDEBAR_DOCK_MIN_WIDTH_PX = 640` is a Desktop dock floor. It does not replace 1280/1024/800.

O44 is three preference states: full, icons, hidden. G17 persists the rail collapse. The under-1024 px rule forces icons. It does not delete the hidden state, and it is not the Desktop overlay under 640 px. Orbit's screenshot of a fully hidden nav is the hidden state, not the icon state. Entry 01 (Outglow) shows the icon-rail appearance. It does not show persistence or the R53 trigger. Do not use the hidden shot as a stand-in for icons. See `reference-index.md` Note B3.

No screenshot in the 19 measures 1280, 1024, 800, or 24 px. Those numbers stay the SPEC/P0-04 text. They are not estimated from a picture.

## 3. W1 Shell, full-screen mode

SPEC: "W1 Shell, full-screen mode (⤢; inside Desktop chrome; ← Chats returns to split mode)". D14. Full-screen hides non-Ops panes as hot-hidden. It does not unmount chat. ← Chats, a second ⤢, or Esc when full-screen is the innermost layer restores the split. Chat session, draft, and stream stay. Do not call `session.new`.

```
┌ Desktop titlebar: ◆ Ops ▸ ignacio-local ▸ mirror ▸ Office        [ ⌕ Search Ops  Ctrl K ]   [model: grok-4.7 ▾] [⟦][⟧] ┐
├────────────────┬───────────────────────────────────────────────────────────────────────────┬─────────────────────────┤
│ ← Chats        │ [◆Office][◇Canvas][▦Board] │ [▤ TASK-412 •][✦ judge •][⏱ run 1866]  ⌄    │ Fleet │ Context          │
│ ▾ ignacio ▸ all│────────────────────────────────────────────────────────────────────────── │ NEEDS YOU 1             │
│ ⌕ filter       │                                                                           │ ◉ judge  approval 2m    │
│ OPS            │                     (view content, gutter 24px)                           │ WORKING 3               │
│  ◆ Office   3  │                                                                           │ ● atlas  T-412 3/6      │
│  ◇ Canvas   •  │                                                                           │ ● builder …             │
│  ▦ Board   18  │                                                                           │ BLOCKED 1  ▲ …          │
│ PINNED         │                                                                           │ IDLE 28 ▸               │
│  T-398         │                                                                           │ OFFLINE/UNKNOWN 0       │
│ LENSES         │                                                                           │                         │
│  Runs Review   │                                                                           │                         │
│  Templates     │                                                                           │                         │
│  Skills Chan.  │                                                                           │                         │
│  Activity      │                                                                           │                         │
│ FLEET · 8 online│                                                                          │─────────────────────────│
│  ◉ judge  NeedsY│───────────────────────── dock (Ctrl+J): log tail · Problems 2 ───────── │ Run 1866 · 0:27 · 14.2k │
│  ● atlas  Work. │                                                                          │                         │
│  28 idle ▸     │                                                                           │                         │
│ +  ⚙ Ops Ctrl,  │                                                                           │                         │
├────────────────┴───────────────────────────────────────────────────────────────────────────┴─────────────────────────┤
│ Desktop status bar … │ Ops: ● mirror · run #1866 · ●●● 3 working · ◉ 1 needs you · 182k tok today │ gw 0.21.5 ● · Motion · ▤ │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Narrow pane on this shell:

- 1280 and above: inspector docked, as drawn.
- under 1280: inspector overlays. The 24 px gutter stays in the view. The overlay adds none.
- under 1024: the left rail becomes icons (O44 middle state, G17 persisted). ← Chats stays reachable. This drawing is the full rail, so it is the 1024-and-above drawing.
- under 800: the tab strip (pinned Office/Canvas/Board plus doc tabs, O31) becomes one dropdown. Dots move with the tabs into that dropdown. Do not keep a full strip and a dropdown.

O23: the inspector footer `Run 1866 · 0:27 · 14.2k` is the focused run. The drawing includes tab `run 1866`, so a run is focused. With nothing focused, that footer cell is absent. It is not `0` and not the last run. Orbit shots always show `Run #218` because the mock always has a run. That is not a license to show the footer with no focus.

O47: dots on `TASK-412` and `judge` are scoped to connection plus profile. Gold dot = unsaved Canvas draft. Champagne dot = new events since that tab was last focused. Orbit's orange dot on `page.tsx` and blue dots on Chat and `research.md` are the reference, not the freeze colours.

O44 / G17: this drawing is the full rail. Icons and hidden remain the other two states.

R32: one 24 px gutter, already labelled in the view.

Unavailable: `OFFLINE/UNKNOWN 0` in the drawing is a known zero. If the count is unknown, the label is `unknown`, not `0`. Tokens today in the status bar are null when A2 has no provenance, not `0`.

Compare: index entries 15 (home, full rail, dots, focused footer), 17 (hidden rail, not this drawing), 13-16 and 18-19 (same shell chrome).

## 4. W1b Shell, split mode

SPEC: "W1b Shell, split mode (default, D14)".

```
┌ Desktop titlebar ─────────────────────────────────────────────────────────────────────────────────────────────┐
├ chat sidebar ┬ chat pane ─────────────────────────┬‖┬ Ops pane ─────────────────────────────────────────── [⤢] ┤
│ sessions…    │ conversation…                      │‖│ [◆Office][◇Canvas][▦Board] │ tabs…                       │
│              │                                    │‖│ compact rail (icons) │ view content │ inspector (folds)  │
│              │ composer                           │‖│                                                          │
├──────────────┴────────────────────────────────────┴‖┴──────────────────────────────────────────────────────────┤
│ Desktop status bar … │ Ops group …                         ‖ = drag to resize (width persisted)          │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

This ASCII is the narrow split sketch already in SPEC. It is not "every split is icons".

Narrow pane on this shell:

- The `‖` handle persists width per connection plus profile (`hermes.desktop.opsSplit.v1` in the P0-04 audit). It is not a gutter. The view gutter stays 24 px.
- Pane at 1280 and above: inspector docked, rail full (same regions as W1, beside chat). The "folds" label in the ASCII is the under-1280 overlay.
- Pane under 1024: rail icons, as the ASCII draws `compact rail (icons)`.
- Pane under 800: the Ops tab row becomes one dropdown. Chat tabs are not that dropdown.
- ⤢ goes to W1 and back. Chat stays usable. No second titlebar, palette, status bar, or model chip. In split mode the composer model pill is the only chip (P0-04 O50). The W1 titlebar chip appears only when chat is hot-hidden.

No screenshot shows the split. D14 is frozen from SPEC and the P0-04 audit, not from a picture. Do not crop an Orbit full-window shot and call it W1b.

## 5. W2 Office

SPEC: "W2 Office (Orbit Home + Gr8r Home + SPEC section 3)".

```
┌ Office ─────────────────────────────────────────────────────────── legend: ● working ◉ needs-you ▲ blocked · idle ○ offline ◌ stale ┐
│ HEALTH  gateway 0.21.5 ● · telegram ● · whatsapp ○ · cron ticker 12s ago ●      CRON  next: x-digest 19:00 · last fail: — (2)    │
│                 · seeker        ● atlas (T-412 3/6)        · pixel                     ← middle ring: idle, active <24h             │
│      ◉ judge            ╭──────────────────╮           ● builder                       ← inner ring: working/needs-you/blocked     │
│                         │   ✦ sandhi        │   halo ∝ live runs                                                                    │
│      ▲ T-398 owner      ╰──────────────────╯           +24 idle/offline ▸ (Fleet table) ← outer arc                                 │
│ ┌ Dispatch ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ Describe a task…   @assignee ▾ (or "Unassigned → triage" if triage exists)                                    ↵ to dispatch  ➤ │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│ [blueprint: Daily digest] [template: PR review] [recent: Rebase desktop]                                                            │
│ NEEDS YOU · 3                                                                                                    View all (W8) →   │
│ AGENT    KIND        WAITING ON                                 AGE   WHY ▸                                      ACTIONS            │
│ ◉ judge  approval    run_shell `git push origin main`           2m    gateway approval.pending · resumes session  [Approve][Deny]   │
│ ▲ T-398  blocked     needs_input: "which tenant?"               2h    block_kind · unblocks worker                [Unblock…][Open]  │
│ ⚠ cron   failed ×2   x-digest: last_error 401                    6h    failure_streak · next run 19:00             [Run now][Open]   │
│ TODAY   3 cron runs next 24h · 7 ready · 7 review · 0 overdue heartbeats                                                           │
│ IN FLIGHT   TASK      TITLE                 OWNER     STATUS     STEPS   UPDATED    TIME                            View all →       │
│             T-412     Rebase desktop        ● builder running    3/6     12s ago    0:27                                             │
│ ACTIVITY    18:31  ● builder  ran `pnpm test` (exit 0)                         task_events · T-412                 View all →       │
│ ─ why · what for: fleet = /api/ops/fleet (A1), observed 18:31:04; Needs-you = A3 + kanban + cron ─                                  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

SPEC addendum, kept verbatim: an `[Orrery | Table]` switch, and an inner-ring cap of 8 orbs (overflow to a "+n" arc). At 36 profiles the Table mode is the default whenever more than 8 profiles are non-idle.

D6: the centre is `sandhi`. Entry 15 shows Atlas at the centre, with Scout, Sage, Pixel, Quill, and Forge around it. That centre is not copied. The halo is live runs, not a decorative face.

8-orb cap: the inner ring holds at most 8 orbs (working, needs-you, blocked). Overflow is a "+n" arc, not a ninth orb. Entry 15 has five orbiting orbs. The cap is not visible there. It is still the freeze. Table mode is the default when more than 8 profiles are non-idle.

Narrow pane: Health and Cron wrap inside the 24 px gutter. They do not become a page error when the pane is under 800. The orrery may shrink. It does not move sandhi off centre. Under 1280 the inspector overlays and does not cover the Dispatch composer. Under 800 the Office tab is inside the shell dropdown (W1), not a second Office chrome.

Needs-you actions stay one click only when the full command and args fit unabridged (D3). Otherwise the button is `[Review]`, which focuses the card. The drawing shows `[Approve][Deny]` for a short `run_shell` line. A truncated toast is not an approve.

Unavailable, per section, not as a blank:

- Health / Cron / Orrery / Dispatch / Needs-you / Today / In flight / Activity each fail alone (W10).
- Fleet count unknown is `unknown`, not `0`. `last fail: —` is "none recorded", not a fake success.
- `whatFor` missing from the source is `reason not recorded`. It is not invented.
- Tokens in In flight are omitted when A2 is null. The drawing's `0:27` is elapsed, not a token zero.

Compare: entry 15. Do not retitle the hero to Atlas.

## 6. W3 Agent card

SPEC drawer, kept:

```
┌ ✦ judge · reviewer ──────────────── ◉ needs-you · 2m ┐
│ openai-codex · gpt-6.1-sol        [Policy ✓ P2]      │
│ Sub-state: waiting on approval (run_shell)           │
│ Next run: cron "judge-sweep" 19:30                    │
│ Tools 7 (terminal, file, web +4) · Skills 12 · MCP 2  │
│ Channels: telegram set · whatsapp unset               │
│ Permissions: command_allowlist (6)                    │
│ This week: 41 runs · 3 failed · 1.2M tok              │
│ Recent: 18:29 approval requested · 18:27 run started  │
│ [Message] [Assign task] [Open run] [Open in Canvas]   │
│ why: /api/profiles/judge · A1 observed 18:31          │
└──────────────────────────────────────────────────────┘
```

No shot in the 19 is this drawer. Entry 13 is the agents table, not the card. Do not treat that table as W3.

Narrow pane: the drawer is an overlay at every width. Under 800 it uses the pane width minus the 24 px gutter, not a new page. It does not steal focus from chat in split mode.

Unavailable: week tokens are omitted when unknown, not `0`. Channels show `set` / `unset` only. Secret values never appear. Policy chip is P2. Screenshot model names (Opus 5.5, Sonnet 5.5, Haiku 4.5, Fable 5) are not added here.

Presence on the card is shape plus colour plus the text label (`needs-you`), matching the W2 legend.

## 7. W4 Canvas

SPEC: "W4 Canvas (Outglow builder)".

```
┌ Canvas ▸ judge  [Policy ✓] [remote: read-only]   ⚠ model change applies next session      [Save all (2)] [Discard] [History] [Export] ┐
│┌ Run panel ─────────────── ⟨ ┐   ┌▾ Schedule ───┐ ○──┐      ┌▾ Identity ───────────────┐      ┌▾ Tools (toolsets+MCP) ──┐ │
││ Test run: "Review T-401" [■] │   │ cron 30 19 * *│    │      │ judge · reviewer          │──○  │ terminal · file · web    │ │
││ ▍streaming…                   │   │ ART · next 19:30   ├──●──▶│▾ Prompt (SOUL) v12 •      │      │ +4 more ▸                │ │
││ ▸ Tool calls (6)              │   └──────────────┘    │      │ "You judge…" [Edit]       │      └──────────────────────────┘ │
││ ▸ Sub-agents (2) live         │   ┌▾ Trigger ────┐ ○──┤      │▾ Model ────────────────── │      ┌▾ Skills (12) ───────────┐ │
││ ▸ Skills loaded (3)           │   │ webhook /judge│    │      │ gpt-6.1-sol ▾  (P2 only) │──○  │ rice-scoring …           │ │
││ Thinking 1:06 · 2.7k tok      │   ┌▾ Channels ───┐ ●──┤      └──────────────────────────┘      └──────────────────────────┘ │
││ [Steer: follow-up…]        ➤  │   │ telegram ✓   │    │                                        ┌▾ Delegation (read-only) ┐ │
│└───────────────────────────────┘   ┌▾ Memory ─────┐ ●──┘                                        │ planner, builder         │ │
│   ports: ● set  ○ unset (dashed edge)   colour = kind                 [ −  100%  +  ⤢ fit ]     └──────────────────────────┘ │
│ ─ why per node: source endpoint · what writing it changes ─                                                                 │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

SPEC addendum, kept: the usage banner (G5) sits inside the run panel when quota is known. "Delegation (configured)" (A4) and "Sub-agents (live)" (run events) are labelled separately.

G48, kept: fixed three columns. Left = inputs (Schedule, Trigger, Channels, Memory). Centre = Identity, Prompt, Model. Right = Tools, Skills, Delegation. No free-form layout in v1. Entries 01 and 08 show that topology: Schedule / Triggers / Channels / Memory, then Agent / Instructions, then Tools / Sub-agents / Skills. Instructions in the shot is Prompt in the freeze. Sub-agents in the shot stay read-only Delegation plus a separately labelled live list. Do not add a fourth column.

G47: gold dot grid at 6 percent. The shots show a light dotted grid. The pattern is kept. The light grey field is not.

G37: node headers collapse (`▾` in the freeze, chevrons in the shots). Collapse is per node.

G49, the colour law, over the frozen caption `colour = kind`:

- gold = changed since backup
- amber = unset
- garnet = policy or validation
- champagne = ok
- unset edges are dashed

The shots colour ports blue ("new") and orange ("needs setup"), and Channels shows an orange `Set identity`. Those hues are not copied. Amber is the unset state. Edges are not coloured by kind (G38 already says the shots colour ports by state).

G54: each node has its own skeleton (gold shimmer) tied to that node's query, and its own failure. Entries 01, 05, 08, and 09 do not show a node spinner (verified on the originals). The absence is not a cut. Entry 07 is the reference: a slow Tools query does not shimmer Identity. The Tools node there shows a per-node loading spinner and shimmer; neighbours render normally. The shot hue is not copied. The freeze is gold shimmer.

Narrow pane:

- under 1280: inspector (node detail or History) overlays. The three columns stay three columns inside the view. They do not stack into a new design.
- under 1024: shell rail icons. Canvas columns do not become the rail.
- under 800: shell tabs dropdown. Zoom controls stay bottom-centre, as in the shots (`100%`). They are not a second gutter.
- Run panel hide, as entry 08, removes the panel only. Columns do not reflow into a new topology.

Remote connections: the `read-only` chip stays. No write affordance on a remote (D11).

Unavailable, per node: empty copy, not a fake cron, not a fake tool list. Channels: `set` / `unset`, never a secret value. Delegation configured is empty until A4, labelled read-only, not a made-up roster. Quota banner only when quota is known. Token counter in the run panel is null, not `0`, when unknown. Test run has no confirm and no token cap (D7). That is not drawn as a dialog.

Edit on Prompt is a control (entry 05 shows `Edit` on Instructions). The shot did not open an editor. The freeze does not invent the editor chrome.

Compare: entries 01, 03, 05, 07, 08, 09.

## 8. W5 Board

SPEC, kept. No Gr8r screenshot exists. Do not redraw this from Orbit's task list (entries 17 and 19), which is a table, not columns.

```
┌ Board  [Board|List|Table|Calendar|Timeline]  ⌕ search   chips: tenant:all ✕ profile:judge ✕  [Mine]   [+ New task] ┐
│ TODO 1 [+]   READY 7 [+]   RUNNING 2     BLOCKED 4     REVIEW 7      DONE 354 ▸   ARCHIVED 29 ▸                       │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                                                                   │
│ │T-401  ◆ P2   │ │T-399         │ │T-412  ●      │   card: id · title · sigil · priority · step · heartbeat · ✕n · n/m │
│ │Fix cron tz   │ │…             │ │3/6 · 12s · 0 │                                                                   │
│ │✦builder 0/2  │ │✦judge        │ │✦builder      │                                                                   │
│ └──────────────┘ └──────────────┘ └──────────────┘                                                                   │
│ [bulk bar when ≥1 selected: Move ▾  Reassign ▾  Archive]       hint: Space grab · ←/→ move · Enter drop              │
└──── drawer ▸ [Full page][Copy link][✕]  Status·Priority·Assignee·Project·Skills·Estimate │ Body Comments Events Runs Attachments Links ┘
```

Narrow pane: under 1280 the drawer overlays instead of sitting in a side inspector. Under 800 the Board doc tab is inside the shell tab dropdown (W1); the in-view view switch stays one in-view control row inside the 24 px gutter (same rule as W8:293); no other narrow behaviour for it is frozen here. Columns scroll inside the 24 px gutter. They do not wrap into a new board. A blocked card is a card state, not a page error (entry 19 shows `Blocked` on one row while other rows stay completed).

`0` on a heartbeat age is only a real zero. Unknown age is `unknown`.

## 9. W6 Task tab

SPEC prose, frozen: header (id, title, status, owner, [Steer][Stop][Unblock]) then Plan steps (workflow steps or children) then Timeline (tool calls, handoffs, approvals, errors; Expand/Collapse all).

Entry 18 is the reference timeline (Approve / Discuss, `pnpm install`, edit, `pnpm test`, deploy failed on `DEPLOY_TOKEN`, local Resolve). The freeze does not copy Pause, and it does not add a deploy-token grant dialog (O75 is a Cut). The error stays on that timeline step. The rest of the tab stays usable (W10).

Narrow pane: under 1280 the inspector overlays the timeline. Under 800 the tab is in the shell dropdown. Expand/Collapse all stays on the timeline. The dock (log tail) is the shell dock, not a second error page.

O47: dots on sibling tabs are scoped. Entry 18 shows an orange dot on `page.tsx` and a blue dot on `research.md`. Freeze colours are gold and champagne, as in W1.

O23: entry 18's inspector still shows Run / Elapsed / Tokens because a run is focused. Hide that footer when this tab's run is not the focused run.

## 10. W7 Run tab and Runs lens

SPEC prose, frozen: table `#id · task · profile · status · started · duration · tokens (A2, null-safe) · outcome`. The tab shows the live SSE event stream, stats from `/runs/{id}/inspect`, and the log tail.

No shot is this table. Orbit's status-bar `Run #218` and inspector `Run / Elapsed / Tokens` are the focused-run footer (O23), not the Runs lens. Do not promote that footer into W7.

Narrow pane: the table uses the one 24 px gutter. Under 800 it is inside the shell dropdown, and the table scrolls. It does not become a card stack redesign. Tokens cell is empty with provenance `unknown` when A2 is null. It is not `0`.

## 11. W8 Needs-you full list

SPEC prose, frozen: tabs Open | Resolved (history), filters by kind and profile.

Entry 15 shows a one-row Needs you table (Quill, waiting for approval, Approve) plus a toast. That is the Office excerpt, not this full list. The freeze does not drop Resolved, and it does not turn the toast into the list.

Narrow pane: Open | Resolved becomes part of the under-800 dropdown only if it is a doc tab. As an in-view switch it stays one control row inside the gutter, and it does not spawn a second gutter. A failed filter is a section error (W10), not a blank Office.

Approve only when the full command and args are visible. Otherwise `[Review]`.

## 12. W9 Settings tab

SPEC prose, frozen: Theme (app-wide; opens Desktop settings, D5), motion, default tab, date format, default model (P2), approval mode per profile, secret presence, shortcut sheet.

Entry 16 shows Reduce motion, Default model `Opus 5.5`, Agent autonomy `Ask first / Safe actions / Full`, Secrets `DEPLOY_TOKEN, ANALYTICS_KEY` and Manage. It does not show a theme control. The freeze does not add a theme picker inside Ops. Theme opens Desktop settings (D5). The default model list is P2 only. `Opus 5.5` is not copied. Secrets are names and set/unset, which the shot already does. Values stay off the screen.

Entry 04 is a dark skin of Skills, not W9. It is not the Gold Night default.

Narrow pane: the settings stack stays one column inside the 24 px gutter at every breakpoint. Under 1280 the inspector overlays and does not become a second settings form.

## 13. W10 States

SPEC prose, frozen: every Office section and every Canvas node fails and recovers independently (never a whole-page error). For each one: empty, loading (gold shimmer), reconnecting, stale-degraded, exhausted-recovery. Each has its own copy and a way out.

Office sections, each independent: Health, Cron, Orrery, Dispatch, Needs-you, Today, In flight, Activity.

Canvas nodes, each independent: Schedule, Trigger, Channels, Memory, Identity, Prompt, Model, Tools, Skills, Delegation. G54 is the loading row of this list for Canvas. A node spinner does not cover its neighbours.

Way out, per state, not a new screen:

- empty: the section's own primary action, or the why-line `not recorded` if there is nothing to do
- loading: gold shimmer on that section or node only; no whole-page spinner
- reconnecting: retry on that section; other sections keep their last good data and a stale mark if they too are stale
- stale-degraded: show the last observed time; do not relabel as idle
- exhausted-recovery: one retry control on that section; the rest of the view stays

Entry 19: `TASK-142` is Blocked and the dock shows `DEPLOY_TOKEN is not set`, while other tasks stay Completed. That is the pattern (local failure). The freeze does not add Orbit's "Grant access and retry" dialog.

Narrow pane: a state block uses the same gutter. It does not expand to a full-page error at under 800.

## 14. W11 Inspector Context tab

SPEC prose, frozen: task, repo/worktree, attachments, secrets present (names only), memory provider, linked session.

Orbit's inspector has Agents | Context (entries 13-19). Context content is not opened in the 19. The freeze keeps the field list above. It does not invent attachment thumbnails or secret values. Fleet | Context is the Office inspector pair (SPEC section 12.2). This tab is Context.

O23 footer sits under the inspector only when a run is focused. Context fields and the footer are different. Hiding the footer does not hide Context.

Narrow pane: under 1280 this tab is the overlay, not a docked column. Same 24 px gutter inside the overlay. No second gutter.

## 15. W12 Lenses

SPEC prose, frozen: Skills (packs row plus sortable table: name, desc, type, profiles chips +N, author, updated), Channels and MCP (category rail, All/Connected, search, cards with Connect / check / Manage, "+" popover), Projects, Templates/Workflows, Files. All use the Gr8r DataTable with Outglow filters.

Entries 11 and 10 are the Skills packs and table, including a Show tooltip on a truncated description (`Reviewing a screen or flow - returns issues ranked by severity.`). Entry 06 is the catalog: category rail, All / Connected, Connect and Connected. The animated activity chips in that shot are G9, a Cut. They are not added to this lens. Entry 03 is the "+" popover (`Search apps`, Models, Design), over the canvas, not a new page. Entry 12 is the workspace menu on Skills. Agents/Workbench (G19) and Support / Log out (G77) are Cuts. They are not added to W12.

Templates/Workflows has no Desktop route (P0-04 named gap). The lens name stays in the rail. This freeze does not invent the page. Projects and Files embed the existing Desktop views. They are not redrawn.

Narrow pane: R53's rail rule is the Ops rail only (P0-04 desktop-surface-audit.md:109,114, O44; SPEC.md:673). The Channels/MCP category rail is in-view content, stays inside the one gutter, and its narrow behaviour is not frozen here. No category icons are invented. Open question for Planner: whether that in-view rail has any narrow behaviour. The table keeps one 24 px gutter. Under 800 the lens tab is in the shell dropdown. Filters do not become a second toolbar gutter.

## 16. Invariants the freeze keeps

| Item | Where it is frozen | What the 19 show, and what is not copied |
|---|---|---|
| D5 Gold Night | Assumed, not a second skin | Entries 04 and 16 are dark/light mocks. Not the default theme. |
| D6 sandhi centre | W2 fence | Entry 15 centre is Atlas. Not copied. |
| D14 split | W1b default, W1 is the toggle | No split screenshot. Not invented. |
| 8-orb cap | W2 addendum | Entry 15 has five orbiting orbs. Cap still holds. |
| G48 three columns | W4 fence | Entries 01 and 08 match the topology. |
| G49 port colours | Annotation on W4 | Shots use blue and orange. Not copied. |
| O47 scoped dots | W1, W6 | Shots use orange and blue. Not copied. Scope is connection plus profile. |
| O23 focused footer | W1, W6, W7, W11 | Shots always show Run #218. Footer hides when nothing is focused. |
| W10 per section and per node | Section 13 | Entry 19 is local blocked, not a page error. |
| Unavailable data | Sections 3-15 | Null tokens, `unknown` counts, `reason not recorded`, secret names only. |
| R32 one 24 px gutter | Section 2 | Not measured in any shot. |
| R53 1280/1024/800 | Section 2 | Not measured in any shot. Container, not viewport. |
