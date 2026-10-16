# Presence, motion, and toasts (P0-05)

Status: r2. Presence, motion, and the toast queue are frozen. Wireframes W1–W12 and the 19-screenshot index are P0-08. This file does not sign visual fidelity.
Base: `2ab328a9c66`. Companion: `gold-night-tokens.md`. Colours cited here are measured there. Do not introduce a hex that file does not already list. Round 2 cites `#A89880` and the §6.3 discs from that sheet.
Rows: O8, O46, O54, O56, O57, O77, O79, O90, R30, R31. Also SPEC §2 presence enum, §3.1–§3.3, §12.3, §12.4 (T1–T15).

§6's 180–240 ms ease-out is superseded (R31, SPEC §12.3). This file is the resolved motion spec. It does not edit `SPEC.md`.

## 1. Presence is shape + colour + label

A state is not shown by colour alone. Rail, inspector, and tables always render the label (O54, SPEC §12.3). With 36 profiles, non-idle rows come first. Idle rows fold into one "N idle" row. Unknown and stale do not fold into idle.

Data values match SPEC §2: `working | needs_you | blocked | idle | offline | unknown | stale`. Display labels use the words below. `needs_you` displays as `needs-you`.

| State | Shape | Glyph colour | Copy colour | Label | Pulse |
|---|---|---|---|---|---|
| working | filled disc ●, 8 px, no hole (§1.0) | `#E8C77A` | `#E8C77A` | `working` | yes, §2.3 |
| needs-you | ringed disc ◉ (§1.0) | `#D4893A` | `#D4893A` | `needs-you` | no |
| blocked | triangle ▲ | `#B4533C` | `#BF6D59` | `blocked` | no |
| idle | middle dot · | `#CDBB98` | `#CDBB98` | `idle` | no |
| offline | hollow disc ○ | `#6E675C` | `#8A8376` | `offline` | no |
| unknown | dotted circle ◌ (§1.0) | `#9A8F7A` | `#9A8F7A` | `unknown` | no |
| stale | barred circle ◍ (§1.0) | `#A89880` | `#A89880` | `stale` | no |

Glyphs that fail 4.5:1 (`#B4533C`, `#6E675C`) are shapes only. The word next to them uses the copy colour. Both pairs are in `gold-night-tokens.md` §6. Stale glyph and stale copy both use `#A89880`, which clears 4.5:1, so the word and the mark share one measured hex.

Unknown and stale are separate states. SPEC §12.3 drew them as one hatched mark. The enum already splits them, and this card requires the split. They share the hatched-neutral family (`#9A8F7A` unknown, `#A89880` stale). They are separated by shape (◌ dotted, ◍ barred) and by label. Neither hex is the accent.

Outcomes, not presence states:

| Outcome | Mark | Copy colour | Label |
|---|---|---|---|
| done | check | `#CDBB98` | `done` |
| failed | cross, glyph `#B4533C` | `#BF6D59` | `failed` |
| running | existing `GlyphSpinner`, stroke `#E8C77A` (SPEC gold spinner; a glyph, not text) | `#CDBB98` | `running` |
| queued | hollow disc, glyph `#6E675C` | `#9A8F7A` | `queued` |
| connected | small square, sage only | `#6F8F72` | `connected` |

No other green. Plugin `#3ECF8E` is not this sage. The spinner stroke is the glyph SPEC §12.3 names. The word `running` is not accent text.

### 1.0 Glyph geometry

Slot is 12 × 12 px, centered, for every presence glyph. The focus ring wraps the control, never the glyph.

| Mark | Geometry |
|---|---|
| working ● | Filled circle, diameter 8 px. No stroke. No hole. Pulse changes opacity only. |
| reduced-motion working | The same 8 px filled circle, plus a 1 px stroke in `#E8C77A` whose inner edge meets the disc (0 px gap). The stroke sits outside the fill, so the outer diameter is 10 px. The interior stays solid. There is no hollow. |
| needs-you ◉ | Outer ring only: outer diameter 12 px, stroke 1.5 px, so the ring's inner diameter is 9 px and the interior is hollow. Inner dot: diameter 3 px, centered. The hollow gap from the dot's edge to the ring's inner edge is 3 px. |
| unknown ◌ | Dotted circle: outer diameter 10 px, 1 px stroke, dash 1 px / gap 1 px. No inner dot. No bar. |
| stale ◍ | Circle: outer diameter 10 px, 1.5 px solid stroke, plus one horizontal bar 6 × 1 px through the centre. The bar is not a dot. |

The reduced-motion working glyph differs from needs-you ◉ by shape: it is a solid 8 px disc with a 1 px stroke that meets the disc at 0 px gap and has no hollow, while ◉ is a 1.5 px ring of outer diameter 12 px with a 3 px hollow gap around a 3 px inner dot.

SPEC §12.3 says "pulse → static ring". This freeze adapts that phrase to the hugging stroke above. A standalone ring would be the ◉ shape, which O54 forbids (shape, not colour alone). The focus ring in `gold-night-tokens.md` is a different object: it wraps the control and is never this glyph.

### 1.1 Working sub-states (O77)

Sub-states of `working` only. They are not extra top-level states. `thinking` and `tool:<name>` use the working glyph and the working copy `#E8C77A` (the accent carve-out). `done` does not.

| Sub-state | When | Label | Look |
|---|---|---|---|
| thinking | a thinking event on the run or session stream | `thinking` | working disc, pulse on, copy `#E8C77A` |
| tool | a tool event | `tool:<name>` | working disc, pulse on, copy `#E8C77A` |
| done | a completion event, for 10 s from that event's `event_at`, and only while the backing observation stays fresh | `done` | static disc, no pulse, copy `#CDBB98`. Stale beats done if the observation ages out. The next state at 10 s is §1.3, not an automatic idle |

`tool:<name>` is lowercase `tool`, a colon, and the event's tool name. If the event has no name, the label is `tool`, not an invented name.

`done` is not counted in the fresh working counter. The work event has ended. It stays `done` only while `now − observed_at ≤ 5 s` and `now − event_at ≤ 10 s`. If the observation goes stale inside those 10 s, the row is `stale`, not `done`. At 10 s it becomes `idle` only when §1.3 says so, by a 220 ms colour crossfade (T9). The 10 s is the fade rule on a real completion event, not a new event source, and not an idle inference.

SPEC §2 also lists `waiting_approval` as a sub-state. That value maps to top-level `needs-you`, not to a fourth working sub-state. An approval event is needs-you. It is not `working` / `thinking`.

Orbit's "researching" and "waiting" words are not labels. O77 adapted them into the three sub-states above.

### 1.2 Event-backed only

No activity state without an event behind it (O77). Sources are the ones SPEC §3.1 already names. This card does not add endpoints.

Two timestamps, not one:

- `event_at` is when the event happened.
- `observed_at` is the last successful read of the backing source: A1 / `workers/active`, approvals, kanban, or cron.

`fresh` = `now − observed_at ≤ 5 s`. The 5 s is the P0-05 freeze derived from the SPEC §3.3 SLA ("agrees with `workers/active` within 5 s of a change"). It is not a SPEC TTL. Event age never makes a row stale.

`stale` = a prior observation exists, and the last successful read is older than 5 s, or the row is the §3.2 profile-list snapshot older than 60 s.

`offline` = a read confirmed the backend unreachable.

`unknown` = never observed. There is no `observed_at`.

| State | Event required | Must not be inferred from |
|---|---|---|
| working / thinking | `workers/active` running, or a session/run stream event, and the row is fresh | a quiet profile, or event age |
| tool:<name> | a tool event that carries the name, and the row is fresh | the last tool the profile ever used |
| done | a completion event, shown for 10 s from `event_at` only while `observed_at` stays fresh | a missing heartbeat, or the clock alone |
| needs-you | `approval.pending`, kanban `blocked` or `review`, cron `failure_streak>0`, or a policy violation, revalidated by a fresh read | a flag with no current event. Event age does not drop it |
| blocked | assigned task `status=blocked`, revalidated by a fresh read | needs-you |
| idle | a fresh observation that shows gateway-up and no-work | a done timer, unknown, or a stale prior row |
| offline | a read that confirmed the backend unreachable | a missing row |
| stale | a prior observation exists, and the last read is older than 5 s, or it is the §3.2 >60 s snapshot | event age; unknown |
| unknown | never observed | idle, offline, or working |

Unknown is the absence marker. It is the only display that has no observation, and the label must say so. Painting idle, offline, or working when the observation is missing is forbidden.

A row is never both `done` and `stale`. Stale beats done. A row is never `idle` without a fresh gateway-up + no-work observation.

O46: the pulse runs only while a current working event says thinking or tool. Streaming text runs only from SSE (`/v1/runs/{id}/events`). No decorative blink. No idle blink (O57).

### 1.3 Fresh-only counters

A row is fresh when `now − observed_at ≤ 5 s`. Event age is not the test.

These counts include fresh rows only:

- Rail section counts and the folded "N idle" count
- Status-bar "N working" and "N needs you"
- Inspector group counts
- Orrery inner-ring membership

`done`, stale, and unknown are excluded from those counts (`counted-in = none`). They stay visible in their own groups. Offline is its own count, not added to idle, and that count is also fresh-only. A counter with no fresh rows renders `0`, not a blank and not a stale total.

Profile-list timeout past 60 s keeps the last snapshot and labels it stale (SPEC §3.2). That snapshot does not feed fresh counters. A newer fresh read from A1 / `workers/active` is not overridden by that snapshot.

At `event_at + 10 s` a completion becomes `idle` only if the latest observation is fresh and shows gateway-up + no-work. If that observation is not fresh, the row is `stale` when a prior observation exists, and `unknown` when none exists. A fresh read that shows new work yields that work's state, not idle. The timer alone never yields idle.

Sequence. Each step lists state, label, and counted-in.

| Step | Now | event_at | observed_at | State | Label | Counted-in |
|---|---|---|---|---|---|---|
| S1a | t0 | t0, completion | t0, fresh read | done | `done` | none |
| S1b | t+6 | t0 | t+6, fresh read, no newer work | done | `done` | none |
| S1c | t+10 | t0 | t+10, fresh read shows gateway-up + no-work | idle | `idle` | idle |
| S2a | t0 | t0, completion | t0 | done | `done` | none |
| S2b | t+6 | t0 | t0, no read after t0 | stale | `stale` | none |
| S2c | t+10 | t0 | t0, still no read | stale | `stale` | none |
| S3 | t | t−10 min, approval pending | t, revalidated | needs-you | `needs-you` | needs-you |
| S4 | t | t, unreachable confirmed | t | offline | `offline` | offline |

S1 is done, then idle. The t+6 read is fresh, so the row is not stale, and the 10 s has not elapsed, so it is not idle yet. S2 never becomes idle: stale beats done at t+6 and at t+10. S3 stays needs-you and counted; the 10 min event age does not stale it. S4 is offline, not idle and not unknown, because the unreachable read is an observation.

### 1.4 Sigils (O56)

Deterministic. No random colour, no network avatar.

Hash is the one already in tree: `hashString` in `src/lib/profile-color.ts:9-17` (`hash * 31 + charCode`, unsigned 32-bit, walking UTF-16 code units via `charCodeAt`, not graphemes). `profileColor` returns null for empty and `default` (`profile-color.ts:24-26`). There is no `themes/profile-theme` module. O56's verify note resolves to `profile-color.ts` plus `resolveProfileColor` (`profile-color.ts:35-43`).

`resolveProfileColor` never returns null for a named profile. If the overrides map has no entry it returns the hashed `hsl()` from `profileColor` (`profile-color.ts:35-43`). That hsl fallback is not used for the sigil. This is the O56 adaptation.

| Part | Rule |
|---|---|
| Disc fill | `list[hashString(trimmed name) % 4]`, list in `gold-night-tokens.md` §6.3 (`#C9A55A`, `#D3B065`, `#DEBC6F`, `#E8C77A`). Not the rainbow `hsl()` from `profileColor`. Ivory on any of those discs is ≤ 1.917:1 and is forbidden. |
| Monogram ink | `#0E0D0B` on that disc. Ratios are the §6.3 ink column (all ≥ 8.337:1). |
| Monogram | Uppercase first two Unicode extended grapheme clusters of the trimmed name (`Intl.Segmenter`, granularity `grapheme`, then `toUpperCase`). One grapheme if the name has one. The hash does not pick this string. |
| Empty / `default` | No gold disc. Neutral raised `#1F1B14` with a middle dot in ivory. No rim. |
| Profile colour, if one exists | A user-stored entry in `resolveProfileColor`'s overrides map only. Paint a 2 px rim in that colour. Keep the gold disc and the measured ink. The rim does not replace the disc. |
| No override | No rim. Do not paint the hsl fallback. |

Vectors. Hash and index were computed with the `hashString` above. Ink ratios are the §6.3 measurements. Empty and `default` record the hash so it can be checked; the index is not applied.

| Name | hashString | Index | Disc | Monogram | Ink |
|---|---|---|---|---|---|
| `""` | 0 | not applied (0 % 4 = 0) | none | none | — |
| `default` | 1544803905 | not applied (1544803905 % 4 = 1) | none | none | — |
| `sandhi` | 3385310341 | 1 | `#D3B065` | `SA` | 9.405 |
| `sandra` | 3385310643 | 3 | `#E8C77A` | `SA` | 11.916 |
| `Émile` (NFC U+00C9) | 188979294 | 2 | `#DEBC6F` | `ÉM` | 10.664 |
| `🔥ops` (U+1F525) | 1270412586 | 2 | `#DEBC6F` | `🔥O` | 10.664 |

`sandhi` and `sandra` share the monogram `SA` and not the index. `Émile` is one composed grapheme plus `m`, not `E` plus a separate acute. `🔥ops` is one emoji grapheme plus `o`; `hashString` still walks both UTF-16 units (55357, 56613, then `ops`). Reuse the same sigil in the rail, tables, timeline, toasts, and avatar stacks (O56).

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

- Presence pulse stops. The working mark becomes the §1.0 reduced-motion glyph (solid 8 px disc, 1 px hugging stroke, 0 px gap, no hollow). It does not become the needs-you ◉.
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
| T9 | presence colour crossfade | 220 ms | `--ease` | instant colour | The done → idle crossfade runs only when §1.3 yields idle. Stale or unknown does not crossfade to idle. |
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
| W1, W1b | Legend and status-bar counts are §1 and §1.3. Motion readout cycles Full / Reduced / System and gates §2.1. The focus ring wraps the control, never the glyph. |
| W2 | Orrery drift and halo only while A1 reports live runs (O57). Halo intensity follows the active-run count. No idle blink. Centre is sandhi (D6); that is not a presence colour. Why footer uses the why tier. |
| W3 | Sub-state label from §1.1. Sigil from §1.4. |
| W4 | Test-run stream is SSE only (O46). Node open is T15. A test run does not navigate (T4). |
| W5 | Drop is T6. Card sigil is §1.4. |
| W6 | Timeline entries are events. No synthetic rows. |
| W7 | Duration and tokens are tabular. Null stays null (A2). Not a fake zero. |
| W8 | Needs-you list is the `[Review]` and `+n more` destination. |
| W9 | Motion row copy is the O79 sentence. Theme row opens Desktop settings. |
| W10 | Independent empty / loading / reconnecting / stale-degraded / exhausted-recovery. Shimmer is R30. Stale copy uses `#A89880`, not idle and not the accent. |
| W11 | Text tiers only. Secrets are names only. |
| W12 | Table row 32 px, one 24 px gutter, presence labels on profile chips. |

D14 (split pane beside chat) is geometry. P0-04 froze the keymap. P0.5 builds the pane. This file does not move the split. Tokens are app-wide (D5); presence and these durations apply inside Ops. They do not restyle chat message bubbles except through the `gold-night` theme object in the companion file.
