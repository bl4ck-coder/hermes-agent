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

SPEC section 12.6 says "230 reference features: Keep 82 · Adapt 134 · Cut 14. Kept (Keep+Adapt) = 93.9%". The counts match. 93.9% is 93.9130% rounded to one decimal. No disagreement on the paper counts.

Per site, exact, then SPEC's rounded line:

| Site | Keep | Adapt | Cut | Rows | Kept | SPEC line |
|---|---|---|---|---|---|---|
| Orbit | 34 | 46 | 4 | 84 | 80/84 = 0.952381 (95.2381%) | 34K/46A/4C (95% kept) |
| Outglow | 28 | 51 | 6 | 85 | 79/85 = 0.929412 (92.9412%) | 28K/51A/6C (93% kept) |
| Gr8r | 20 | 37 | 4 | 61 | 57/61 = 0.934426 (93.4426%) | 20K/37A/4C (93% kept) |

Site counts match SPEC. The percents are rounding, not a count disagreement. Outglow 92.9412% is 92.9% at one decimal and 93% at zero decimals. Gr8r 93.4426% is 93.4% at one decimal and 93% at zero decimals. Orbit 95.2381% is 95.2% at one decimal and 95% at zero decimals. SPEC's parenthetical percents are the zero-decimal figures. Recorded so a later pass does not "fix" 93% by changing a row.

SPEC's second figure: "85.2% with an already-verified source (20 Keep/Adapt rows still marked verify)". 216 - 20 = 196. 196/230 = 0.8521739130 (85.2174%), which rounds to 85.2%. The 20 ids are exactly the ledger set. That figure is the pre-verification paper number. It is not the post-P0 number.

## 2. Rule for a failed verify

A failed source becomes a Cut of that source, reason kept (`source-verification.md`).

Full-row flip (the row's cited feature has no surviving source): Adapt → Cut.

- G70 author avatar and relative Updated. List route has neither field.
- G82 Add all. Hub has no bundles. SPEC already said cut if none.
- R34 project templates. Only citation was the failed template catalog.
- G10 starter packs + Add all. Not in the 20-id verify set. Same missing bundle resource as G82. Recorded in the ledger crosswalk, not as a 21st `###` heading. No surviving source on that citation. Single-skill install is G72, not a pack.

Partial cut (the row stays Keep or Adapt; a sub-feature is cut and the reason is kept):

- O16 Adapt, Orbit. Cut the template mapping. Cron trigger stays.
- O60 Keep, Orbit. Cut n/m. Step key stays.
- O66 Adapt, Orbit. Cut the kanban join. Known-task chip stays.
- O67 Adapt, Orbit. Cut `TASK-NNN`. Real id pattern stays.
- G28 Adapt, Outglow. Cut the filter. Subscription list stays.
- G61 Adapt, Outglow. Cut kanban templates. Cron blueprints stay.
- G72 Adapt, Outglow. Not in the 20-id verify set. Cut starter-pack metadata and install-count display. Browse library stays (`EmbeddedHubPicker` plus the flat hub list). Flipping the row would hide that source.

Not flipped, not partial cuts: O41, O56, O58, O64, G27 (field corrected, not failed), G68, G84, R4, R23 (documentary verified; dynamic signature pending is a blocker, not a Cut), R42 (reorder disabled as the row already required), R57.

R23 is not counted as verified-implemented. It is counted as still Adapt, because the documentary contract passed and the row was not cut. P0 exit stays blocked. See section 4.

## 3. After full-row flips

Paper was Keep 82, Adapt 134, Cut 14, kept 216/230. r1 flipped G70, G82, R34 and stopped at 213/230. That arithmetic matched those three flips. It is not the final total: G10 was still Adapt with no source. r2 flips G10 as well. Do not publish 213/230.

| Disposition | Count | Delta vs paper |
|---|---|---|
| Keep | 82 | 0 |
| Adapt | 130 | -4 |
| Cut | 18 | +4 |
| Kept | 212 / 230 = 0.9217391304 (92.1739%) | -4 rows, -1.7391 points vs 93.9130% |

The four flips are G70, G82, R34, G10. G72 stays Adapt, so it is not in this delta.

Disagreement with SPEC's 93.9%: four Adapt rows failed verification and are Cuts. Do not publish 93.9% as the post-P0 kept rate. Do not force the r1 figure 213/230 (0.9260869565) back into this table to match the previous ledger.

Disagreement with SPEC's 85.2%: that number treated all 20 verify rows as not yet verified. After this ledger, 17 of those 20 stay Keep or Adapt and 3 become Cut, and one outside-set Adapt (G10) also becomes Cut. Post-P0 kept rate is 92.1739%, not 85.2% and not 92.6087%.

Per site after the four flips:

| Site | Keep | Adapt | Cut | Kept | vs SPEC rounded |
|---|---|---|---|---|---|
| Orbit | 34 | 46 | 4 | 80/84 = 95.2381% | unchanged |
| Outglow | 28 | 48 | 9 | 76/85 = 89.4118% | was 93% (G70, G82, G10) |
| Gr8r | 20 | 36 | 5 | 56/61 = 91.8033% | was 93% (R34) |

## 4. What this number is not

Sensitivity, not the chosen total: if the seven partial-cut rows were also flipped to Cut, the matrix would be Keep 81, Adapt 124, Cut 25, kept 205/230 = 0.8913043478. That is not the disposition used here. Those rows still have a verified remaining behavior. Flipping them would hide the surviving source. The chosen total is section 3.

R23 dynamic signature is unsigned (onboarding veil, no PTY+Ops). That does not move R23 to Cut and does not move it to Keep-as-implemented. P0 exit is blocked until that signature exists, or until a later card records a different blocker. O64 is a code PASS from `nodePty.spawn` and is already in the Adapt count.

Section 12.7's original 14 Cuts stay Cuts, with their original reasons. Verification did not revive any of them. G64's source cell says "No source" and the disposition is already Cut; it is not a 21st verify row.

D7 is not a coverage row. Test-run start stays uncapped and confirmation-free (`action-contracts.md` section 3.5). No row was cut to invent a cap.

## 5. Recompute

Independent check, from a checkout that has SPEC.md. Script that produced these figures: scratch `p0-02-r2-recompute.py` (not committed; this hop's deliverable is the three docs).

1. Parse section 12.8 as in the header. Expect 230, Keep 82, Adapt 134, Cut 14.
2. Flip G70, G82, R34, and G10 to Cut. Do not flip G72.
3. Expect Keep 82, Adapt 130, Cut 18, kept 212/230 = 0.9217391304. Not 213/230.
4. Confirm the ledger file's `### <id>` headings are exactly the 20 names in SPEC section 12.6, each once, in that order. G10 and G72 must not be headings.
5. Confirm partial cuts, including G72, are listed with reasons and did not change the row disposition.
6. r3 does not flip a disposition. G12 and G20 stay verified contracts. R46 Undo stays a named P1 gap, not a Cut. Kept stays 212/230 = 0.9217391304. Do not recompute a new total from the Undo rule.
