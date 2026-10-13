# Presence, motion, and toasts (P0-05)

Status: r1. Presence, motion, and the toast queue are frozen. Wireframes W1–W12 and the 19-screenshot index are P0-08. This file does not sign visual fidelity.
Base: `2ab328a9c66`. Companion: `gold-night-tokens.md`. Colours cited here are measured there. Do not introduce another hex.
Rows: O8, O46, O54, O56, O57, O77, O79, O90, R30, R31. Also SPEC §2 presence enum, §3.1–§3.3, §12.3, §12.4 (T1–T15).

§6's 180–240 ms ease-out is superseded (R31, SPEC §12.3). This file is the resolved motion spec. It does not edit `SPEC.md`.

## 1. Presence is shape + colour + label

A state is not shown by colour alone. Rail, inspector, and tables always render the label (O54, SPEC §12.3). With 36 profiles, non-idle rows come first. Idle rows fold into one "N idle" row. Unknown and stale do not fold into idle.

Data values match SPEC §2: `working | needs_you | blocked | idle | offline | unknown | stale`. Display labels use the words below. `needs_you` displays as `needs-you`.

| State | Shape | Glyph colour | Copy colour | Label | Pulse |
|---|---|---|---|---|---|
| working | filled disc ● | `#E8C77A` | `#E8C77A` | `working` | yes, §4 |
| needs-you | ringed disc ◉ | `#D4893A` | `#D4893A` | `needs-you` | no |
| blocked | triangle ▲ | `#B4533C` | `#BF6D59` | `blocked` | no |
| idle | middle dot · | `#CDBB98` | `#CDBB98` | `idle` | no |
| offline | hollow disc ○ | `#6E675C` | `#8A8376` | `offline` | no |
| unknown | dotted circle ◌ | `#9A8F7A` | `#9A8F7A` | `unknown` | no |
| stale | barred circle ◍ | `#C9A55A` | `#C9A55A` | `stale` | no |

Glyphs that fail 4.5:1 (`#B4533C`, `#6E675C`) are shapes only. The word next to them uses the copy colour. Both pairs are in `gold-night-tokens.md` §6.

Unknown and stale are separate states. SPEC §12.3 drew them as one hatched mark. The enum already splits them, and this card requires the split. Shared hatch family, different shape, different colour, different label.

Outcomes, not presence states:

| Outcome | Mark | Copy colour | Label |
|---|---|---|---|
| done | check | `#CDBB98` | `done` |
| failed | cross, glyph `#B4533C` | `#BF6D59` | `failed` |
| running | existing `GlyphSpinner` | `#E8C77A` | `running` |
| queued | hollow disc, glyph `#6E675C` | `#9A8F7A` | `queued` |
| connected | small square, sage only | `#6F8F72` | `connected` |

No other green. Plugin `#3ECF8E` is not this sage.

### 1.1 Working sub-states (O77)

Sub-states of `working` only. They are not extra top-level states.

| Sub-state | When | Label | Look |
|---|---|---|---|
| thinking | a thinking event on the run or session stream | `thinking` | working disc, pulse on |
| tool | a tool event | `tool:<name>` | working disc, pulse on |
| done | a completion event, for 10 s | `done` | static disc, no pulse, copy `#CDBB98`, then idle |

`tool:<name>` is lowercase `tool`, a colon, and the event's tool name. If the event has no name, the label is `tool`, not an invented name.

`done` is not counted in the fresh working counter. The work event has ended. After 10 s it becomes `idle` by a 220 ms colour crossfade (T9). The 10 s is the fade rule on a real completion event, not a new event source.

SPEC §2 also lists `waiting_approval` as a sub-state. That value maps to top-level `needs-you`, not to a fourth working sub-state. An approval event is needs-you. It is not `working` / `thinking`.

Orbit's "researching" and "waiting" words are not labels. O77 adapted them into the three sub-states above.

### 1.2 Event-backed only

No activity state without an event behind it (O77). Sources are the ones SPEC §3.1 already names. This card does not add endpoints.

| State | Event required | Must not be inferred from |
|---|---|---|
| working / thinking | `workers/active` running, or a session/run stream event | a quiet profile |
| tool:<name> | a tool event that carries the name | the last tool the profile ever used |
| done | a completion event, then the 10 s fade | a missing heartbeat |
| needs-you | `approval.pending`, kanban `blocked` or `review`, cron `failure_streak>0`, or a policy violation | a stale "needs you" flag with no current event |
| blocked | assigned task `status=blocked` | needs-you |
| idle | gateway-up event and a no-work observation on that profile | unknown |
| offline | backend unreachable for that profile | a missing row |
| stale | a prior event exists and its age is over the fresh window | unknown |
| unknown | no event and no prior observation for that field | idle, offline, or working |

Unknown is the absence marker. It is the only display that has no event, and the label must say so. Painting idle, offline, or working when the event is missing is forbidden.

O46: the pulse runs only while a current working event says thinking or tool. Streaming text runs only from SSE (`/v1/runs/{id}/events`). No decorative blink. No idle blink (O57).

### 1.3 Fresh-only counters

Fresh window is 5 s (SPEC §3.3: presence agrees with `workers/active` within 5 s). A row is fresh when its backing event's `observed_at` age is ≤ 5 s.

These counts include fresh rows only:

- Rail section counts and the folded "N idle" count
- Status-bar "N working" and "N needs you"
- Inspector group counts
- Orrery inner-ring membership

Stale, unknown, and `done`-fading rows are excluded from those counts. They stay visible in their own groups. Offline is its own count, not added to idle. A counter with no fresh rows renders `0`, not a blank and not a stale total.

Profile-list timeout past 60 s keeps the last snapshot and labels it stale (SPEC §3.2). That snapshot does not feed fresh counters.

### 1.4 Sigils (O56)

Deterministic. No random colour, no network avatar.

Hash is the one already in tree: `hashString` in `src/lib/profile-color.ts:9-17` (`hash * 31 + charCode`, unsigned). `profileColor` returns null for empty and `default` (`profile-color.ts:24-26`). There is no `themes/profile-theme` module. O56's verify note resolves to `profile-color.ts` plus `resolveProfileColor` (`profile-color.ts:35-43`). A stored override wins over the hash for the rim only.

| Part | Rule |
|---|---|
| Disc fill | `#C9A55A` for every named profile. Not the rainbow `hsl()` from `profileColor`. Ivory on this disc is 1.917:1 and is forbidden. |
| Monogram ink | `#0E0D0B` on that disc (8.337:1). |
| Monogram | Uppercase first two graphemes of the trimmed name. One grapheme if the name has one. |
| Empty / `default` | No gold disc. Neutral raised `#1F1B14` with a middle dot in ivory. |
| Profile colour, if `resolveProfileColor` is non-null | 2 px rim in that colour. It does not replace the disc fill. |
| Profile colour, if null | No rim. |

The hash picks the monogram identity, not a per-profile disc hex. A hashed disc would be an unmeasured text pair. Reuse the same sigil in the rail, tables, timeline, toasts, and avatar stacks (O56).

## 2. Motion tokens (R31)

One set. It replaces SPEC §6.

| Token | Value |
|---|---|
| `--dur-micro` | 140 ms |
| `--dur-panel` | 220 ms |
| `--dur-view` | 320 ms |
| `--ease` | `cubic-bezier(.23, 1, .32, 1)` |
| `--ease-drawer` | `cubic-bezier(.32, .72, 0, 1)` |

No 160 ms, no 180–240 ms, no spring on drag. T10's 600 ms glow decay is not a fourth duration token. It is the T10 timing only.

### 2.1 Eight keyframes

| Name | From → to | Duration | Ease | Reduced motion |
|---|---|---|---|---|
| rise | translateY(8px), opacity 0 → rest, opacity 1 | 220 ms | `--ease` | opacity 1, no translate |
| land | translateY(-6px) → rest | 220 ms | `--ease` | off, instant rest |
| done | check opacity 0 → 1 | 220 ms | `--ease` | static check |
| strike | title line-through scaleX 0 → 1 | 220 ms | `--ease` | line-through already on, no travel |
| pop | scale 1 → 1.08 → 1 | 140 ms | `--ease` | off |
| slide | translate on the drawer, rail, or dock axis | 220 ms | `--ease-drawer` | instant |
| grow | height of the expander or subtask | 220 ms | `--ease` | instant |
| add | new row or tab, opacity 0 → 1 plus rise | 140 ms | `--ease` | instant appear |

Reduced motion is `prefers-reduced-motion: reduce`, and also the status-bar Motion readout when it is Reduced (not System, not Full). System follows the OS media query.

Also, from SPEC §12.3, under reduced motion:

- Presence pulse becomes a static ring. The working disc stays filled and still.
- FLIP becomes an instant swap.
- Orrery drift stops.
- land and pop are off.
- Text still streams. The caret does not blink.

O79 row anatomy stays title, description, right-aligned control. The motion row's description is exactly: `States still change and stay readable`. That sentence is the promise the substitutions above have to keep. States still change. Copy still uses the §1 colours, which already clear 4.5:1.

### 2.2 T1–T15

| # | Motion | Duration | Ease | Reduced motion | Rule |
|---|---|---|---|---|---|
| T1 | `layoutId` FLIP, one LayoutGroup across Ops tabs | 320 ms | `--ease` | instant swap | Unmounted or offscreen target: 140 ms crossfade, no FLIP. Any input cancels. |
| T2 | shared task drawer | 220 ms | `--ease-drawer` | instant | "Open in Board" is explicit. The drawer does not navigate by itself. |
| T3 | drawer widens, tab `add` | 320 ms then 140 ms | `--ease` / `--ease` | instant | Reverse is "Pop out to drawer". |
| T4 | satellite `rise` the next time Office is visible | 220 ms | `--ease` | instant appear | No navigation. A canvas test run never auto-switches to Office. |
| T5 | tab content fade | ≤ 140 ms | `--ease` | instant | Tab switch itself is instant. |
| T6 | `land` on a legal board drop | 220 ms | `--ease` | instant | Illegal drop: snap-back plus a reason toast (§3). Server-validated. |
| T7 | badge `pop`, or `strike` plus fade | 140 ms / 220 ms | `--ease` | static end state | — |
| T8 | new Needs-you row `rise` | 220 ms | `--ease` | instant | Never re-sort under the pointer. Resolved elsewhere: fade plus toast. |
| T9 | presence colour crossfade | 220 ms | `--ease` | instant colour | Includes the done → idle fade at 10 s. |
| T10 | gold glow decay on a live-run node | 600 ms | `--ease` | no glow | Not a duration token. |
| T11 | zoom from buttons | 140 ms | `--ease` | instant | Wheel zoom has no animation. |
| T12 | toast `rise` / fade | 220 ms | `--ease` | instant opacity | Queue and focus: §3. |
| T13 | rail / inspector / dock slide | 220 ms | `--ease-drawer` | instant | Persisted open state. |
| T14 | drawer close, palette page push | 140 ms | `--ease` | instant | — |
| T15 | node or expander `grow` | 220 ms | `--ease` | instant | — |

Back and Forward restore scroll, focus, selection, and lens filter chips. That restore is not an animation.

### 2.3 Pulse cap, virtualization, offscreen

Presence pulse is at most 1 Hz. Frozen period is 1000 ms (1.0 Hz, the cap, not over it). Opacity 1 → 0.72 → 1, `--ease`. It runs only for a mounted working row whose sub-state is thinking or tool.

Do not run a layout animation when any of these is true:

- The row is in a virtualized list (`react-virtual` is already a Desktop dependency).
- More than 50 items are moving in the same transition.
- The FLIP target is offscreen or unmounted (T1 already falls back to a 140 ms crossfade).

An offscreen row does not pulse and does not FLIP. Mounting it later does not replay a missed FLIP.

R30 loading shimmer is an 8% gold band (`--gn-hairline-card`) travelling across panel. Reduced motion: the band is static. Empty, error, reconnecting, stale-degraded, and exhausted-recovery each have their own copy, in a §1 text colour, and their own way out. They do not share one page-level error. Copy colour is tertiary `#9A8F7A` unless the row is a presence state, in which case it uses that state's copy colour.

## 3. Toasts (O8, O90, T12, R30)

Arrival never steals focus. Mounting a toast does not call `focus()`, does not trap focus, and does not move the keyboard target. `aria-live` is `polite`. The toast is not a dialog.

The user may move focus to a toast control later. That is not a steal. Activating `[Review]` focuses the card, because the user activated it.

### 3.1 Approval truncation leads to [Review] (O8)

One-click Approve and Deny (D3) render only when the full command and args fit unabridged: no ellipsis, no line clamp, the entire string visible in the toast preview.

If they do not fit, the preview may ellipsize, and the only action is `[Review]`. There is no truncated Approve. `[Review]` focuses the card. It does not approve.

No second confirm when Approve is shown. Stop-run and other destructive non-approval actions keep their confirm (D3). There is still no single-key approve. A toast does not register Enter or Esc as approve or deny.

### 3.2 Queue

At most one visible toast per kind, plus a `+n more` chip for the hidden ones of that same kind (O90, T12). `n` is the hidden count for that kind, not a global count.

Kinds that must use this queue: `approval`, `blocked`, `resolved` (SPEC §3.2 "Resolved elsewhere"), `reason` (T6 illegal drop). Any later kind uses the same rule. It does not get a second stack.

The chip text is `+n more`. Activating it focuses Needs-you (O90's destination). It does not navigate on arrival. Dismiss `×` removes that kind's visible toast and does not focus the next one.

Orbit's one-toast-at-a-time behaviour is the thing O90 adapted. Do not implement a single global slot that drops other kinds.

## 4. W1–W12 design contracts (presence and motion only)

ASCII and the screenshot index are P0-08. Each screen consumes this file as follows. No screen invents a state, a duration, or a toast slot.

| Screen | Contract |
|---|---|
| W1, W1b | Legend and status-bar counts are §1 and §1.3. Motion readout cycles Full / Reduced / System and gates §2.1. Focus ring is not a working disc. |
| W2 | Orrery drift and halo only while A1 reports live runs (O57). Halo intensity follows the active-run count. No idle blink. Centre is sandhi (D6); that is not a presence colour. Why footer uses the why tier. |
| W3 | Sub-state label from §1.1. Sigil from §1.4. |
| W4 | Test-run stream is SSE only (O46). Node open is T15. A test run does not navigate (T4). |
| W5 | Drop is T6. Card sigil is §1.4. |
| W6 | Timeline entries are events. No synthetic rows. |
| W7 | Duration and tokens are tabular. Null stays null (A2). Not a fake zero. |
| W8 | Needs-you list is the `[Review]` and `+n more` destination. |
| W9 | Motion row copy is the O79 sentence. Theme row opens Desktop settings. |
| W10 | Independent empty / loading / reconnecting / stale-degraded / exhausted-recovery. Shimmer is R30. Stale copy uses the stale colour, not idle. |
| W11 | Text tiers only. Secrets are names only. |
| W12 | Table row 32 px, one 24 px gutter, presence labels on profile chips. |

D14 (split pane beside chat) is geometry. P0-04 froze the keymap. P0.5 builds the pane. This file does not move the split. Tokens are app-wide (D5); presence and these durations apply inside Ops. They do not restyle chat message bubbles except through the `gold-night` theme object in the companion file.
