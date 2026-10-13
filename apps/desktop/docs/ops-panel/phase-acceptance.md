# Ops panel phase acceptance (P0-07)

Status: documentation only. Freezes the P0 and P0.5 exit gates. Does not sign either exit. Does not implement a check runner.
Pair: `review-loop.md` in this directory (packets, rounds, leniency, Nacho's gate).
SPEC: vault `01-Projects/Hermes/desktop-ops-panel/SPEC.md` v4. PLAN: vault `01-Projects/Hermes/desktop-ops-panel/PLAN.md`, P0 lines 45-54, P0.5 lines 56-64.
Tree cited: `feat/ops-panel` at `a8c434eca5e` unless a row names an older line that is still in that tree.

A phase has not exited until Nacho posts `NACHO GATE PASS` with `object: phase-exit` (template in `review-loop.md` section 7.5) and Judge has posted `JUDGE PHASE PASS` for that phase. Both comments cite every row below as PASS with a pointer. A missing row, or a PASS with no pointer, is not an exit. That PASS is lenient (`review-loop.md` section 6, grade ≥ 2).

These gates are foundation checks. They are not behavior acceptance for later phases. Section 4 is the cut line.

## 1. How a row is satisfied

Each row has an artifact (a file that already exists, or a comment that must exist at exit) and an executable check (a re-read or a command a later Judge can run). "Executable" does not mean a tool shipped here. It means the check is specific enough to fail.

- `artifact` empty, or `check` empty: the row is not frozen. P0-07 is not done.
- The artifact exists and the check has not been run: the row is frozen, the phase has not exited.
- The check fails, or a named blocker in the artifact is still open: Judge writes FAIL. Do not exit.
- Judge PASS on a row whose blocker line is still in the artifact, with no later card closing it: lenient.

P0 exit is blocked today by rows that say so. This file does not clear them.

## 2. P0 exit

PLAN.md:54: every planned action maps to a verified handler or a named new endpoint (A1–A7). Contrast ≥ 4.5:1 for text tiers. Zero unresolved collisions. Judge sign-off on the matrix.

The card's P0 list is the rows below. All of them are required. One FAIL blocks the phase.

| Id | Criterion | Artifact | Executable check | Exit note |
|---|---|---|---|---|
| P0-X1 | Complete route matrix | `read-contracts.md` section 11, heading at line 1190; subsections 11.1 (line 1194) and 11.2 (line 1250) | Re-read those two subsections. Every SPEC route they index has a status of `verified`, `proposed`, or `incomplete`. A blank status fails completeness. Proposed routes stay proposed; completeness is not implementation. | Does not claim A1–A7 are implemented. Section 5 of that file is explicitly proposed. |
| P0-X2 | Complete action matrix | `action-contracts.md` sections 3-7 (headings at lines 49, 156, 183, 384, 533) | Re-read those headings. Each SPEC write the file claims to cover has a status line (`verified`, `proposed`, or a named gap). A write with no status fails the matrix. | Proposed routes are not landed handlers. |
| P0-X3 | Complete storage matrix | `storage-map.md` sections 3 and 4 (lines 52 and 69), node headings 4.1-4.12; `transaction-contract.md` | Count node headings 4.1 through 4.12. Expect 12. Each has a write-set. The transaction file is the backup contract, not a running writer. | A5/A6 are not implemented. `policy-capabilities.md` line 17 says future A5/A6 work is outside P0 and P0.5. |
| P0-X4 | Resolved verification ledger | `source-verification.md` lines 7-9 (the 20 ids) and the verdict table at line 17 | The `###` headings are exactly O16, O41, O56, O58, O60, O64, O66, O67, G27, G28, G61, G68, G70, G82, G84, R4, R23, R34, R42, R57, each once, in that order. `coverage.md` section 5 step 4 is the same check. | R23 is documentary verified, dynamic signature pending (verdict table line 35). That row is not an implementation PASS. |
| P0-X5 | Coverage recomputed | `coverage.md` section 3 (line 57) and section 5 (line 92) | Run the four steps in section 5 against SPEC section 12.8. Expect Keep 82, Adapt 130, Cut 18, kept 212/230 = 0.9217391304. Not 213/230. Not SPEC's paper 93.9%. | `coverage.md` line 86: P0 exit stays blocked while the R23 dynamic signature is unsigned. This file does not clear that block. |
| P0-X6 | Zero unresolved key collisions | `keymap.md` line 259 (`Unresolved count: 0.`) and the ledger in section 6 (line 243) | Re-read section 6. A row is unresolved only when it has none of: an existing-code resolution, a named bounded requirement with an owner phase, or a recorded P0 decision. Expect unresolved count 0. Section 8 (line 269) is the static file:line re-check. Do not send chords to the installed Desktop (`keymap.md` line 316). | Count 0 is not a keypress signature and not a claim that P0.5 bounded requirements have landed (`keymap.md` line 245). |
| P0-X7 | Measured contrast | `gold-night-tokens.md` text-tier table (floor stated at line 184; rows through the blocked/offline copies around lines 192-206) | Every text-tier minimum on the three supported reading surfaces is ≥ 4.5. The tool is `@hermes/shared/color` `contrastRatio`. On this tree that function is `apps/shared/src/color.ts:83-94`. `gold-night-tokens.md:176` cites `color.ts:67-94` from its own base; line 67 on this tree is `channelLuminance`, not the ratio. Re-read `:83`. A row under 4.5 fails. | Plugin pairs that fail 4.5:1 are recorded so they are not copied (line 22). They are not the production ramp. |
| P0-X8 | Capability and policy contracts | `ops-policy.yaml` (version 2, three allow entries, `deny_default: true`) and `policy-capabilities.md` section 1 (line 19) | Parse the yaml. Expect the fields in the section 1 table, types included (`version` int 2, `enabled` bool true, not the string `"true"`). Comments are not fields. The file header says it is not installed and must not be copied to `HERMES_HOME`. | Not A6. No process reads this yaml (`ops-policy.yaml` lines 1-2). |
| P0-X9 | Frozen wireframes | `wireframes.md` sections 3-15 (W1, W1b, W2, W3, W4, W5, W6, W7, W8, W9, W10, W11, W12) | Headings exist for those thirteen fences. Freeze rule is section 1 (line 12): ASCII is copied, not redrawn. An annotation that deletes a region fails the freeze. | Not visual QA against the 19 shots. That is P0.5-X1. |
| P0-X10 | Judge sign-off | A comment `JUDGE PHASE PASS P0` that lists P0-X1 through P0-X10, each with a pointer, plus `NACHO GATE PASS` `object: phase-exit` `task_or_phase: P0` | Both comments exist, every row is PASS, every PASS has a pointer, and P0-X4 / P0-X5 blockers are either still FAIL or closed by a named later card. Absent comments: phase not exited. | This file is not that signature. |

P0 has not exited. P0-X5's blocker is still written in `coverage.md`. P0-X10's comments do not exist.

## 3. P0.5 exit

PLAN.md:64: side-by-side visual review against the 19 reference screenshots, signed by the judge. Chat stays usable with Ops open. Full-screen toggle round-trips. Reduced motion passes. No duplicate chrome. Gold Night as the app-wide default passes visual QA on all core non-Ops Desktop routes, and other themes stay selectable (D5).

The card adds W10 isolation and locales. Both are rows below. All rows are required.

| Id | Criterion | Artifact | Executable check | Exit note |
|---|---|---|---|---|
| P05-X1 | Judge-signed comparison with all 19 references | `reference-index.md`. Count rule at lines 11-13. Entries 01-19. Blockers B1 (line 243), B2 (line 247), B4 (line 255) are not entries. | Count level-2 headings whose text is `Entry` plus a two-digit id. Expect 19. Each entry has File, Path, Bytes, SHA-256. Re-hash the path and compare to the SHA-256 line. A mismatch fails. Judge's phase comment names all 19 ids and a pass or fail per id. | B1, B2, and B4 are open phase-exit blockers in that file. Signing P05-X1 while those headings still say blocker, with no later card closing them, is lenient. PNGs are not in git. |
| P05-X2 | App-wide non-Ops theme QA | `gold-night-tokens.md` lines 12-16 (the requirement). Its `presets.ts:462` citation is stale on this tree. Current default: `apps/desktop/src/themes/presets.ts:656` `DEFAULT_SKIN_NAME = 'gold-night'`. | At exit, under the effective skin `gold-night`, capture one screenshot each of chat (`/`), Desktop settings, `/profiles`, `/command-center`, and `/capabilities`. Paths go in the phase comment. A route whose effective skin is not `gold-night` fails. The constant at `:656` is the code half only. It is not visual QA. This commit does not edit `presets.ts`. | No screenshot set is attached here. Missing paths = FAIL, not a silent PASS. Do not copy `gold-night-tokens.md:14` (`nous` at `:462`) as the current line. |
| P05-X3 | Other themes selectable | `gold-night-tokens.md` line 15 (requirement, including System, G18, G76). Current list: `presets.ts:633-648` `BUILTIN_THEMES`. Retired set: `presets.ts:662`. | Read `BUILTIN_THEMES`. On this tree the keys include `nous`, `github`, `catppuccin`, `everforest`, `solarized`, `nous-alt`, `classic`, `midnight`, `ember`, `mono`, `slate`, `cyberpunk`, besides `gold-night` and `gold-night-hi`. At least one non-`gold-night` built-in must remain, System must remain selectable, and the settings menu must be able to select a non-default skin. A menu that only offers `gold-night` fails. `RETIRED_SKINS` includes `gold` and must not include `gold-night`. `gold-night-tokens.md:15` cites `presets.ts:444-456`; that range is the older tree. Re-read `:633`. | Selectable is not "Gold Night failed to become the default". Both are required: default is P05-X2, others stay in the menu here. `desktop-surface-audit.md:25` also says the default is `nous`. That was P0-04's tree. It is not this SHA. |
| P05-X4 | Chat usability with Ops open | `desktop-surface-audit.md` lines 72-77 and 87-91; `wireframes.md` line 43 | With the Ops split open, the chat composer accepts one keystroke, the session id is unchanged, and the draft is still there. Record before/after session id in the phase comment. Full-screen must not call `session.new` and must not navigate to `/`. | Not claimed done. A wireframe sentence is not a passing keystroke. |
| P05-X5 | Split / full-screen round-trip | `desktop-surface-audit.md` lines 87-91; `wireframes.md` section 3 (line 41); `keymap.md:196` (Esc priority 5, full-screen restore) | ⤢ hides non-Ops panes as `hot-hidden` (keep-alive), not `park`, and does not unmount the composer. A second ⤢, or Esc when full-screen is the innermost layer, restores the same hidden set. Chat session, draft, and stream stay. Evidence is the before/after set in the phase comment. | Not claimed done. |
| P05-X6 | Reduced motion | `presence-motion.md` lines 188-208 (eight keyframe substitutions and the SPEC §12.3 list) | With `prefers-reduced-motion: reduce`, and with the status-bar Motion readout set to Reduced: rise has no translate, land and pop are off, presence pulse stops, orrery drift stops, text still streams, caret does not blink. Evidence is a test name or a judge observation that names those six. System follows the OS query (line 199). | Not claimed done. Token names are not a passing media-query run. |
| P05-X7 | W10 isolation | `wireframes.md` lines 307-321; per-flag W10 bullets in `policy-capabilities.md` (first at line 308) | Fail one Office section or one Canvas node (one capability flag false, or one forced empty). Neighbours stay rendered, with their own copy. A whole-page error fails. Evidence names the failed section and one sibling that stayed. | Not claimed done. The flag contract is not a running flag. |
| P05-X8 | Locales | `wireframes.md` lines 297-299 (W9 date format); SPEC.md line 647 row R27 | Format the fixed instant `2026-10-12T18:00:00-03:00` in `es-AR` and in `en-US` on the Ops date control. The phase comment records both visible strings. They must differ, neither may be that raw ISO timestamp, and the screen must not grow a second date control. Theme and accent stay in Desktop settings (D5), not a second settings form (`wireframes.md` line 305). | No locale table was frozen by an earlier card. This check is the exit check. Not claimed done. |
| P05-X9 | No duplicate chrome | `desktop-surface-audit.md` section 4 (line 116), lens table lines 120-133; `reference-index.md` entry 02 freeze (do not add a second composer) | For each lens row, the destination is the existing route in that table, not a rebuilt library. Judge confirms: no second skills library, no second profile editor, no second composer, no second session list. A new route that repeats one of those destinations fails. | The table is the contract. It is not a passing UI audit. |

P0.5 has not exited. P05-X1 blockers B1, B2, and B4 are still open in `reference-index.md`. P05-X2 through P05-X9 have no passing evidence in this commit.

Phase signature, when it exists, is `JUDGE PHASE PASS P0.5` listing P05-X1 through P05-X9 with pointers, plus `NACHO GATE PASS` `object: phase-exit` `task_or_phase: P0.5`. Same leniency rule as P0-X10.

## 4. Foundation versus later behavior

P0 and P0.5 sign foundation: matrices, ledger, coverage arithmetic, collision classification, measured contrast, policy text, wireframes, reference index, and the shell checks in section 3.

A P0.5 signature does **not** claim that any of the following are implemented:

- A1 fleet presence (`GET /api/ops/fleet`)
- A2 per-run usage
- A3 approvals list, routed respond, or one-click approve
- A4 delegation projection
- A5 transactional backup writes, history, or restore
- A6 runtime policy enforcement
- A7 kanban / fleet push stream as product behavior
- Office business workflows (dispatch, approve, orrery on live data)
- Canvas business workflows (node save, test run)
- Board business workflows (drag, claim, bulk, keyboard move)

Those belong to P1–P4 (`PLAN.md` lines 66-99). A read contract that marks a route `proposed`, a wireframe that draws Office, or a policy flag that describes W10 is a foundation artifact. Citing it as "A3 shipped" or "Board works" is a false phase claim. Judge FAIL that item. Meta grades a PASS on it at least 2.

`policy-capabilities.md` line 17 already draws this line: future backend and Electron implementations of the flags and of A6 are outside P0 and P0.5. This file repeats it so a P0.5 exit comment cannot outrun that sentence.

## 5. Judge-prompt trigger

Independent of phase exit. If three tasks in P0, or three tasks in P0.5, receive leniency ≥ 2 (`review-loop.md` section 6), Nacho reviews the judge prompt. Marker: `JUDGE-PROMPT REVIEW` naming the three tasks, the three grades, and the prompt text. It does not exit the phase and it does not replace a failed row in section 2 or 3.

## 6. Re-run

1. For each id in sections 2 and 3, confirm the artifact path exists in this tree and the check names a concrete re-read, count, hash, or observation. Zero empty cells.
2. Confirm section 4 names A1, A2, A3, A4, A5, A6, A7, approvals, transactional writes, Office, Canvas, and Board as not implemented by a P0.5 claim.
3. Confirm this file does not contain `JUDGE PHASE PASS` as a signature of the current tree. The words may appear only as the comment title the exit still lacks.

Pair the walk in `review-loop.md` sections 8-9 with this list. The task verify is both: one PASS example, one rejected example, and this table complete.
