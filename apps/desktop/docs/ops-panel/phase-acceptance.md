# Ops panel phase acceptance (P0-07)

Status: documentation only. Freezes the P0 and P0.5 exit gates. Does not sign either exit. Does not implement a check runner. Does not produce screenshots.
Pair: `review-loop.md` in this directory (packets, rounds, leniency, free merge, automatic phase exit).
SPEC: vault `01-Projects/Hermes/desktop-ops-panel/SPEC.md` v4. PLAN: vault `01-Projects/Hermes/desktop-ops-panel/PLAN.md`, P0 lines 45-54, P0.5 lines 56-64.
Tree cited: `feat/ops-panel` at `a8c434eca5e` unless a row names an older line that is still in that tree.

A phase exits automatically once every task in the phase has merged with JUDGE PASS + META PASS (Sandhi) and the phase checks below pass. Judge posts `JUDGE PHASE PASS` and Sandhi posts `PHASE PASS` with `object: phase-exit` (template in `review-loop.md` section 7.5). Both cite every row below as PASS with a pointer. A missing row, or a PASS with no pointer, is not an exit. That PASS is lenient (`review-loop.md` section 6, grade ≥ 2). Nacho does not gate or sign phase exit; he receives a summary heads-up only (Rule 2026-10-13 13:31 ART).

Phase exit is not a merge gate. Rule 2026-10-13 13:00 ART (Nacho): task merges into `feat/ops-panel` are free for every agent after JUDGE PASS + META PASS, with no human approval. Phase exit is automatic after those merges and the phase checks; it never blocks a merge or a push to `fork`.

These gates are foundation checks. They are not behavior acceptance for later phases. Section 4 is the cut line.

## 1. How a row is satisfied

Each row has an artifact (a file that already exists, or a comment that must exist at exit) and an executable check (a re-read or a command a later Judge can run). "Executable" does not mean a tool shipped here. It means the check is specific enough to fail.

A check that only re-reads what the artifact itself indexes, claims to cover, or counts as headings is not this check. The inventory comes from SPEC or PLAN (named below per row). The result is a per-item field in the phase comment. A missing item in that field is FAIL even when the artifact's own index is internally consistent.

- `artifact` empty, or `check` empty: the row is not frozen. P0-07 is not done.
- The artifact exists and the check has not been run: the row is frozen, the phase has not exited.
- The check fails, or a named blocker in the artifact is still open: Judge writes FAIL. Do not exit.
- Judge PASS on a row whose blocker line is still in the artifact, with no later card closing it: lenient.
- R23 dynamic signature unsigned is an exit FAIL, not a documentary PASS. It stays FAIL until a named card posts the signed close. This file does not name that card.

P0 exit is blocked today by rows that say so. This file does not clear them.

## 2. P0 exit

PLAN.md:54: every planned action maps to a verified handler or a named new endpoint (A1–A7). Contrast ≥ 4.5:1 for text tiers. Zero unresolved collisions. Judge sign-off on the matrix.

The card's P0 list is the rows below. All of them are required. One FAIL blocks the phase.

| Id | Criterion | Artifact | Executable check | Exit note |
|---|---|---|---|---|
| P0-X1 | Complete route matrix | `read-contracts.md` (the matrix under test). Independent inventory: vault SPEC.md sections 3, 4, 5 and section 12.8 Real source column, plus PLAN.md:54 A1–A7 at PLAN.md:68-73 and PLAN.md:79-80. | Do not start from section 11's own index. Extract every route token from those SPEC sections and the A1–A7 endpoint names. Write the list in the phase comment with `spec_routes=N`. Match each token to a row in `read-contracts.md`. Status must be `verified`, `proposed`, `incomplete`, or a named gap. Blank status fails. A token with no row is missing. `missing` must be 0. A matrix row with no extracted token is extra and needs a one-line justification. Record `matrix_rows`, `missing`, `extra`, `extra_justified`. Counterexample that must FAIL: drop `GET /api/ops/fleet` (PLAN A1, SPEC section 3.1) and leave the rest of section 11 indexed. Re-reading only what section 11 indexes does not see that omission. | Does not claim A1–A7 are implemented. Proposed routes stay proposed. |
| P0-X2 | Complete action matrix | `action-contracts.md` sections 3-8 (the matrix under test). Independent inventory: SPEC sections 3.1, 4.1 Write column, 4.2, and 5, plus PLAN.md:54 A1–A7. | Do not use "each SPEC write the file claims to cover". Extract Approve, Deny, Unblock, Steer, Stop, each section 4.1 write, the section 4.2 write path, section 5 drag / reassign / create / bulk / estimate, and A1 fleet read, A2 per-run usage, A3 pending list plus routed respond plus history, A4 delegation read, A5 transactional write plus history/restore, A6 policy validator, A7 kanban event stream. Write `spec_actions=N` in the phase comment. Each item maps to a verified handler or a named new endpoint, with a status. A write with no status fails. `missing` must be 0. Extra rows need a justification. Record the counts. Counterexample that must FAIL: omit the A3 routed respond while the remaining headings stay. | Proposed routes are not landed handlers. |
| P0-X3 | Complete storage matrix | `storage-map.md` and `transaction-contract.md` (the matrix under test). Independent node list is SPEC, not a heading count. | SPEC section 4.1 Node column: Prompt (SOUL), Description, Model, Tools, Skills, Memory, Channels, Schedule, Trigger, Sub-agents, Raw YAML. Twelfth: secrets surface, from SPEC section 12.8 O42, SPEC section 7, and SPEC section 11 item 2 (Channels secrets). Re-extract at exit. Expect those 12 names. A heading count of 12 is not the check. Each of the 12 must have a `Write-set` line in `storage-map.md` and a row in `transaction-contract.md` section 11 (Sub-agents may be the explicit refused / none row). A SPEC node with no write-set, or no transaction entry, fails. A heading outside the SPEC set is extra and must be justified. Record `node_ids`, `missing`, `extra` in the phase comment. Counterexample that must FAIL: keep 12 headings and delete one `Write-set` line. | A5/A6 are not implemented. `policy-capabilities.md` line 17 says future A5/A6 work is outside P0 and P0.5. |
| P0-X4 | Resolved verification ledger | `source-verification.md` verdict table and `###` sections (the ledger under test). Independent id list: SPEC.md section 12.6. | The 20 ids are O16, O41, O56, O58, O60, O64, O66, O67, G27, G28, G61, G68, G70, G82, G84, R4, R23, R34, R42, R57, taken from SPEC section 12.6, not from a heading count. Each id, once, in that order, as a verdict-table row and a `###` heading. Heading match alone is not enough. Each row must have a non-blank verdict, a disposition (Keep, Adapt, Cut, partial Cut, or the recorded blocker class), and an evidence pointer into that id's `###` section. A pending or blank verdict, disposition, or evidence pointer fails. Result field: one `verdict` / `disposition` / `evidence` triple per id in the phase comment. R23's filled verdict "documentary verified / dynamic signature pending" is not a blank, and it is still an exit FAIL until a named card posts the signed dynamic close. This file does not name that card. Counterexample that must FAIL: keep the 20 headings and set one verdict cell to pending or blank. | R23 unsigned is an exit FAIL, not an implementation PASS, and not cleared by a heading that still exists. |
| P0-X5 | Coverage recomputed | `coverage.md` (the arithmetic under test). Independent sources: SPEC section 12.8 for the paper counts, SPEC section 12.7 for the original Cuts, `source-verification.md` for flips. | Recompute. Do not copy the claimed total. Procedure is `coverage.md` section 5, run against SPEC section 12.8. Expect Keep 82, Adapt 130, Cut 18, kept 212/230 = 0.9217391304. Not 213/230. Not SPEC's paper 93.9%. Independent Cut inventory: SPEC section 12.7 (O25, O37, O75, O83, G8, G9, G19, G64, G77, G87, R14, R28, R29, R33) plus ledger flips (full: G70, G82, R34, G10; partial: O16, O60, O66, O67, G28, G61, G72). Each Cut in that union has disposition, reason, and owner in the phase comment. Any of the three empty fails. R23 is not a Cut. The block at `coverage.md` line 86 (dynamic signature unsigned) is an explicit exit FAIL until a named card posts the signed close. This file does not name that card, so P0-X5 does not exit. Counterexample that must FAIL: publish the arithmetic while one Cut has no owner, or treat line 86 as cleared because the headings still exist. | This file does not clear the R23 block. |
| P0-X6 | Zero unresolved key collisions | `keymap.md` section 6 (line 243) and section 8 (line 269). Independent chord list: PLAN.md:50. | Do not stop at `Unresolved count: 0.` Each PLAN.md:50 chord (Ctrl+W, Ctrl+Tab, `/`, Ctrl+J) has a row in section 6. A row is unresolved only when it has none of: an existing-code resolution, a named bounded requirement with an owner phase, or a recorded P0 decision. Result field in the phase comment: `unresolved_count` plus pass/fail per PLAN chord. Expect unresolved count 0. Reading only the count line is not this check. Do not send chords to the installed Desktop (`keymap.md` line 316). | Count 0 is not a keypress signature and not a claim that P0.5 bounded requirements have landed (`keymap.md` line 245). |
| P0-X7 | Measured contrast | `gold-night-tokens.md` text-tier table (rows through the blocked/offline copies around lines 192-206). Independent floor: PLAN.md:54. | Do not trust the file's own floor sentence. Result field: one ratio per text-tier row, in the phase comment, computed with `@hermes/shared/color` `contrastRatio`. On this tree that function is `apps/shared/src/color.ts:83-94`. `gold-night-tokens.md:176` cites `color.ts:67-94` from its own base; line 67 on this tree is `channelLuminance`, not the ratio. Re-read `:83`. Every ratio must be ≥ 4.5. A row under 4.5 fails. A claimed floor with no per-tier ratio is not a PASS. | Plugin pairs that fail 4.5:1 are recorded so they are not copied (line 22). They are not the production ramp. |
| P0-X8 | Capability and policy contracts | `ops-policy.yaml` and `policy-capabilities.md` section 6 (the contract under test). Independent flag list is that section's table, which must cover PLAN A1–A7 plus the write and run flags named there. | YAML half: parse `ops-policy.yaml`. Expect version int 2, `enabled` bool true (not the string `"true"`), three allow entries, `deny_default: true`. Comments are not fields. The header says it is not installed and must not be copied to `HERMES_HOME`. Capability half, separate: the eleven flags are `ops.fleet` (A1), `ops.usage` (A2), `ops.approvals` (A3), `ops.delegation` (A4), `ops.transaction` (A5), `ops.history`, `ops.restore`, `ops.policy` (A6), `ops.kanban_sse` (A7), `ops.unblock` (atomic unblock), `ops.runs` (scoped typed run ops). For each flag the phase comment records six cells: schema (boolean), versioning (`ops_capabilities_schema` int 1), absent/false behavior, dependencies, auth/scope, W10 degradation. A missing flag or an empty cell is FAIL. The YAML parse does not satisfy this half. Counterexample that must FAIL: yaml version 2 parses, and `ops.unblock` has no W10 cell. | Not A6. No process reads this yaml (`ops-policy.yaml` lines 1-2). Flags are a contract, not a running `/api/status`. |
| P0-X9 | Frozen wireframes | `wireframes.md` (the freeze under test). Independent fence list: SPEC section 12.5 and PLAN.md:51. | Do not count `wireframes.md` headings and call that the freeze. SPEC section 12.5 names W1, W1b, W2, W3, W4, W5, W6, W7, W8, W9, W10, W11, W12. PLAN.md:51 requires W1–W12 frozen. Result field: one present/absent per SPEC fence id in the phase comment. Freeze rule is `wireframes.md` section 1 (line 12): ASCII is copied, not redrawn. An annotation that deletes a region fails. A heading count with one SPEC fence absent fails. | Not visual QA against the 19 shots. That is P05-X1. |
| P0-X10 | Judge + Sandhi phase PASS | A comment `JUDGE PHASE PASS P0` plus Sandhi `PHASE PASS` `object: phase-exit` `task_or_phase: P0` (automatic; no Nacho gate). Independent checklist: PLAN.md:54 and rows P0-X1 through P0-X9. | Result field: the Judge comment lists P0-X1 through P0-X10, each PASS or FAIL, each with a pointer. Both comments exist, every row is PASS, every PASS has a pointer, and P0-X4 / P0-X5 are FAIL until the named R23 card exists. Absent comments: phase not exited. Nacho gets a summary heads-up only. This file is not that signature. | This file is not that signature. |

P0 has not exited. P0-X4 and P0-X5 are FAIL while R23's dynamic signature is unsigned (`coverage.md` line 86, `source-verification.md` R23). No named card has posted the signed close. P0-X10's comments do not exist.

## 3. P0.5 exit

PLAN.md:64: side-by-side visual review against the 19 reference screenshots, signed by the judge. Chat stays usable with Ops open. Full-screen toggle round-trips. Reduced motion passes. No duplicate chrome. Gold Night as the app-wide default passes visual QA on all core non-Ops Desktop routes, and other themes stay selectable (D5).

The card adds W10 isolation and locales. Both are rows below. All rows are required.

Section 7 is the blank phase-comment template. Copying it unfilled does not exit. A blank cell in the posted comment is FAIL.

| Id | Criterion | Artifact | Executable check | Exit note |
|---|---|---|---|---|
| P05-X1 | Judge-signed comparison with all 19 references | `reference-index.md` entries 01-19 (the reference half). Independent count rule: that file's lines 11-13, ids 01 through 19. Blockers B1 (line 243), B2 (line 247), B4 (line 255) are not entries. Current captures are not in this commit. | A hash of the reference file is not the comparison PLAN.md:64 requires. For each id 01-19 the phase comment has one row (section 7) with all of: id, SHA-256 of the reference (re-hash the Path, do not copy the line), path and SHA-256 of the paired current capture, route or context, viewport (WxH and DPR), SHA of the captured tree, side-by-side (pair or diff), Judge pass or fail, and a one-line reason. One missing field on any of the 19 is FAIL. A label with no current capture, or a PASS with no side-by-side, is FAIL. B1, B2, and B4 close only when a named card posts the close. This file does not name that card. Signing P05-X1 while those headings still say blocker, with no later card, is lenient and is not an exit. | PNGs are not in git. This commit does not produce the 19 captures. |
| P05-X2 | App-wide non-Ops theme QA | Phase comment rows for the five core routes. Independent route list: PLAN.md:64 core non-Ops Desktop routes, fixed here as `/`, Desktop settings, `/profiles`, `/command-center`, `/capabilities`. Code half only: `apps/desktop/src/themes/presets.ts:656` `DEFAULT_SKIN_NAME = 'gold-night'`. `gold-night-tokens.md:14` (`nous` at `:462`) is the stale citation. Do not copy it. | For each of the five routes the phase comment has capture path, capture SHA-256, viewport (WxH and DPR), effective skin, and visual Judge pass or fail with a one-line reason. A path with no visual result is FAIL. A route whose effective skin is not `gold-night` fails. The constant at `:656` is not visual QA. This commit does not edit `presets.ts` and does not attach screenshots. | Missing paths, or paths without a Judge result, = FAIL. Not a silent PASS. |
| P05-X3 | Other themes selectable | `apps/desktop/src/themes/presets.ts` `BUILTIN_THEMES` (lines 633-648) and `RETIRED_SKINS` (line 662). Independent requirement: PLAN.md:64 and SPEC D5 (other themes stay selectable, including System). `gold-night-tokens.md:15` cites `presets.ts:444-456`; that range is the older tree. Re-read `:633`. | Do not treat a key list as a menu result. Result field: one present/absent per built-in key in the phase comment, plus System selectable yes/no, plus whether the settings menu can select a non-default skin. On this tree the keys include `nous`, `github`, `catppuccin`, `everforest`, `solarized`, `nous-alt`, `classic`, `midnight`, `ember`, `mono`, `slate`, `cyberpunk`, besides `gold-night` and `gold-night-hi`. At least one non-`gold-night` built-in must remain. A menu that only offers `gold-night` fails. `RETIRED_SKINS` includes `gold` and must not include `gold-night`. A path to `presets.ts` with no per-key result is not a PASS. | Selectable is not "Gold Night failed to become the default". Both are required. `desktop-surface-audit.md:25` says the default is `nous`. That was P0-04's tree. It is not this SHA. |
| P05-X4 | Chat usability with Ops open | Observation in the phase comment. Independent requirement: PLAN.md:64. Citations that are not the result: `desktop-surface-audit.md` lines 72-77 and 87-91; `wireframes.md` line 43. | Result fields, all required: before session id, after session id, keystroke accepted yes/no, draft still present yes/no. With the Ops split open, the composer accepts one keystroke, the session id is unchanged, and the draft is still there. Full-screen must not call `session.new` and must not navigate to `/`. A wireframe sentence with any result field empty is FAIL. | Not claimed done. |
| P05-X5 | Split / full-screen round-trip | Observation in the phase comment. Independent requirement: PLAN.md:64 and D14. Citations that are not the result: `desktop-surface-audit.md` lines 87-91; `wireframes.md` section 3 (line 41); `keymap.md:196`. | Result fields, all required: hidden-set before, hidden-set after, session unchanged yes/no, draft unchanged yes/no, stream unchanged yes/no. ⤢ hides non-Ops panes as `hot-hidden` (keep-alive), not `park`, and does not unmount the composer. A second ⤢, or Esc when full-screen is the innermost layer, restores the same hidden set. A citation with any result field empty is FAIL. | Not claimed done. |
| P05-X6 | Reduced motion | Observation or a named test. Independent requirement: PLAN.md:64 and SPEC section 12.3. Citation that is not the result: `presence-motion.md` lines 188-208. | Result field: pass or fail for each of the six: rise has no translate, land and pop are off, presence pulse stops, orrery drift stops, text still streams, caret does not blink. Run under `prefers-reduced-motion: reduce` and under the status-bar Motion readout set to Reduced. System follows the OS query (line 199). Token names with any of the six empty are FAIL. | Not claimed done. |
| P05-X7 | W10 isolation | Observation in the phase comment. Independent requirement: PLAN.md:62 and SPEC W10 (section 12.5). Citations that are not the result: `wireframes.md` lines 307-321; per-flag W10 bullets in `policy-capabilities.md` (first at line 308). | Result fields, all required: failed section or node name, the one capability flag set false or the one forced empty, sibling that stayed rendered, sibling copy still its own. A whole-page error fails. A flag-contract citation with any result field empty is FAIL. | Not claimed done. The flag contract is not a running flag. |
| P05-X8 | Locales | Observation in the phase comment. Independent requirement: SPEC.md line 647 row R27 and `wireframes.md` lines 297-299 (W9 date format). | Result fields, both required: the `es-AR` visible string and the `en-US` visible string for the fixed instant `2026-10-12T18:00:00-03:00` on the Ops date control. They must differ. Neither may be that raw ISO timestamp. The screen must not grow a second date control. Theme and accent stay in Desktop settings (D5), not a second settings form (`wireframes.md` line 305). Either string empty is FAIL. | No locale table was frozen by an earlier card. This check is the exit check. Not claimed done. |
| P05-X9 | No duplicate chrome | Observation in the phase comment. Independent destination list: SPEC section 12.2 and row O9 (`/capabilities`, `/messaging`, `/webhooks`, `/cron`, `/profiles`, `/command-center`, `/agents`), not a rebuilt library. Contract table under test: `desktop-surface-audit.md` section 4 (line 116), lens table lines 120-133. Entry 02 freeze: do not add a second composer (`reference-index.md`). | Result field: one Judge pass or fail per lens row, naming the existing route. Judge confirms no second skills library, no second profile editor, no second composer, no second session list. A new route that repeats one of those destinations fails. The table with no per-lens result is not a PASS. | The table is the contract. It is not a passing UI audit. |

P0.5 has not exited. P05-X1 blockers B1, B2, and B4 are still open in `reference-index.md`. No named card has closed them. P05-X1 and P05-X2 have no filled section 7 rows in a phase comment. P05-X2 through P05-X9 have no passing evidence in this commit.

Phase signature, when it exists, is `JUDGE PHASE PASS P0.5` listing P05-X1 through P05-X9 with pointers, plus Sandhi `PHASE PASS` `object: phase-exit` `task_or_phase: P0.5` (automatic; no Nacho gate). Same leniency rule as P0-X10. Nacho gets a summary heads-up only. The section 7 template in this file is not that comment.

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

1. For each id P0-X1 through P0-X10 and P05-X1 through P05-X9, confirm the row names an independent source (SPEC, PLAN, or a file that is not the index under test) and a per-item result field. Zero empty cells in the frozen table. A non-empty cell that only re-reads the artifact's own index is not a pass of this step.
2. Counter-walk, on the text of the checks, not by editing the matrices: a route matrix that omitted `GET /api/ops/fleet` must FAIL P0-X1; a ledger that kept 20 headings with one verdict pending or blank must FAIL P0-X4; R23 unsigned must FAIL P0-X4 and P0-X5 until a named card posts the signed close; a capability flag with an empty W10 cell must FAIL P0-X8; 19 reference hashes with no current capture must FAIL P05-X1; a core-route path with no visual Judge result must FAIL P05-X2.
3. Confirm section 4 names A1, A2, A3, A4, A5, A6, A7, approvals, transactional writes, Office, Canvas, and Board as not implemented by a P0.5 claim.
4. Confirm this file does not contain `JUDGE PHASE PASS` as a signature of the current tree. The words may appear only as the comment title the exit still lacks. Confirm section 7 is unfilled.

Pair the walk in `review-loop.md` sections 8-9 with this list. The task verify is both: one PASS example, one rejected example, and this table complete.

## 7. Phase-comment templates (unfilled)

The phase Judge copies these tables into the phase comment and fills every cell. This section is the blank form. An unfilled cell, here or in the comment, is not a result. P0.5 has not exited.

P05-X1. Nineteen rows. Columns: id, reference SHA-256 (re-hash), current capture path, current capture SHA-256, route or context, viewport (WxH and DPR), tree SHA, side-by-side (pair or diff), Judge pass or fail, one-line reason.

| id | ref SHA-256 | current path | current SHA-256 | route / context | viewport | tree SHA | side-by-side | judge | reason |
|---|---|---|---|---|---|---|---|---|---|
| 01 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 02 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 03 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 04 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 05 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 06 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 07 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 08 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 09 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 10 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 11 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 12 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 13 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 14 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 15 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 16 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 17 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 18 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| 19 | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |

P05-X2. Five core routes. A path without a Judge result is FAIL.

| route | capture path | capture SHA-256 | viewport | effective skin | judge | reason |
|---|---|---|---|---|---|---|
| `/` | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| Desktop settings | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| `/profiles` | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| `/command-center` | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
| `/capabilities` | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) | (unfilled) |
