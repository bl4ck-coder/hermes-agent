# Ops panel review loop (P0-07)

Status: documentation only. Traces to D15. No product rows. No kanban tasks, no merge, no review tooling.
Branch: `ops/P0-07` from `feat/ops-panel` at `a8c434eca5e`.
SPEC: vault `01-Projects/Hermes/desktop-ops-panel/SPEC.md` v4, decision D15 (line 46, rev. 19:47 ART).
PLAN: vault `01-Projects/Hermes/desktop-ops-panel/PLAN.md` (crew table lines 5-13, review loop lines 15-34). Amended 2026-10-13.
This file freezes comment packets, round accounting, leniency, and the stop rule. It does not install a script, a plugin, a CLI, or a kanban schema. The blocks below are comment text a person copies. They are not a runner.

P0 and P0.5 exit gates are `phase-acceptance.md` in this directory. This file does not sign either phase.

## 1. What this task is not

- Not a product row. SPEC rows: none.
- Not a kanban creator. Do not open cards from this file.
- Not a merge. Do not merge `ops/<key>` into `feat/ops-panel` from a build card. Do not push. Do not touch `main` or `origin`.
- Not review tooling. No binary, no committed checker, no plugin that posts these packets.
- The build card's own `SELF-REVIEW` and `HANDOFF` comments are the handoff the build body already requires. They are not a second review system and they are not a license to post anything else.

Model policy P2 applies to every Hermes profile in the crew. Allowed pairs only: `anthropic` + `claude-*` (direct; no OpenRouter, Bedrock, or other proxy), `openai-codex` or `openai` + `gpt-6.1-sol` / `-900k` / `-pro`, `xai-oauth` or `xai` + `grok-4.7`. `grok-4.6` is not a crew model.

## 2. Source tension (recorded, not hidden)

Two locked sentences disagree. This file does not edit SPEC or PLAN.

| Source | Stop / crew sentence |
|---|---|
| SPEC.md:46, D15 rev. 19:47 ART | planner (Sol) → meta-opus plan review → builder (Grok 4.7) → judge (Sol) → meta-opus reviews build + verdict → sandhi auto-merges into `feat/ops-panel` on JUDGE PASS + META PASS. Escalate to Nacho only after 3 failed rounds. |
| PLAN.md:9 and PLAN.md:24, amended 2026-10-13 | Meta seat is Sandhi (Grok Bot), external. `meta-opus` is unused. Sandhi auto-merges on JUDGE PASS + META PASS (PLAN.md:32). Nacho receives the 3-round escalation as a heads-up; push to `origin` stays locked (PLAN.md:13, PLAN.md:34). |
| Rule 2026-10-13 13:00 ART (Nacho) | Merging is free for every agent. Stop at meta PASS plus Judge PASS; the merge into `feat/ops-panel` and the push to `fork` follow automatically, with no human approval. Push to `origin` stays locked (`no_push`). |

Walker used below: SPEC.md:46 and PLAN.md:32 as amended by the 2026-10-13 rule. Dropping the meta-opus seat would be a PASS without the evidence the loop names. That is lenient (section 6).

The 2026-10-13 rule resolves the tension: JUDGE PASS + META PASS is sufficient. Any agent merges into `feat/ops-panel` and pushes to `fork` with no human approval.

Current holder of the meta-opus seat: the declared Grok fallback is active, because PLAN.md:9 recorded Anthropic out of the loop on 2026-10-13. The seat name in every packet stays `meta-opus`. The holder line is `grok-fallback`. The fallback person is Sandhi (Grok Bot), external, not a Hermes profile. The `meta-opus` profile is kept and unused. A Hermes profile that fills in must be `xai-oauth` / `grok-4.7`. It must not be a non-allowlisted model.

## 3. Crew (D15, preserved)

| Seat | Who | Model | Duty under this freeze |
|---|---|---|---|
| planner | Sol (`planner`, `openai-codex` / `gpt-6.1-sol`) | P2 | Breaks the phase into tasks tied to SPEC row IDs. Self-reviews before handoff. |
| meta-opus | Opus, Anthropic direct, with declared Grok fallback | P2 when a Hermes profile holds it | Plan review, then build + judge-verdict review. Grades leniency. Sends one delta packet. Never merges. Never builds. |
| builder | `builder`, `xai-oauth` / `grok-4.7` | P2 | Implements in a worktree outside the install (`ops/<key>` from `feat/ops-panel`). The review surface is that branch (the card's PR). Never commits to `main`. Never pushes. |
| Judge | Sol (`judge`, `openai-codex` / `gpt-6.1-sol`) | P2 | PASS or FAIL per acceptance item, each with evidence. Self-reviews the verdict for leniency. |
| Nacho | Nacho | — | Not a merge gate and not a phase-exit gate. Receives the round-3 escalation and the phase-exit summary as heads-ups only. Push to `origin` stays locked (`no_push`). |

Any agent (integrator `sandhi`, Hermes profile `grok-4.7`, by default) merges into `feat/ops-panel` freely once the stop set in section 5 holds, then pushes to `fork`. No human approval. This matches SPEC.md:46.

Every role self-reviews before handoff. The self-review comment starts with `SELF-REVIEW` and lists each item as pass or fail with a pointer.

## 4. Rounds

A recursive round is one pass that can return a delta. Budget is 3. `rounds_used` starts at 0.

1. Opening a round increments `rounds_used` by 1 before any packet in that round. If the increment would pass 3, do not open the round. Escalate (section 5).
2. Plan review sits inside the round. It is not a free pass before the budget, and it is not a fourth round after the budget. That is how plan review counts toward the three.
3. Round 1 always includes plan review, before the builder runs.
4. A later round includes a new plan review only when the incoming delta `target` is `planner`, or the plan's row IDs changed. Otherwise the round cites the prior `PLAN REVIEW PASS` (task, row IDs, comment pointer) and does not spend an extra round to do it.
5. Order inside a round that builds: plan review (or the citation) → builder → Judge → meta-opus build/verdict review → automatic merge, only if Judge and meta both passed.
6. A plan-review FAIL closes the round as failed. The builder does not run. The delta target is `planner`.
7. A `JUDGE FAIL` or a `META IMPROVE` closes the round as failed.
8. One open delta per failed round. Do not stack a second delta in the same round.

`plan_review: cited-r1` still counts. The citation proves the plan review was not dropped. The round number still went up. A walker who adds a fourth build after three citations has left this file.

## 5. Stop and escalation

Stop only when the open round has all three:

- plan review PASS, or a cited prior plan-review PASS whose row IDs still match
- `JUDGE PASS` for that round
- `META PASS` for that round (seat `meta-opus`, holder `opus` or `grok-fallback`)

On these three, any agent merges into `feat/ops-panel` and pushes to `fork`. No human approval (Rule 2026-10-13 13:00 ART (Nacho)). Anything else is not a stop.

If the round closed failed and `rounds_used` < 3, the next round opens with the one delta packet. No other new work starts.

If the round closed failed and `rounds_used` == 3, escalate to Nacho as a heads-up (not a merge gate). Do not open round 4. The escalation packet carries every still-open delta and every leniency grade from the three rounds (a plan-review-only round records `n/a`).

Phase exit is automatic once every task in the phase has merged with JUDGE PASS + META PASS and the phase checks pass: Judge posts `JUDGE PHASE PASS`, Sandhi posts `PHASE PASS` with `object: phase-exit` (`phase-acceptance.md`). Nacho gets a summary heads-up only (Rule 2026-10-13 13:31 ART). A task stop is not a phase exit. A phase exit is not a task merge and never blocks one.

## 6. Leniency

The meta-opus seat grades the Judge verdict 0–3 on every round that has a Judge packet. Plan-review-only rounds are `n/a`. They do not count toward the three-task trigger.

| Grade | Meaning |
|---|---|
| 0 | Every Judge PASS item has a file:line or a command-output pointer. No PASS covers a known gap. |
| 1 | Every PASS has a pointer. One pointer is indirect (a prior SHA, a parent handoff) and was re-read, or a non-blocking nit was noted and not failed. |
| 2 | At least one PASS has no evidence pointer, or a known gap was marked PASS. PASS without evidence is this grade or higher. It is lenient. |
| 3 | Two or more PASSes lack evidence, or a PASS contradicts the evidence it cites. |

Grade ≥ 2 on three tasks in the same phase (P0, or P0.5) triggers Nacho's judge-prompt review. The marker is a comment `JUDGE-PROMPT REVIEW` naming the three tasks, the three grades, and the judge prompt those tasks used. The trigger does not by itself fail the third task, does not reset `rounds_used`, and does not replace a `JUDGE FAIL`.

## 7. Comment templates

Required fields are in the block. On a PASS, write `none` for defect and exact change. Do not omit the field. A delta packet that lacks row IDs, defect, exact change, verification, evidence pointers, or leniency grade is not a delta. The next round does not open on it.

### 7.1 Plan review

```
PLAN REVIEW r{n} {PASS|FAIL}
task: {key}
rows: {ids or none}
seat: meta-opus
holder: opus | grok-fallback
plan: {path or sha}
defect: {none or one sentence}
exact_change: {none or the edit}
verification: {how a later walker re-checks}
evidence: {pointers}
leniency: n/a
rounds_used: {n}
```

### 7.2 Judge PASS / FAIL

```
JUDGE {PASS|FAIL} r{n}
task: {key}
rows: {ids or none}
seat: judge
holder: sol
items:
- {acceptance item}: {PASS|FAIL} evidence: {file:line or command output}
leniency_self_check: {yes|no} {one line: does every PASS have evidence?}
rounds_used: {n}
```

Overall PASS only if every item is PASS. One FAIL makes the packet `JUDGE FAIL`. A PASS item with no evidence pointer is still written, and the self-check is `no`. That packet is lenient even if the overall word is FAIL (section 6, grade ≥ 2).

### 7.3 Meta-opus build and verdict review

```
META {PASS|IMPROVE} r{n}
task: {key}
rows: {ids or none}
seat: meta-opus
holder: opus | grok-fallback
build_sha: {sha}
judge: {comment pointer}
leniency: {0|1|2|3}
leniency_reason: {one sentence}
defect: {none or one sentence}
exact_change: {none or the edit}
verification: {how a later walker re-checks}
evidence: {pointers}
rounds_used: {n}
```

`META PASS` requires leniency 0 or 1, a Judge PASS in the same round, and no open defect. Leniency 2 or 3 is not a PASS. Write `META IMPROVE` and one delta.

### 7.4 Delta packet

```
DELTA r{n}
target: planner | builder | judge
rows: {ids or none}
defect: {one sentence}
exact_change: {the edit, not a theme}
verification: {the check that shows the edit landed}
evidence: {pointers}
leniency: {0|1|2|3|n/a}
rounds_used: {n}
next_round: {n+1 or ESCALATE}
```

One target. One defect sentence. `exact_change` is a numbered list, and every item is owned by that target. A second defect sentence, or a second target, is a second round, and the second waits. Leniency grade is not a second defect: a grade ≥ 2 records that the Judge packet was lenient; it does not by itself open another delta. A repair of the Judge packet (a PASS with no pointer, or a PASS that contradicts the evidence it cites) has `target: judge`, never `builder`. A repair of committed builder text has `target: builder`, never `judge`.

### 7.5 Merge record and automatic phase exit

```
MERGED r{n}
object: task-merge
task: {key}
merged_by: {agent}
sha: {merge sha} · pushed fork {ok|failed}
evidence: {JUDGE PASS pointer}; {META PASS pointer}
```

The merge record is posted by whichever agent merged. It needs no human approval.

```
PHASE PASS
object: phase-exit
task_or_phase: {P0 or P0.5}
posted_by: sandhi
evidence: {JUDGE PHASE PASS pointer}; {phase check pointers}
defect: {none or one sentence}
summary_to_nacho: {heads-up posted}
```

Phase exit is automatic (Rule 2026-10-13 13:31 ART): Judge validates the phase checks and posts `JUDGE PHASE PASS`; Sandhi posts `PHASE PASS` with `object: phase-exit`. Nacho receives a summary heads-up only — no `NACHO GATE`, no sign-off. `object: phase-exit` does not stop a task, does not merge a branch, and never gates a merge.

### 7.6 Escalation

```
ESCALATE r3
task: {key}
rounds_used: 3
open_deltas:
- r{n} target: {who} defect: {sentence} evidence: {pointer}
grades: r1={0|1|2|3|n/a} r2={0|1|2|3|n/a} r3={0|1|2|3|n/a}
```

No round 4. No merge (nothing passed). The escalation is a heads-up to Nacho, not an approval request.

## 8. Example PASS (EX-PASS)

Fictional task. Not a kanban card. Do not create one. Rows: none. Docs-only. Holder of meta-opus: `grok-fallback`.

Round 1 opens. `rounds_used` becomes 1. Plan review is inside this round, so it counts. It does not add a second increment.

```
PLAN REVIEW r1 PASS
task: EX-PASS
rows: none
seat: meta-opus
holder: grok-fallback
plan: PLAN.md task text, deliverable review-loop.md
defect: none
exact_change: none
verification: walker reads this packet; rows stay none
evidence: PLAN.md:15-32
leniency: n/a
rounds_used: 1
```

Builder commits example sha `EX-PASS-r1` (not a git object). Judge:

```
JUDGE PASS r1
task: EX-PASS
rows: none
seat: judge
holder: sol
items:
- docs only: PASS evidence: git diff --stat shows two markdown files
- templates: PASS evidence: review-loop.md section 7
leniency_self_check: yes every PASS has a pointer
rounds_used: 1
```

Meta-opus build/verdict review:

```
META PASS r1
task: EX-PASS
rows: none
seat: meta-opus
holder: grok-fallback
build_sha: EX-PASS-r1
judge: JUDGE PASS r1 on this example
leniency: 0
leniency_reason: both PASS items cite a pointer; no gap marked PASS
defect: none
exact_change: none
verification: re-read the two item lines
evidence: the JUDGE PASS block above
rounds_used: 1
```

Merge (automatic, no human approval):

```
MERGED r1
object: task-merge
task: EX-PASS
merged_by: sandhi
sha: EX-PASS-merge · pushed fork ok
evidence: JUDGE PASS r1; META PASS r1
```

Stop set is complete in round 1. `stopped=true`. `rounds_used` stays 1. No delta. No round 2. No escalation. Plan review counted: it was the first packet of round 1, not a round 0.

A walker who waits for a human approval after META PASS has left section 5. A walker who increments `rounds_used` once per packet (plan, judge, meta, merge) and calls that four rounds has left section 4.

## 9. Example rejected (EX-FAIL)

Fictional task. Not a kanban card. Do not create one. Rows: none. Same holder.

### Round 1

Opens. `rounds_used` = 1. Plan review PASS, same shape as EX-PASS, `task: EX-FAIL`, evidence `PLAN.md:15-32`. Builder commits example sha `EX-FAIL-r1`.

Judge marks one item FAIL and one item PASS. The PASS item has no pointer. Overall packet is FAIL. Self-check is `no`.

```
JUDGE FAIL r1
task: EX-FAIL
rows: none
seat: judge
holder: sol
items:
- templates present: PASS evidence: (none)
- stop rule followed: FAIL evidence: section 5 stop list omits META PASS
leniency_self_check: no the PASS item has no pointer
rounds_used: 1
```

Meta grades that verdict lenient and does not pass the build. The grade is not a second defect. The one open delta is the builder-owned stop-set gap. The missing pointer is not assigned to the builder.

```
META IMPROVE r1
task: EX-FAIL
rows: none
seat: meta-opus
holder: grok-fallback
build_sha: EX-FAIL-r1
judge: JUDGE FAIL r1
leniency: 2
leniency_reason: PASS without evidence on "templates present" (section 6, grade 2). The grade records the lenient item. It is not a builder edit.
defect: stop set incomplete; section 5 omits META PASS
exact_change: 1. add META PASS for that round to the section 5 stop list
verification: walker re-reads section 5; three bullets; the third is META PASS
evidence: JUDGE FAIL r1 stop-rule item
rounds_used: 1
```

```
DELTA r1
target: builder
rows: none
defect: stop set incomplete; section 5 omits META PASS
exact_change: 1. add META PASS for that round to the section 5 stop list
verification: walker re-reads section 5; three bullets; the third is META PASS
evidence: JUDGE FAIL r1 stop-rule item
leniency: 2
rounds_used: 1
next_round: 2
```

The missing pointer is a Judge-owned repair. It is not in this delta. A packet that put "give the PASS item a file:line" on `target: builder` would violate section 7.4. This round already has its one open delta, so that repair waits. It is not dropped as a grade: leniency stays 2.

Round 1 closes failed. No merge. Plan review counted inside round 1.

### Round 2

Opens. `rounds_used` = 2. Plan row IDs did not change and the delta target is `builder`, so plan review is not repeated. It is cited: `PLAN REVIEW r1 PASS`, task EX-FAIL, rows none. The citation is not a new round. Builder commits example sha `EX-FAIL-r2`. The one exact change was not applied. Section 5 as committed in EX-FAIL-r2 still has two stop bullets. The third, `META PASS`, is absent.

```
JUDGE FAIL r2
task: EX-FAIL
rows: none
seat: judge
holder: sol
items:
- templates present: PASS evidence: review-loop.md section 7
- META PASS in the stop set: FAIL evidence: review-loop.md section 5 committed in EX-FAIL-r2 has two stop bullets; the third (META PASS) is absent
leniency_self_check: yes the FAIL cites the missing third bullet; the PASS cites section 7; no PASS covers the known gap
rounds_used: 2
```

Section 6 applies literally. Grade 0: every PASS has a pointer, and no PASS covers the known gap, because the stop-set item is FAIL and the evidence it cites is the missing bullet. A PASS on that stop-set item would be grade 3 (section 6: a PASS that contradicts the evidence it cites). That PASS is not in this packet.

```
META IMPROVE r2
task: EX-FAIL
rows: none
seat: meta-opus
holder: grok-fallback
build_sha: EX-FAIL-r2
judge: JUDGE FAIL r2
leniency: 0
leniency_reason: Judge failed the stop-set item; section 5 in EX-FAIL-r2 has no third bullet; the other PASS cites section 7; no PASS covers the gap
defect: section 5 committed in EX-FAIL-r2 still has two stop bullets
exact_change: 1. section 5 stop list must include META PASS as the third bullet
verification: read section 5; three bullets; the third is META PASS
evidence: JUDGE FAIL r2 stop-set item; section 5 as committed in EX-FAIL-r2
rounds_used: 2
```

```
DELTA r2
target: builder
rows: none
defect: section 5 committed in EX-FAIL-r2 still has two stop bullets
exact_change: 1. section 5 stop list must include META PASS as the third bullet
verification: read section 5; three bullets; the third is META PASS
evidence: JUDGE FAIL r2 stop-set item
leniency: 0
rounds_used: 2
next_round: 3
```

Round 2 closes failed. No merge.

### Round 3

Opens. `rounds_used` = 3. Plan review cited again (`PLAN REVIEW r1 PASS`). Not a fourth round. Builder commits example sha `EX-FAIL-r3`. Section 5 now has the three-part stop.

```
JUDGE PASS r3
task: EX-FAIL
rows: none
seat: judge
holder: sol
items:
- three-part stop: PASS evidence: review-loop.md section 5
leniency_self_check: yes
rounds_used: 3
```

```
META IMPROVE r3
task: EX-FAIL
rows: none
seat: meta-opus
holder: grok-fallback
build_sha: EX-FAIL-r3
judge: JUDGE PASS r3
leniency: 0
leniency_reason: the only PASS item cites section 5
defect: wording of the META PASS bullet is ambiguous about phase exit
exact_change: 1. state that META PASS stops a task, not a phase
verification: read section 5
evidence: JUDGE PASS r3; section 5 as committed in EX-FAIL-r3
rounds_used: 3
```

Meta does not pass. No merge.

Stop set is incomplete (META IMPROVE). `rounds_used` is 3. Escalate to Nacho as a heads-up. Do not open round 4.

```
ESCALATE r3
task: EX-FAIL
rounds_used: 3
open_deltas:
- r3 target: builder defect: wording of the META PASS bullet is ambiguous about phase exit evidence: META IMPROVE r3
grades: r1=2 r2=0 r3=0
```

### Accounting a walker must reproduce

| Check | EX-PASS | EX-FAIL |
|---|---|---|
| Plan review counted inside a round, not beside the budget | yes, round 1 | yes, round 1; rounds 2 and 3 cite it |
| `rounds_used` at the end | 1 | 3 |
| Stop (and free merge) only after meta PASS + Judge PASS, no human approval | yes | no (META IMPROVE r3) |
| Escalation at the limit, with open deltas and grades | no | yes, one open delta, grades 2 / 0 / 0 |
| r2 grade is a correct FAIL, not a false PASS graded 0 | n/a | yes, JUDGE FAIL r2, leniency 0; section 6 grade 3 would apply only if that stop-set item were PASS |
| DELTA r1 is one target and one defect; Judge repair is not on builder | n/a | yes, target builder, one defect sentence, numbered exact_change; the pointer repair is not in exact_change |
| Round 4 opened | no | no |

If a walker gives EX-FAIL a fourth round because plan review was "extra", the walk fails. If a walker holds the EX-PASS merge for a human approval after META PASS, the walk fails. If a walker merges EX-FAIL at r3, the walk fails.

## 10. Walk ledger

Machine-readable twin of sections 8 and 9. If this block and the prose disagree, the prose wins and this block is wrong; fix the block before handoff. Do not treat example shas as git objects.

```yaml
walk_ledger:
  - id: EX-PASS
    rounds_used: 1
    escalated: false
    stopped: true
    rounds:
      - n: 1
        plan_review: PASS
        judge: PASS
        meta: PASS
        leniency: 0
        merged: true
        closed: stop
  - id: EX-FAIL
    rounds_used: 3
    escalated: true
    stopped: false
    open_deltas: 1
    grades: [2, 0, 0]
    rounds:
      - n: 1
        plan_review: PASS
        judge: FAIL
        meta: IMPROVE
        leniency: 2
        merged: false
        closed: fail
        delta_target: builder
      - n: 2
        plan_review: cited-r1
        judge: FAIL
        meta: IMPROVE
        leniency: 0
        merged: false
        closed: fail
        delta_target: builder
      - n: 3
        plan_review: cited-r1
        judge: PASS
        meta: IMPROVE
        leniency: 0
        merged: false
        closed: fail
```

## 11. Re-run the verify

From a checkout that has this file and `phase-acceptance.md`:

1. Walk EX-PASS (section 8). Confirm `rounds_used` ends at 1, the three stop packets and the MERGED record are present, no `ESCALATE`, no round 2.
2. Walk EX-FAIL (section 9). Confirm plan review is inside round 1, rounds 2 and 3 cite it, `rounds_used` ends at 3, round 2 is `JUDGE FAIL` (the stop-set item fails because section 5 in EX-FAIL-r2 has no third bullet) with leniency 0, not a `JUDGE PASS` graded 0, r3 is `META IMPROVE`, the escalation lists grades `2 / 0 / 0` and one open delta, no round 4. Section 7.4 and DELTA r1 name one builder defect. The missing pointer is a grade, not a builder exact_change.
3. Open `phase-acceptance.md`. Confirm every P0 row and every P0.5 row names an independent source and a per-item result field, not only a non-empty cell. Confirm the negative list names A1–A7, approvals, transactional writes, Office, Canvas, and Board as not implemented by a P0.5 signature.

This file does not claim that walk was signed by Judge or by meta-opus. Their signatures are comments on the build card, after this handoff.
