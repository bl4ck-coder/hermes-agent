# Ops panel coverage (P0-02)

Status: documentation only. Recomputed from SPEC section 12.8 as written, then from the ledger dispositions in `source-verification.md`. SPEC is not edited. The paper totals are not normalized back to SPEC's sentence.

Parser: split each section 12.8 row on `|`, take column 5, strip `*`. That is the disposition. Bold `**Cut**` counts as Cut. Ran against `01-Projects/Hermes/desktop-ops-panel/SPEC.md` (692 lines, matrix lines 452-681).

## 1. Paper matrix (no verification applied)

230 ids. No duplicates. No id outside `[OGR]<digits>`.

| Disposition | Count |
|---|---|
| Keep | 82 |
| Adapt | 134 |
| Cut | 14 |
| Kept (Keep+Adapt) | 216 / 230 = 0.9391304348 (93.9130%) |

SPEC section 12.6 says "230 reference features: Keep 82 · Adapt 134 · Cut 14. Kept (Keep+Adapt) = 93.9%". The counts match. 93.9% is the one-decimal rounding of 93.9130%. No disagreement on the paper counts.

Per site, exact, then SPEC's rounded line:

| Site | Keep | Adapt | Cut | Rows | Kept | SPEC line |
|---|---|---|---|---|---|---|
| Orbit | 34 | 46 | 4 | 84 | 80/84 = 0.952381 (95.2381%) | 34K/46A/4C (95% kept) |
| Outglow | 28 | 51 | 6 | 85 | 79/85 = 0.929412 (92.9412%) | 28K/51A/6C (93% kept) |
| Gr8r | 20 | 37 | 4 | 61 | 57/61 = 0.934426 (93.4426%) | 20K/37A/4C (93% kept) |

Site counts match SPEC. The percents are rounding. Outglow 92.9412% rounds to 93% at one decimal. Gr8r 93.4426% rounds to 93%. Orbit 95.2381% rounds to 95%. Not a count disagreement. Recorded so a later pass does not "fix" 93% by changing a row.

SPEC's second figure: "85.2% with an already-verified source (20 Keep/Adapt rows still marked verify)". 216 - 20 = 196. 196/230 = 0.8521739130 (85.2174%), which rounds to 85.2%. The 20 ids are exactly the ledger set. That figure is the pre-verification paper number. It is not the post-P0 number.

## 2. Rule for a failed verify

A failed source becomes a Cut of that source, reason kept (`source-verification.md`).

Full-row flip (the row's cited feature has no surviving source): Adapt → Cut.

- G70 author avatar and relative Updated. List route has neither field.
- G82 Add all. Hub has no bundles. SPEC already said cut if none.
- R34 project templates. Only citation was the failed template catalog.

Partial cut (the row stays Keep or Adapt; a sub-feature is cut and the reason is kept):

- O16 Adapt, Orbit. Cut the template mapping. Cron trigger stays.
- O60 Keep, Orbit. Cut n/m. Step key stays.
- O66 Adapt, Orbit. Cut the kanban join. Known-task chip stays.
- O67 Adapt, Orbit. Cut `TASK-NNN`. Real id pattern stays.
- G28 Adapt, Outglow. Cut the filter. Subscription list stays.
- G61 Adapt, Outglow. Cut kanban templates. Cron blueprints stay.

Not flipped, not partial cuts: O41, O56, O58, O64, G27 (field corrected, not failed), G68, G84, R4, R23 (documentary verified; dynamic signature pending is a blocker, not a Cut), R42 (reorder disabled as the row already required), R57.

R23 is not counted as verified-implemented. It is counted as still Adapt, because the documentary contract passed and the row was not cut. P0 exit stays blocked. See section 4.

## 3. After full-row flips

| Disposition | Count | Delta vs paper |
|---|---|---|
| Keep | 82 | 0 |
| Adapt | 131 | -3 |
| Cut | 17 | +3 |
| Kept | 213 / 230 = 0.9260869565 (92.6087%) | -3 rows, -1.3043 points vs 93.9130% |

Disagreement with SPEC's 93.9%: three Adapt rows failed verification and are Cuts. Do not publish 93.9% as the post-P0 kept rate.

Disagreement with SPEC's 85.2%: that number treated all 20 verify rows as not yet verified. After this ledger, 17 of those 20 stay Keep or Adapt and 3 become Cut. Post-P0 kept rate is 92.6087%, not 85.2%. Do not republish 85.2% as if the verify set were still open, and do not add the 20 back into Kept to restore 93.9%.

Per site after the three flips:

| Site | Keep | Adapt | Cut | Kept | vs SPEC rounded |
|---|---|---|---|---|---|
| Orbit | 34 | 46 | 4 | 80/84 = 95.2381% | unchanged |
| Outglow | 28 | 49 | 8 | 77/85 = 90.5882% | was 93% (G70, G82) |
| Gr8r | 20 | 36 | 5 | 56/61 = 91.8033% | was 93% (R34) |

## 4. What this number is not

Sensitivity, not the chosen total: if the six partial-cut rows were also flipped to Cut, the matrix would be Keep 81, Adapt 126, Cut 23, kept 207/230 = 0.9000000000. That is not the disposition used here. Those rows still have a verified remaining behavior. Flipping them would hide the surviving source. The chosen total is section 3.

R23 dynamic signature is unsigned (onboarding veil, no PTY+Ops). That does not move R23 to Cut and does not move it to Keep-as-implemented. P0 exit is blocked until that signature exists, or until a later card records a different blocker. O64 is a code PASS from `nodePty.spawn` and is already in the Adapt count.

Section 12.7's original 14 Cuts stay Cuts, with their original reasons. Verification did not revive any of them. G64's source cell says "No source" and the disposition is already Cut; it is not a 21st verify row.

D7 is not a coverage row. Test-run start stays uncapped and confirmation-free (`action-contracts.md` section 3.5). No row was cut to invent a cap.

## 5. Recompute

Independent check, from a checkout that has SPEC.md:

1. Parse section 12.8 as in the header. Expect 230, Keep 82, Adapt 134, Cut 14.
2. Flip only G70, G82, R34 to Cut.
3. Expect Keep 82, Adapt 131, Cut 17, kept 213/230.
4. Confirm the ledger file's id list is exactly the 20 names in SPEC section 12.6, each once.
5. Confirm partial cuts are listed with reasons and did not change the row disposition.

Scratch script that produced section 1 and section 3: not committed. The inputs are SPEC.md and the three ids above. A judge does not need the script.
