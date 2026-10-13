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
| PLAN.md:9 and PLAN.md:24, amended 2026-10-13 | Meta seat is Sandhi (Grok Bot), external. `meta-opus` is unused. Sandhi auto-merges on JUDGE PASS + META PASS (PLAN.md:32). Nacho is the 3-round escalation and the upstream/`main` signer (PLAN.md:13, PLAN.md:34). |
| This card's acceptance | Preserve meta-opus Opus with a declared Grok fallback. Stop only at meta PASS plus Judge PASS followed by Nacho's gate. Nacho approves every merge and every phase exit. |

Walker used below: the card acceptance. Reason: P0-07's verify is a walk of that sentence. Dropping Nacho's gate, or dropping the meta-opus seat, would be a PASS without the evidence the acceptance named. That is lenient (section 6).

What the walker does **not** do: it does not restore a pre-19:47 SPEC. The 19:47 sentence stays quoted. A later planner delta may put sandhi auto-merge back into this file and into SPEC together. Until that delta exists, a merge that treats JUDGE PASS + META PASS as sufficient, with no `NACHO GATE PASS`, is not a stop under this freeze.

Current holder of the meta-opus seat: the declared Grok fallback is active, because PLAN.md:9 recorded Anthropic out of the loop on 2026-10-13. The seat name in every packet stays `meta-opus`. The holder line is `grok-fallback`. The fallback person is Sandhi (Grok Bot), external, not a Hermes profile. The `meta-opus` profile is kept and unused. A Hermes profile that fills in must be `xai-oauth` / `grok-4.7`. It must not be a non-allowlisted model.

## 3. Crew (D15, preserved)

| Seat | Who | Model | Duty under this freeze |
|---|---|---|---|
| planner | Sol (`planner`, `openai-codex` / `gpt-6.1-sol`) | P2 | Breaks the phase into tasks tied to SPEC row IDs. Self-reviews before handoff. |
| meta-opus | Opus, Anthropic direct, with declared Grok fallback | P2 when a Hermes profile holds it | Plan review, then build + judge-verdict review. Grades leniency. Sends one delta packet. Never merges. Never builds. |
| builder | `builder`, `xai-oauth` / `grok-4.7` | P2 | Implements in a worktree outside the install (`ops/<key>` from `feat/ops-panel`). The review surface is that branch (the card's PR). Never commits to `main`. Never pushes. |
| Judge | Sol (`judge`, `openai-codex` / `gpt-6.1-sol`) | P2 | PASS or FAIL per acceptance item, each with evidence. Self-reviews the verdict for leniency. |
| Nacho | Nacho | — | Approves every task merge and every phase exit. Also the only escalation sink at round 3. Upstream / `main` stays his. |

Integrator `sandhi` (Hermes profile, `grok-4.7`) may merge into `feat/ops-panel` only after the stop set in section 5, including `NACHO GATE PASS` with `object: task-merge`. That is narrower than SPEC.md:46. The narrowing is the tension in section 2, not a silent edit of SPEC.

Every role self-reviews before handoff. The self-review comment starts with `SELF-REVIEW` and lists each item as pass or fail with a pointer.

## 4. Rounds

A recursive round is one pass that can return a delta. Budget is 3. `rounds_used` starts at 0.

1. Opening a round increments `rounds_used` by 1 before any packet in that round. If the increment would pass 3, do not open the round. Escalate (section 5).
2. Plan review sits inside the round. It is not a free pass before the budget, and it is not a fourth round after the budget. That is how plan review counts toward the three.
3. Round 1 always includes plan review, before the builder runs.
4. A later round includes a new plan review only when the incoming delta `target` is `planner`, or the plan's row IDs changed. Otherwise the round cites the prior `PLAN REVIEW PASS` (task, row IDs, comment pointer) and does not spend an extra round to do it.
5. Order inside a round that builds: plan review (or the citation) → builder → Judge → meta-opus build/verdict review → Nacho's gate, and only if Judge and meta both passed.
6. A plan-review FAIL closes the round as failed. The builder does not run. The delta target is `planner`.
7. A `JUDGE FAIL`, a `META IMPROVE`, or a `NACHO GATE FAIL` closes the round as failed.
8. One open delta per failed round. Do not stack a second delta in the same round.

`plan_review: cited-r1` still counts. The citation proves the plan review was not dropped. The round number still went up. A walker who adds a fourth build after three citations has left this file.

## 5. Stop and escalation

Stop only when the open round has all four:

- plan review PASS, or a cited prior plan-review PASS whose row IDs still match
- `JUDGE PASS` for that round
- `META PASS` for that round (seat `meta-opus`, holder `opus` or `grok-fallback`)
- `NACHO GATE PASS` for that round, `object: task-merge`

Anything else is not a stop. Sandhi does not merge on the first three alone.

If the round closed failed and `rounds_used` < 3, the next round opens with the one delta packet. No other new work starts.

If the round closed failed and `rounds_used` == 3, escalate. Do not open round 4. The escalation packet carries every still-open delta and every leniency grade from the three rounds (a plan-review-only round records `n/a`).

Phase exit is a separate Nacho gate, `object: phase-exit`, defined in `phase-acceptance.md`. A task stop is not a phase exit. A phase exit is not a task merge.

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

### 7.5 Nacho gate

```
NACHO GATE {PASS|FAIL} r{n}
object: task-merge | phase-exit
task_or_phase: {key or P0 or P0.5}
evidence: {JUDGE PASS pointer}; {META PASS pointer}
defect: {none or one sentence}
```

`NACHO GATE PASS` with `object: task-merge` is the fourth stop condition (section 5). `object: phase-exit` does not stop a task and does not merge a branch.

### 7.6 Escalation

```
ESCALATE r3
task: {key}
rounds_used: 3
open_deltas:
- r{n} target: {who} defect: {sentence} evidence: {pointer}
grades: r1={0|1|2|3|n/a} r2={0|1|2|3|n/a} r3={0|1|2|3|n/a}
```

No round 4. No merge.

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

Nacho's gate:

```
NACHO GATE PASS r1
object: task-merge
task_or_phase: EX-PASS
evidence: JUDGE PASS r1; META PASS r1
defect: none
```

Stop set is complete in round 1. `stopped=true`. `rounds_used` stays 1. No delta. No round 2. No escalation. Plan review counted: it was the first packet of round 1, not a round 0.

A walker who stops before `NACHO GATE PASS` has not stopped. A walker who increments `rounds_used` once per packet (plan, judge, meta, gate) and calls that four rounds has left section 4.

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
- stop rule followed: FAIL evidence: packet stopped before NACHO GATE
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
defect: stop set incomplete; the build stopped before NACHO GATE
exact_change: 1. add NACHO GATE PASS object task-merge to the section 5 stop list
verification: walker re-reads section 5; four bullets; the fourth is the gate
evidence: JUDGE FAIL r1 stop-rule item
rounds_used: 1
```

```
DELTA r1
target: builder
rows: none
defect: stop set incomplete; the build stopped before NACHO GATE
exact_change: 1. add NACHO GATE PASS object task-merge to the section 5 stop list
verification: walker re-reads section 5; four bullets; the fourth is the gate
evidence: JUDGE FAIL r1 stop-rule item
leniency: 2
rounds_used: 1
next_round: 2
```

The missing pointer is a Judge-owned repair. It is not in this delta. A packet that put "give the PASS item a file:line" on `target: builder` would violate section 7.4. This round already has its one open delta, so that repair waits. It is not dropped as a grade: leniency stays 2.

Round 1 closes failed. Nacho's gate does not run. Plan review counted inside round 1.

### Round 2

Opens. `rounds_used` = 2. Plan row IDs did not change and the delta target is `builder`, so plan review is not repeated. It is cited: `PLAN REVIEW r1 PASS`, task EX-FAIL, rows none. The citation is not a new round. Builder commits example sha `EX-FAIL-r2`. The one exact change was not applied. Section 5 as committed in EX-FAIL-r2 still has three stop bullets. The fourth, `NACHO GATE PASS` with `object: task-merge`, is absent.

```
JUDGE FAIL r2
task: EX-FAIL
rows: none
seat: judge
holder: sol
items:
- templates present: PASS evidence: review-loop.md section 7
- Nacho gate in the stop set: FAIL evidence: review-loop.md section 5 committed in EX-FAIL-r2 has three stop bullets; the fourth (NACHO GATE PASS, object task-merge) is absent
leniency_self_check: yes the FAIL cites the missing fourth bullet; the PASS cites section 7; no PASS covers the known gap
rounds_used: 2
```

Section 6 applies literally. Grade 0: every PASS has a pointer, and no PASS covers the known gap, because the gate item is FAIL and the evidence it cites is the missing bullet. A PASS on that gate item would be grade 3 (section 6: a PASS that contradicts the evidence it cites). That PASS is not in this packet.

```
META IMPROVE r2
task: EX-FAIL
rows: none
seat: meta-opus
holder: grok-fallback
build_sha: EX-FAIL-r2
judge: JUDGE FAIL r2
leniency: 0
leniency_reason: Judge failed the gate item; section 5 in EX-FAIL-r2 has no fourth bullet; the other PASS cites section 7; no PASS covers the gap
defect: section 5 committed in EX-FAIL-r2 still has three stop bullets
exact_change: 1. section 5 stop list must include NACHO GATE PASS object task-merge as the fourth bullet
verification: read section 5; four bullets; the fourth is the gate
evidence: JUDGE FAIL r2 gate item; section 5 as committed in EX-FAIL-r2
rounds_used: 2
```

```
DELTA r2
target: builder
rows: none
defect: section 5 committed in EX-FAIL-r2 still has three stop bullets
exact_change: 1. section 5 stop list must include NACHO GATE PASS object task-merge as the fourth bullet
verification: read section 5; four bullets; the fourth is the gate
evidence: JUDGE FAIL r2 gate item
leniency: 0
rounds_used: 2
next_round: 3
```

Round 2 closes failed. No Nacho gate.

### Round 3

Opens. `rounds_used` = 3. Plan review cited again (`PLAN REVIEW r1 PASS`). Not a fourth round. Builder commits example sha `EX-FAIL-r3`. Section 5 now has the four-part stop.

```
JUDGE PASS r3
task: EX-FAIL
rows: none
seat: judge
holder: sol
items:
- four-part stop: PASS evidence: review-loop.md section 5
leniency_self_check: yes
rounds_used: 3
```

```
META PASS r3
task: EX-FAIL
rows: none
seat: meta-opus
holder: grok-fallback
build_sha: EX-FAIL-r3
judge: JUDGE PASS r3
leniency: 0
leniency_reason: the only PASS item cites section 5
defect: none
exact_change: none
verification: read section 5
evidence: JUDGE PASS r3
rounds_used: 3
```

Nacho refuses the merge. The gate runs because Judge and meta both passed. A refusal is a failed round, not a free retry.

```
NACHO GATE FAIL r3
object: task-merge
task_or_phase: EX-FAIL
evidence: JUDGE PASS r3; META PASS r3
defect: wording of the gate bullet is ambiguous about phase exit
```

Stop set is incomplete (gate failed). `rounds_used` is 3. Escalate. Do not open round 4.

```
ESCALATE r3
task: EX-FAIL
rounds_used: 3
open_deltas:
- r3 target: builder defect: wording of the gate bullet is ambiguous about phase exit evidence: NACHO GATE FAIL r3
grades: r1=2 r2=0 r3=0
```

### Accounting a walker must reproduce

| Check | EX-PASS | EX-FAIL |
|---|---|---|
| Plan review counted inside a round, not beside the budget | yes, round 1 | yes, round 1; rounds 2 and 3 cite it |
| `rounds_used` at the end | 1 | 3 |
| Stop only after meta PASS + Judge PASS + Nacho gate | yes | no (gate FAIL) |
| Escalation at the limit, with open deltas and grades | no | yes, one open delta, grades 2 / 0 / 0 |
| r2 grade is a correct FAIL, not a false PASS graded 0 | n/a | yes, JUDGE FAIL r2, leniency 0; section 6 grade 3 would apply only if that gate item were PASS |
| DELTA r1 is one target and one defect; Judge repair is not on builder | n/a | yes, target builder, one defect sentence, numbered exact_change; the pointer repair is not in exact_change |
| Round 4 opened | no | no |

If a walker gives EX-FAIL a fourth round because plan review was "extra", the walk fails. If a walker stops EX-PASS at META PASS with no Nacho gate, the walk fails. If a walker stops EX-FAIL at META PASS r3, the walk fails.

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
        nacho_gate: PASS
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
        nacho_gate: absent
        closed: fail
        delta_target: builder
      - n: 2
        plan_review: cited-r1
        judge: FAIL
        meta: IMPROVE
        leniency: 0
        nacho_gate: absent
        closed: fail
        delta_target: builder
      - n: 3
        plan_review: cited-r1
        judge: PASS
        meta: PASS
        leniency: 0
        nacho_gate: FAIL
        closed: fail
```

## 11. Re-run the verify

From a checkout that has this file and `phase-acceptance.md`:

1. Walk EX-PASS (section 8). Confirm `rounds_used` ends at 1, the four stop packets are present, no `ESCALATE`, no round 2.
2. Walk EX-FAIL (section 9). Confirm plan review is inside round 1, rounds 2 and 3 cite it, `rounds_used` ends at 3, round 2 is `JUDGE FAIL` (the gate item fails because section 5 in EX-FAIL-r2 has no fourth bullet) with leniency 0, not a `JUDGE PASS` graded 0, the r3 gate is FAIL, the escalation lists grades `2 / 0 / 0` and one open delta, no round 4. Section 7.4 and DELTA r1 name one builder defect. The missing pointer is a grade, not a builder exact_change.
3. Open `phase-acceptance.md`. Confirm every P0 row and every P0.5 row names an independent source and a per-item result field, not only a non-empty cell. Confirm the negative list names A1–A7, approvals, transactional writes, Office, Canvas, and Board as not implemented by a P0.5 signature.

This file does not claim that walk was signed by Judge or by meta-opus. Their signatures are comments on the build card, after this handoff.
