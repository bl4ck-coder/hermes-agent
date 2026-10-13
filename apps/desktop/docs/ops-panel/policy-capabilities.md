# Ops panel policy v2 and capability negotiation (P0-06)

Status: documentation only. `ops-policy.yaml` in this directory is a versioned documentation artifact, not an installed live policy. It is not copied to `HERMES_HOME`, not loaded by a process, and not read by A6. This commit adds no route, no Electron change, and no profile write.

Tree cited: `hermes-agent` `005b104a506` (`feat/ops-panel` at branch creation). Handler lines below are that tree. They are not edited here.

Authority: SPEC.md section 4.4 (the example), section 4.5 (pair outcomes), section 8 (capability check, not a version-string guess), section 11.3 (effective-policy read, one validator), section 11.6 (typed run ops), section 11.7 (presence and usage honesty), section 12.5 W10. PLAN.md P0 task 6. Decisions D8, D11, D13.

Sibling matrices this card must not contradict. Consulted as commits, not assumed merged into `005b104a506` (that tree does not contain these files). A dirty worktree is not the citation.

- P0-01 `read-contracts.md` @ `8dbd1f3859ade2f85db269109afc9be934914dbd` (`ops/P0-01`). Omitted `?profile=` is the process launch profile (`:38`, `:371`), not all profiles and not the focused Ops profile. Section 4.3 `GET /api/status`, section 5.1 A1, section 5.2 A2, section 5.6 flags.
- P0-02 `action-contracts.md` @ `f11816a68ea213f446726293ee08335753430ad8` (`ops/P0-02`). `:28`: omitted `?profile=` is the process launch profile, not the focused Ops profile. Sections 2 and 3 (auth, unblock, typed runs).
- P0-03 `transaction-contract.md` @ `6075f3dda5214aef094d813a56367d5d0ea3e230` (`ops/P0-03`, commit object; the worktree had uncommitted edits at consult time and those edits are not cited). Section 5 step 1 is the local gate (403, no backup). Section 5 step 5 is A6 on governed fields. Section 15 is restore. Section 16 is remote Canvas read-only. Save stays disabled until `ops.transaction` exists. No renderer fallback.

Rows: O19, O40, O41, O50, O81, G2, G32, G34, G36, G40, G58, G84.

Future backend and Electron implementations of these flags and of A6 are outside P0 and P0.5. Owner phases stay P1 (reads, A7, typed proxy, atomic unblock) and P2 (A5, A6, history, restore).

## 1. Parsed policy fields

A parser of `ops-policy.yaml` yields exactly these fields. No other keys. Comments are not fields. Types are the YAML types, not strings of those types.

| Field | Type | Value | SPEC |
|---|---|---|---|
| `version` | int | `2` | 4.4. Not the capability schema. |
| `enabled` | bool | `true` | Explicit. Not omitted, not `1`, not `"true"`. |
| `scope` | string | `all_profiles` | Includes root and the name `default`. Not a profile list. |
| `allow` | list of 3 maps | see below | Direct anthropic, Sol pair, grok-4.7 pair. |
| `deny_default` | bool | `true` | Anything unmatched is denied. |
| `governed_fields` | list of 3 strings | the three SPEC strings, verbatim | Not a parsed path tree. |
| `enforcement.on_select_disallowed` | string | `block` | D13. |
| `enforcement.on_existing_violation` | string | `warn` | D13. Policy chip. Unrelated edits proceed. |
| `enforcement.migrations` | string | `manual` | Nothing rewrites a violating pair. |
| `non_llm_services` | string | `ignore` | `tts`, `stt`, `wake_word` are not governed. |

`allow`, in order:

1. `provider` string `anthropic`. `models` list of one glob: `claude-*`.
2. `provider` list `[openai-codex, openai]` in that order. `models` list `[gpt-6.1-sol, gpt-6.1-sol-900k, gpt-6.1-sol-pro]`, exact ids, not a glob.
3. `provider` list `[xai-oauth, xai]` in that order. `models` list `[grok-4.7]`, exact.

`governed_fields` strings, verbatim:

- `model.provider / model.default`
- `fallback_providers[*]`
- `auxiliary.*.provider / model`

Those strings name the slots in section 4. They are not extra YAML keys.

Root is in scope. There is no exempt profile. `sol-spec` is inside policy (D4) only when its pair matches section 2. The name does not grant a pass. Launch, root, and the focused profile are not the same identity. Section 1.1.

## 1.1 Profile identity

Three identities. Collapsing them is the r1 defect. This section does not rewrite existing surface omit rules.

| Identity | What it is | What it is not |
|---|---|---|
| root / `default` | The name `default` resolves to `_get_default_hermes_home()` (`hermes_cli/profiles.py:430-434`). `profile_exists("default")` is always true (`profiles.py:452-453`). SPEC `scope: all_profiles` includes this home and every named profile. | Not "whichever process launched". Not the focused Ops profile. Not the meaning of an omitted query. |
| launch profile | The process home (`get_process_hermes_home()`). `_config_profile_scope`: `None`, `""`, and `"current"` are no home override (`web_server_profiles.py:277-303`). Existing routes keep that omit rule (P0-01 `:38` and `:371`, P0-02 `:28`). | Not automatically root. Not the focused profile. |
| focused profile | The profile selected in the Ops connection switcher. Ops passes it on every effective-policy read, every Ops `GET /api/model/options`, and every Canvas write. | Not inferred from an omitted query. |

New effective-read default, declared here and nowhere else: omitted `profile` on `GET /api/ops/policy/effective` is the launch profile, the same omit rule as `_config_profile_scope`. It is not forced to root. That declaration does not change `GET /api/config`, `GET /api/model/options`, or any other verified route. Ops does not omit. Ops sends `?profile=` equal to the focused profile.

Switching the focused profile drops the previous body. Do not reuse `decisions`, `violations`, `allow`, or `candidates`. The cache key is the profile string Ops sent. A resolved directory that happens to equal the previous home is not a reason to reuse the body.

`serve-from-root`: process home is the default hermes home (`get_active_profile_name()` is `default`). `serve-from-judge`: process home is `profiles/judge`. Request `omitted` means the query is absent, `""`, or `current`. Request `default` and `smoke` are explicit names. An unknown explicit name is 404. It does not fall back to launch.

| Serve | Request | Resolved profile | Effective-read source | Model catalog | Writes |
|---|---|---|---|---|---|
| root | omitted | launch home, which is root in this row only. The request string is omitted, not the name `default`. | that process home's installed policy | existing `/api/model/options` with omitted profile reads the launch home. The Ops picker does not use this cell. It passes focused. | existing omitted write targets the launch home. An Ops write passes focused. |
| root | `default` | name `default` → root home. Same directory as launch in this row. The identity is the explicit name. | root home, because the name resolved there | `?profile=default` | `?profile=default` |
| root | `smoke` | `profiles/smoke` if that named profile is live, else 404. Not launch. | smoke home, or no body on 404 | smoke, or 404 | smoke, or 404. No write to root. |
| judge | omitted | launch home `profiles/judge`. Not root. Not the name `default`. | judge home's installed policy | omitted options read judge. Not root's catalog. | omitted write targets judge. Ops must not use this cell when focused is not judge. |
| judge | `default` | name `default` → root home. Not judge. | root installed policy. Drop any judge body first. | `?profile=default` is root's catalog. Not judge's. | writes with `?profile=default` hit root. Not judge. |
| judge | `smoke` | `profiles/smoke` or 404. Not judge. Not root. | smoke, or 404 | smoke, or 404 | smoke, or 404 |

A focus change from judge to smoke, or from omitted-launch to `default`, always refetches. Do not paint the previous chip, the previous allow rules, or the previous candidates. When serve-from-root and the request is `default`, directory equality with launch is not cache equality.

## 2. Pair match

A pair is `(provider, model)`, both strings after strip. Empty either side does not match.

Provider match is literal and case-sensitive. A rule whose `provider` is a string matches that string. A rule whose `provider` is a list matches membership in that list. No other rule matches.

Model match: a `models` entry with no `*` is exact. `claude-*` is a glob: `*` is one wildcard and matches zero or more characters; every other character is literal; case-sensitive. `claude-opus-4-6` matches. `claude` does not. `Claude-opus-4-6` does not.

`deny_default: true`: zero matching rules means deny. Two matching rules cannot happen with this file. Do not OR in a second catalog.

Do not call `hermes_cli.providers.normalize_provider` (`providers.py:164`) before the match. Its alias table (`providers.py:116-122`) rewrites `openai` to `openrouter`, `claude` to `anthropic`, and `grok` to `xai`. Using it would deny the SPEC-allowed `openai` + `gpt-6.1-sol` pair and would allow provider id `claude`, which is not direct `anthropic`. Match the stored id. `base_url`, transport, and a `claude` substring in the model do not make a provider direct.

Proxy Anthropic is any provider other than the string `anthropic` whose model matches `claude-*`. That includes `openrouter`, `bedrock`, `vertex`, `custom`, and a custom endpoint whose model id looks like Claude. All denied.

`grok-4.6` does not match rule 3. Denied on `xai`, `xai-oauth`, and every other provider.

`gpt-6.1-sol-900k` and `gpt-6.1-sol-pro` are allowed only on `openai` and `openai-codex`. A lookalike (`gpt-6.1-sol-mini`, a suffix not in the list) is denied. The glob does not apply to them.

`non_llm_services: ignore`: keys `tts`, `stt`, and `wake_word` are not governed fields. A write that changes only those keys does not take a policy decision. They are not thereby allowlisted for `model.provider`.

`migrations: manual`: a deny is never rewritten to an allowlisted pair. The UI may show a repair suggestion later (PLAN P5). This card does not apply it. No startup migration. No "fix on save".

Load rules for a future installed file (not this artifact):

- `version` must be int `2`. Any other version is unreadable for enforcement. Fail closed on selections. Do not coerce.
- `enabled` must be bool `true`. Omitted, `1`, `0`, or the string `"true"` is not explicit enable. Fail closed on selections. Do not coerce a number into the bool.
- This repository file is not that installed file. Copying it into `HERMES_HOME` is out of scope.

## 3. Examples the judge evaluates

Decisions use section 2 against `ops-policy.yaml`. `allow` means the pair may be selected. `deny` means a selection of that pair blocks. These rows are the allowlist check, not the warn path (section 4).

Allowed:

| provider | model | decision |
|---|---|---|
| `anthropic` | `claude-opus-4-6` | allow |
| `anthropic` | `claude-sonnet-4-5` | allow |
| `openai-codex` | `gpt-6.1-sol` | allow |
| `openai` | `gpt-6.1-sol` | allow |
| `openai-codex` | `gpt-6.1-sol-900k` | allow |
| `openai` | `gpt-6.1-sol-900k` | allow |
| `openai-codex` | `gpt-6.1-sol-pro` | allow |
| `openai` | `gpt-6.1-sol-pro` | allow |
| `xai-oauth` | `grok-4.7` | allow |
| `xai` | `grok-4.7` | allow |

A picker must not offer the glob text `claude-*` as a model id. The glob is the rule. A stored model matches it only when the id has the literal prefix `claude-`.

Blocked:

| provider | model | why |
|---|---|---|
| `openrouter` | `claude-opus-4-6` | proxy Anthropic. Model glob does not promote the provider. |
| `bedrock` | `claude-opus-4-6` | proxy. |
| `vertex` | `claude-sonnet-4-5` | proxy. |
| `custom` | `claude-opus-4-6` | proxy / custom. |
| `xai-oauth` | `grok-4.6` | not `grok-4.7`. |
| `xai` | `grok-4.6` | not `grok-4.7`. |
| `anthropic` | `grok-4.7` | model not in rule 1; provider not in rule 3. |
| `nous` | `hermes-3` | deny_default. SPEC 4.5 names `provider: nous`. |
| `kimi-coding` | `kimi-k2` | deny_default. SPEC 4.5. Alias collapse to `kimi-for-coding` is still not an allow rule. |
| `openai` | `gpt-5` | model not in rule 2. |
| `openai-codex` | `gpt-6.1-sol-mini` | not a named variant. |
| `claude` | `claude-opus-4-6` | provider id is the alias, not `anthropic`. |
| `grok` | `grok-4.7` | provider id is the alias, not `xai` or `xai-oauth`. |
| `openai` | `` | empty model. deny. |
| `` | `gpt-6.1-sol` | empty provider. deny. |
| `local` | `llama3` | deny_default. |
| `lmstudio` | `gpt-6.1-sol` | provider not in rule 2. |

Literal `openai` + `gpt-6.1-sol` stays allow. That is the counterexample to `normalize_provider`.

Warning and block are write-path outcomes (section 4), not a third allow state:

| Case | Outcome |
|---|---|
| Live pair `nous` / `hermes-3`. Mutation is Prompt `SOUL.md` only. | warn. Policy chip. Save proceeds if the transaction gate passes. Model bytes unchanged. |
| Live pair `xai-oauth` / `grok-4.6`. Mutation is profile description only. | warn. Proceed. |
| Live pair `openrouter` / `claude-opus-4-6`. Mutation is a skill disabled-bit. | warn. Proceed. |
| Live pair allowed. Mutation changes only `tts.provider`. | ignore. No policy chip from that key. Proceed. |
| Live pair `nous` / `hermes-3`. Mutation changes only `tts.provider`. Governed pair unchanged. | warn for the existing pair. Proceed. `tts` itself is ignored. |
| Picker or `PUT /api/profiles/{n}/model` body `xai-oauth` / `grok-4.6`, profile currently allowed. | block. Not a warning. |
| `POST /api/model/set` body `openrouter` / `claude-opus-4-6`. | block. |
| Raw YAML whose governed pairs are unchanged and violating, and some other key changes. | warn. Proceed. |
| Raw YAML that changes `model.default` to `grok-4.6`. | block. |
| Restore whose restored governed pair is `grok-4.6` or `nous` / anything. | block. Restore is a selection of those fields even when they already match the live violation. |
| Any deny above, followed by an automatic rewrite to `anthropic` / `claude-opus-4-6`. | forbidden. `migrations: manual`. |

No row uses token count `0` as a stand-in for deny, warn, or unknown.

## 4. Shared validator

One validator. Name: A6. It is not implemented (P0-03 section 20 at `6075f3dda5214aef094d813a56367d5d0ea3e230`). When it exists it reads the installed policy, not this repository file, and it runs inside the P0-03 transaction at section 5 step 5, after backup, before replace.

Slots, from the three `governed_fields` strings:

| Slot | Where it lives | Write surfaces |
|---|---|---|
| primary | `model.provider` and `model.default` | `PUT /api/profiles/{name}/model` (`profiles.py:1049`), `POST /api/model/set` when `scope=main` (`models.py:376`), raw YAML, model-node restore |
| `fallback_providers[*]` | each entry's provider and model | raw YAML, any write that sets that list. There is no separate Canvas node. The same validator still runs. |
| auxiliary | `auxiliary.<task>.provider` and `auxiliary.<task>.model` | `POST /api/model/set` when `scope=auxiliary`, raw YAML, a restore that writes those keys |

`POST /api/model/set` is not a Canvas save (P0-03 section 20). It is still a governed selection. Ops must not call it to skip A5 or A6. Until both `ops.transaction` and `ops.policy` are boolean true, and the connection kind is `local`, Ops does not send a model assignment. That sentence is the model-assignment gate only. It does not forbid Prompt. The one write-gate table is section 7.5. The existing handler remains for non-Ops callers. This card does not wrap it.

Selection versus existing violation:

- A selection is a governed pair the write sets to a value different from the live pair, or a model-assignment body (`PUT .../model`, `POST /api/model/set`), or any restore of that pair.
- An existing violation is a live governed pair that is denied and that this write does not change and does not restore.
- Disallowed selection: HTTP 400. No replace. P0-03 step 5: backup from step 4 stays, `outcome: aborted_validation`, live file unchanged. Not 403. Not 401.
- Existing violation: do not return 400 for that pair. Response includes a warning the UI shows as the Policy chip (G40). Unrelated keys still save. The chip does not block.
- Restore of a denied governed pair is a selection even if those bytes equal the live file (P0-03 section 15). Block.
- A raw YAML document sets every key. "Unchanged" means the submitted governed pair equals the live pair. Equal and denied: warn, proceed. Different and denied: block.
- `tts` / `stt` / `wake_word` never enter the selection check.

Unrelated means the mutation's governed payload is unchanged. Prompt, description, skill toggle, toolset flag, and a raw-YAML non-governed key are unrelated to a live violation. When the loaded read has a violation, they warn and proceed. They do not clear the violation. When the policy flag is absent, they do not invent that violation; section 7.5 names the capability warn.

Fail closed applies only to a governed selection that was sent: installed file missing, unreadable, `enabled` not bool `true`, or `version` not int `2`. That selection blocks. That is not allow-all. It is not a client parse of this repository file. An unrelated edit that section 7.5 allows to be sent may proceed with warning `policy_unreadable` or `policy_absent`, and only when `ops.transaction` is boolean true and the kind is `local`. Flag missing is not installed-unreadable. If `ops.policy` is absent or not boolean true, do not attempt a governed selection, a model assignment, a raw YAML save, or a restore. That policy ban does not, by itself, cover Prompt. Prompt still follows section 7.5, including the transaction and local gates. Section 7.5 is the only write-gate table. This paragraph does not add a second one.

The Policy chip is a violation on the effective-policy read. If that read did not return a violation, the client does not draw the chip from a local copy of this YAML and does not invent a provider/model pair. A capability warn ("policy unavailable") is not that chip.

## 5. Effective-policy read

Name: `GET /api/ops/policy/effective`.

Status: proposed. No handler in `hermes_cli/web_routers` at `005b104a506`. Not `GET /api/ops/hooks`, not `POST /api/ops/config-migrate`, not `GET /api/config`. Owner: P2, same change as A6. Not P0. Not P0.5.

- Schema, query: optional `profile`. Omitted means the launch profile (section 1.1). It does not mean root unless the process was launched from root. Ops does not omit. Ops sends the focused profile. Switching that string drops the previous body.
- Schema, response, `schema_version` 1:

```
{
  schema_version: 1,
  profile: string,
  loaded: boolean,
  enabled: boolean | null,
  version: integer | null,
  scope: string | null,
  source: "loaded" | "absent" | "unreadable",
  policy_hash: string | null,
  catalog_hash: string | null,
  enforcement: { on_select_disallowed, on_existing_violation, migrations } | null,
  decisions: [ { field, provider, model, decision: "allow"|"deny", reason } ],
  violations: [ { field, provider, model, reason } ],
  allow: [ { provider: string | string[], models: string[] } ] | null,
  candidates: [ { provider: string, model: string, decision: "allow"|"deny", reason: string, in_catalog: boolean } ] | null
}
```

- `source` is that enum. Do not return `hermes_home`, an absolute path, or file bytes. `policy_hash` is sha256 hex of the installed file, or null.
- `decisions` are the live governed pairs for that profile only. They feed the Policy chip. They are not the picker. Empty when `loaded` is false. Empty is not allow-all. A live `nous` pair must not empty the repair menu.
- `violations` are the denied rows of `decisions`. They feed the Policy chip. They do not themselves block a later unrelated edit. They do not filter `/api/model/options`.
- `allow` is the loaded file's allow rules, serialized, same shape as section 1. Null unless `loaded` is true. There is no `providers` field. G84 flattens `allow[].provider` (a string contributes that string; a list contributes each member). Do not derive that set from live `decisions`.
- `candidates` is the backend score of every concrete pair in that profile's `GET /api/model/options` catalog. Never the glob text `claude-*`. `in_catalog: true` for those rows. A live governed pair that is not in the catalog may appear with `in_catalog: false` so the chip can name it. It does not enter the picker. The client does not compute this list.
- Version and hash coherence: `allow` and `candidates` are usable only when `loaded` is true, `enabled` is bool `true`, `version` is int `2`, `schema_version` is int `1`, and `policy_hash` is a non-null hex string. `catalog_hash` is sha256 hex of the UTF-8 canonical JSON of the options body that was scored (object keys sorted, no insignificant whitespace), excluding any eligibility fields a later options response might echo. The picker joins only when both calls used the same focused profile and the client's hash of the options body equals `catalog_hash`. Mismatch: refetch both once. Still mismatch: picker disabled. Do not show the unfiltered catalog as P2. Do not parse this repository file.
- Cross-check: every `candidates` row with `decision: allow` has its provider in the flattened `allow` set. If not, the read is incoherent. Same recovery as a hash mismatch. Do not list a partial provider set.
- Versioning: `schema_version` 1 is this object. Policy `version` 2 is the file. A client must not require them to be equal. An unknown `schema_version` is unreadable: do not render `decisions`, `allow`, or `candidates`.
- Auth: dashboard session token (P0-02 section 2). Not on the public allowlist. 401 means auth failure. It does not mean "no policy" and it is not existence proof of this route (P0-01 section 5.6).
- Scope: one profile on this serve connection. Not a tenant. Root is in scope (D8) when the request names it or the launch home is root. A remote connection may call this read. The read does not authorize a Canvas write.
- Dependencies: call it only when `ops.policy` is boolean true on a fresh `GET /api/status` 200 with `ops_capabilities_schema` int `1`. Otherwise do not call. Absence of the flag is not `source: unreadable`.
- Absent route behavior is the flag, not a probe. Do not `GET` this path to see if A6 exists.
- Errors: 401 auth; 404 unknown profile; 200 with `loaded: false`, `source: absent`, `allow: null`, `candidates: null`, `decisions: []` when the installed file is missing. Do not 404 the file. Do not 200 with `enabled: true` or with allow rules when the file was not read. `source: unreadable` uses the same nulls. Neither null list is allow-all. Neither is an empty repair menu presented as "nothing allowed".

`/api/model/options?profile=` remains the catalog of concrete provider/model pairs (G2, O50). Ops calls it with the focused profile, the same string as the effective read. The picker offer list is `candidates` where `decision` is `allow` and `in_catalog` is true. It is not the intersection of the catalog and live `decisions`. The client does not re-run globs, `deny_default`, or `normalize_provider`. The client does not intersect against this repository file.

Catalog countermodels, offer list only:

| Live primary | Catalog also contains | Offer list |
|---|---|---|
| `openai` / `gpt-6.1-sol` | allowed `anthropic` / `claude-opus-4-6` and `xai-oauth` / `grok-4.7` | Sol, that Claude id, and `grok-4.7`. Not Sol-only. Live `decisions` may contain only the Sol pair. That list is the chip source, not the menu. |
| `nous` / `hermes-3` | the same allowed Claude, Sol, and `grok-4.7` pairs | those allowed repairs. The menu is not empty. The chip shows the nous violation. |
| any | `openrouter` / `claude-opus-4-6`, `xai` / `grok-4.6` | those pairs never appear. If the catalog listed them, `candidates` marks `deny` and the offer list excludes them. |

G84 does not invent a field. Allowed providers are the flattened `allow[].provider` set, cross-checked against allow-decision `candidates` as above, then intersected with providers whose auth status was actually read (`GET /api/providers/oauth` plus `GET /api/env` `is_set`). A live nous pair does not remove `anthropic` from that set. A proxy provider is not in `allow`, so it is not listed. When `ops.policy` is false or absent, the category is "policy filter unavailable", not an unfiltered catalog labeled P2, and not an empty catalog labeled "nothing connected".

## 6. Capability flags on `GET /api/status`

Today's handler (`hermes_cli/web_routers/status.py:466` `get_status`, body built at `:508-563`) does not return `ops_capabilities`. P0-01 section 4.3 and section 5.6 already say that. Absence of the key is the old-backend row. This card names the object. It does not add it to the handler.

On a future 200, two sibling keys, both required together:

- `ops_capabilities_schema`: int `1`. Not `0`. Not a string.
- `ops_capabilities`: object of boolean flags. No numbers.

Flag names are the P0-01 dotted names, plus the write and run flags this task requires. Unknown keys are ignored. A known key whose value is not a boolean, including `0` and `1`, is malformed and is treated as absent. Do not coerce `0` to false and then to a usage zero. Do not coerce `1` to true.

| Flag | Covers | Proposed route or gate | Phase |
|---|---|---|---|
| `ops.fleet` | A1 | `GET /api/ops/fleet` | P1 |
| `ops.usage` | A2 | `GET /api/ops/runs/{source}/{id}/usage` | P1 |
| `ops.approvals` | A3 | `GET /api/approvals/pending`, `POST /api/approvals/{id}/respond` | P1 |
| `ops.delegation` | A4 | read-only delegation projection | P1 |
| `ops.transaction` | A5 transactional writes | mutation in P0-03 section 5 | P2 |
| `ops.history` | history list | manifest list, no secret bytes | P2 |
| `ops.restore` | restore | restore mutation, section 4 of this file and P0-03 section 15 | P2 |
| `ops.policy` | A6 policy enforcement, and the effective-policy read | section 5 | P2 |
| `ops.kanban_sse` | A7 | `GET /api/plugins/kanban/events/stream` | P1 |
| `ops.unblock` | atomic unblock | `POST /api/plugins/kanban/tasks/{id}/unblock` | P1 |
| `ops.runs` | scoped typed run operations | inspect, approve, steer, stop, events, via main-process proxy | P1 |

Eleven flags. Each one is specified below on the same axes: schema, versioning, absent/false, dependencies, auth/scope, W10. Schema does not vary: each flag is a boolean. Versioning does not vary: only `ops_capabilities_schema` int `1` makes a flag readable; any other schema treats that flag as absent. Subsections that omit those two sentences inherit them. They do not inherit a sibling's route.

Honesty, named so it cannot be read as a fallback: no numeric-zero usage fallback, no false-idle presence, no optimistic claim of transactional support. A missing usage value is not `0`. A missing or stale presence observation is not idle. `ops.transaction` absent or false is not transactional support, even when `atomic_write_text` exists.

Schema of each flag: a boolean member of `ops_capabilities`. No nested object in schema 1. No count. No `"supported"`.

Versioning of each flag: schema 1 defines this set. A later schema may add flags. It must not reuse a name for a different meaning. A client that sees `ops_capabilities_schema` other than int `1` treats every flag as absent. It does not guess. Policy file `version: 2` does not imply schema 1, and schema 1 does not imply the policy file is installed.

Absent and false are the same action refusal: do not call that route, do not enable that control, do not substitute a client implementation. They are not the same as a failed status read (section 7, unknown). A successful 200 with the key missing is absent for every flag. A successful 200 with the key present and the flag `false` is false for that flag only.

Dependencies, client-side, stricter than the advertisement:

- `ops.restore` is usable only when `ops.restore`, `ops.history`, `ops.transaction`, and `ops.policy` are all boolean true, and the kind is `local`. A6 runs on restore. A missing sibling forces restore off.
- `ops.history` is usable only when `ops.history` and `ops.transaction` are both true.
- Prompt save needs `ops.transaction` boolean true and kind `local`. It does not need `ops.policy`. Flag absent is a capability warn, not a block, and not an invented violation.
- Model assignment, raw YAML, and restore need `ops.transaction` and `ops.policy` both boolean true, and kind `local`, before Ops sends. Raw is in that set because the client must not parse YAML to exempt a document.
- `ops.policy` true with `ops.transaction` not true allows the effective-policy read and the chip. It does not allow Prompt, Model, raw, or restore. `atomic_write_text` on SOUL is not `ops.transaction` (P0-02 section 2).
- No flag implies another. `ops.fleet` true does not imply `ops.usage`.
- Section 7.5 is the one response per surface. These bullets match that table. They are not a second answer.

Auth and scope, shared: flags describe this serve process. They are not a per-profile grant and not a Desktop connection permission. `?profile=` on `/api/status` does not change them (`status.py:471` is config scope for the gateway rollup, not a capability scope). `/api/status` stays on the public allowlist (P0-01). The object must not include tokens, paths, pids, or policy decisions. Per-flag route auth is the auth of that route, not the public status auth.

Remote is not a flag. See section 7. Write flags true do not make remote Canvas writable.

### 6.1 `ops.fleet` (A1)

- Absent/false: do not call `GET /api/ops/fleet`. Every surface that would show presence shows `unknown`. Not `idle`. Not `offline`. Not a local join of `workers/active`, session streams, and `gateway_running`.
- Dependencies: none. Does not read `ops.usage`.
- Auth/scope: session token on the fleet route. Scope is the serve connection (P0-01 section 5.1). Optional `board` filters kanban inputs only.
- W10: the Office presence section and the rail glyph use `unknown` copy ("presence unavailable"), independently of Board and Canvas. Loading while status is in flight: shimmer, not idle. Reconnecting: keep the last `unknown` or the last fleet body, labeled stale; do not promote stale work to idle. Exhausted: retry on that section only. `gateway_running: true` and `active_agents: 0` on status are not presence (P0-01). Never map missing or old running to idle.

### 6.2 `ops.usage` (A2)

- Absent/false: do not call the usage route. Token cells render `""` (empty), provenance `unknown`. Never `0`. Never the analytics aggregate. Never cron preview zeros (`cron.py` hard-coded `input_tokens: 0` is a file preview, not this cell — P0-01 section 5.2).
- Dependencies: none. A fleet row's tokens stay blank when this flag is false even if `ops.fleet` is true.
- Auth/scope: session token. One run, `source` `kanban` or `gateway`, that run's id. Not a tenant total.
- W10: the token column and the run-panel token line fail alone. Loading: blank, not `0`. Reconnecting: keep blank or the last null-with-provenance, not a zero. Exhausted: "usage unknown". `GET /api/analytics/usage` zeros mean that aggregate counted zero (P0-01 section 4.3). They must not fill this cell. Gateway `usage={}` and coerced session-counter zeros stay provenance `gateway.session_counters` when the flag is true; they are still not displayed as measured per-run tokens. Shared-session totals are not copied onto each run.

### 6.3 `ops.approvals` (A3)

- Absent/false: do not call the pending list or the respond route. Needs-you does not show an empty "all clear". It shows approvals unavailable. Do not settle via raw `approval.respond` or `POST /v1/runs/{id}/approval` from the renderer.
- Dependencies: none on other flags. Respond still requires a list row with non-null `exact_request`. Null `exact_request` is Review, HTTP 403 on the respond route if called (P0-02 section 3.2). That 403 is not this flag.
- Auth/scope: session token. Opaque id. Server loads profile and origin. Client does not pass a profile to act as. Remote respond that writes another machine's queue is out of v1 even if this flag is true.
- W10: the Needs-you approval rows fail alone. Kanban blocked rows are a different action (`ops.unblock`). Loading: shimmer on the approval block. Reconnecting: do not show the last list as settled. Exhausted: unavailable, not zero pending.

### 6.4 `ops.delegation` (A4)

- Absent/false: do not call the projection. The Sub-agents node shows unavailable. Not an empty list meaning "no delegates". Not a fabricated graph.
- Dependencies: none. The node stays read-only when the flag is true (SPEC section 11.9, G34). No write flag turns on Save.
- Auth/scope: session token. One profile. `delegation.api_key` never reaches the renderer (P0-03).
- W10: that node fails alone. Loading shimmer. Reconnecting keeps the last projection labeled stale, or unavailable if none. Exhausted: unavailable. Do not fall through to `GET /api/config` and render the raw block as the node.

### 6.5 `ops.transaction` (A5)

- Absent/false: Prompt, Model, raw YAML, restore, and secret set/clear stay disabled. No renderer filesystem write. No snapshot-then-PUT. No "degraded write". `atomic_write_text` is not this flag. This is the transaction gate. Policy absence does not add a second ban on Prompt. Section 7.5 is the write table.
- Dependencies: section 7.5. This subsection does not restate a different rule.
- Auth/scope: session token. Profile and object id on the mutation. Connection kind `local` or the backend returns 403 before backup (P0-03 section 5 step 1). A missing kind is remote.
- W10: that node's Save shows "Save unavailable". Not a spinner that then writes. Loading of status: Save disabled. Reconnecting: Save disabled. Do not claim the in-flight write committed. Exhausted: still disabled. Disconnect after send is "outcome unknown" (P0-03 section 14), never "saved" and never "original intact". A disabled Model save does not take down Prompt, Office, or Board.

### 6.6 `ops.history`

- Absent/false: no History drawer data. Do not list `backups/ops-panel` from the renderer. G32 owner and version show unavailable, not a guessed git user.
- Dependencies: usable only with `ops.transaction` true. Otherwise treat as false.
- Auth/scope: session token. One profile, one node. Manifest minus secret fields (P0-03 section 8).
- W10: the History drawer fails alone. The node can still be read. Loading: drawer shimmer. Empty (flag true, no manifests) is a real empty, distinct from absent. Reconnecting: do not offer restore from a stale list. Exhausted: drawer unavailable.

### 6.7 `ops.restore`

- Absent/false: no Restore control. Do not copy a backup onto the live file from Electron.
- Dependencies: requires `ops.history`, `ops.transaction`, and `ops.policy` all true, and kind `local`. Otherwise treat as false.
- Auth/scope: session token. Non-secret restore body is `{backup_id, expected_hash}` where `expected_hash` is the live composite (P0-03 section 15). Not the backup's hash. Secret restore sends `backup_id` only (same section). This card does not merge those two P0-03 sentences.
- W10: Restore disabled with the reason (capability, remote, or policy). A blocked policy restore is 400, not a capability miss. Loading: disabled. There is no optimistic "restored" before read-back.

### 6.8 `ops.policy` (A6)

- Absent/false: do not call `GET /api/ops/policy/effective`. Do not filter the picker from this repository YAML. Do not draw a Policy badge. Do not invent a provider/model pair. Model, raw, and restore stay off (section 7.5). Prompt may still save when `ops.transaction` is boolean true and the kind is `local`, with a capability warn only. G84 does not claim a P2 filter.
- Dependencies: the read needs only this flag. A governed send also needs `ops.transaction` and kind `local`. Advertised true is not proof the installed file loaded. `loaded` is that proof. `source: unreadable` is not this absent/false row.
- Auth/scope: session token on the read. One profile, the focused profile Ops sent, including root when that is the request. The flag itself is process-wide.
- W10: the model picker and the Policy chip fail alone. Loading: picker disabled, not the full unfiltered catalog presented as P2. Reconnecting: keep a chip only if the last loaded read had a violation, labeled stale; do not invent one. Model, raw, and restore Save stay disabled. Prompt follows section 7.5. Exhausted: "policy unavailable". Do not switch to allow-all. Not a full-page failure. `enabled: false` on a loaded file is a different state (section 2): not this flag, and not allow-all either. The example file is `enabled: true`.

### 6.9 `ops.kanban_sse` (A7)

- Absent/false: do not call `GET /api/plugins/kanban/events/stream`. The verified WebSocket `/api/plugins/kanban/events` remains the push path (P0-01 section 5.5). This flag false is not "no live board" and not a cue to invent SSE.
- Dependencies: none. Polling at 5 seconds is the fallback only when the stream in use is down (D12), not the steady state when the WebSocket is up.
- Auth/scope: same auth as the WebSocket upgrade. Query includes board. Resume from `Last-Event-ID` equal to `task_events.id` when the SSE route exists. Omitted cursor must not replay the whole table.
- W10: the Board stream status fails alone. Columns can still render from the last successful board read, labeled stale. Loading: skeleton, not empty columns as "no tasks". Reconnecting: reconnect the socket that exists; do not flip presence to idle. Exhausted: 5 second poll, labeled degraded, not a second invented stream.

### 6.10 `ops.unblock`

- Absent/false: Unblock stays disabled. Do not compose `PATCH` status, `POST .../comments`, and `POST .../reclaim` and call that atomic (P0-02 section 3.1).
- Dependencies: none on the policy flags. Not offered on a remote connection in v1 even if the flag is true.
- Auth/scope: session token. Board query, task id. Body `{note, expected_claim_lock, expected_status}`. `note` required, non-empty after trim. 409 on claim or status mismatch writes nothing.
- W10: the Unblock control fails alone. Open still works. Loading: disabled. A missing `whatFor` shows "reason not recorded" (SPEC section 11.8). Do not fabricate the note. Exhausted: disabled, not a partial comment left on a blocked card.

### 6.11 `ops.runs`

- Absent/false: Ops does not call gateway run routes. The renderer never receives `API_SERVER_KEY`. No arbitrary URL from the renderer (SPEC section 11.6). Do not add a generic `fetch(gateway + path)` bridge and treat a missing flag as "call it anyway".
- When true, the only ops are inspect, approve, steer, stop, and events, resolved per connection in the Electron main process. Approve here is the gateway run approval inside the typed proxy; the renderer-facing approval remains A3 when `ops.approvals` is true. Do not expose both as two renderer URLs.
- Dependencies: none that promote another flag. Stop still has a UI confirm (P0-02 section 3.3). The handler has no confirm field. D7 test-run start has no confirm and no token cap; that start is not licensed by a false flag.
- Auth/scope: gateway Bearer stays in main. 401 `gateway_auth_failed` is auth failure. Scope is the starting profile of that connection (`gateway/platforms/api_server.py:3637`). Another profile's run id is not found, not leaked.
- W10: run controls on the task tab fail alone. The timeline can show the last inspect, labeled stale. Loading: controls disabled. Reconnecting: do not show Stop as succeeded. Exhausted: controls unavailable. A concurrency refusal on start is admission, not a D7 cap (P0-02 section 3.5).

## 7. Truth tables

Flags below mean boolean true on a fresh status 200 with `ops_capabilities_schema` int `1`. Absent means the key is missing or the flag is not boolean. Unknown means status itself failed (network, timeout, non-JSON, or 401 on a path that should have been public).

### 7.1 Old backend

This SHA. `get_status` returns no `ops_capabilities` (`status.py:508-563`). P0-01 section 5.6.

| Observed | Client |
|---|---|
| 200, key absent | Every flag absent. Do not probe proposed routes. A follow-up 401 or 404 is not a discovery method. |
| 200, key present, schema not int `1` | Every flag absent. Do not interpret the object. |
| 200, `version` string of the app (the existing `version` field) | Not a capability. Do not map a version compare onto A1–A7. SPEC section 8's "version" check is this object, once it exists, not `status.version`. |
| Unknown status | Flags unknown. Writes disabled. Presence `unknown`, not idle. Tokens `""`, not `0`. Do not reuse a previously true write flag. |

### 7.2 Missing adapter

One flag absent or false, siblings true. W10 is per feature. Do not infer the missing one.

| Flag off | Siblings on | What the user sees | Forbidden substitute |
|---|---|---|---|
| `ops.fleet` | usage, runs | presence unavailable / `unknown` | idle because `active_agents` is 0 or gateway is up |
| `ops.usage` | fleet | token cell `""`, provenance unknown | numeric 0, analytics day total, cron preview 0 |
| `ops.approvals` | unblock | approval block unavailable | empty list as "nothing pending" |
| `ops.delegation` | policy | Sub-agents unavailable | empty delegation as "no sub-agents" |
| `ops.transaction` | policy, history | Save disabled | renderer write, snapshot-then-PUT, claim that `atomic_write_text` is the transaction |
| `ops.history` | transaction | drawer unavailable | renderer `readdir` of `backups/ops-panel` |
| `ops.restore` | history, transaction, policy | Restore hidden | copy backup bytes from the client |
| `ops.policy` | transaction | model, raw, and restore off; picker not labeled P2. Prompt still follows section 7.5 | filter with this repo YAML |
| `ops.kanban_sse` | fleet | Board uses the verified WebSocket | invent SSE; or declare the board dead |
| `ops.unblock` | approvals | Unblock disabled | three-call composition |
| `ops.runs` | approvals | run controls unavailable | arbitrary gateway URL |

No row claims transactional support because a sibling flag is true. `ops.policy` true is not `ops.transaction` true.

### 7.3 Remote

`DesktopConnectionKind` is `cloud | local | remote | ssh` (`apps/desktop/src/global.d.ts:1134`). Canvas writes require `local` (D11, P0-03 section 16). Missing kind is remote. A tunneled loopback whose kind is not `local` is remote.

Write flags do not override this. The renderer hides the controls. Hiding is not the gate. The backend 403 is the gate.

| Kind | Read flags true | Write flags true (`transaction`, `history` list is a read, `restore`, `policy` enforcement) | Canvas |
|---|---|---|---|
| `local` | honor the read flag | honor the write flag and its dependencies | section 7.5 is the response. Not a second rule. |
| `remote`, `ssh`, `cloud`, missing | reads allowed when their flag is true | ignored | read-only. Do not send Prompt, Model, raw, restore, or secret set/clear. If sent, 403, no backup. Same answer as section 7.5. |
| any non-local | `ops.policy` true allows the effective-policy read | `ops.policy` true does not allow a model PUT | Policy chip may show. Do not send Prompt, Model, raw, or restore. Same answer as section 7.5, not a second one. |
| any non-local | `ops.runs` true allows typed ops through main, key stays in main | `ops.unblock` is not offered in v1 (P0-02 section 3.1) | not a Canvas write |
| any non-local | `ops.approvals` list may be read | respond that writes another machine's queue is out of v1 | not enabled by the flag |

`ops.history` list is a read: allowed on remote when the flag is usable. `ops.restore` is a write: blocked on remote even if advertised true.

### 7.4 401 and 403

401 is auth. 403 is a named refusal. Neither is a capability probe. P0-01: do not discover adapters by catching 401. P0-02: 401 is not existence proof.

| Response | Means | Does not mean |
|---|---|---|
| 401, missing or invalid session token, before routing | auth failure | route missing, flag false, policy deny, object missing |
| 401 `gateway_auth_failed` | gateway key missing or wrong, in main | policy deny, run missing, flag false |
| 401 on a proposed path that was called anyway | ignored as evidence | flag value. The call was already forbidden. |
| 403, connection kind not `local`, Canvas write | remote gate (P0-03 step 1) | adapter missing, policy deny. No backup is created. |
| 403, approval respond, `exact_request` null | must show Review (P0-02 section 3.2) | policy deny, flag false |
| 400, disallowed selection | A6 block | 403, 401, warning |
| 409, claim or hash mismatch | conflict, nothing or no replace | capability failure |
| 404, unknown profile or task | that id | 401, and not a reason to flip flags |
| 200 status, no `ops_capabilities` | old backend, flags absent | 401 |

A policy deny is 400. A remote Canvas write is 403. An auth failure is 401. The three are not interchangeable, and none of them is "set the flag to false in the client cache".

## 7.5 Write gates

One table. Transaction × policy × local, four surfaces. Each cell is the only Ops response for that row. Section 4 is the validator after a send. It does not choose whether Ops sends. Section 6.5 does not restate a different rule. No cell is a full-page failure. No cell parses `ops-policy.yaml` from this repository or from a copied file in the renderer.

Policy values:

- `loaded`: `ops.policy` is boolean true, the effective read has `loaded: true`, `enabled` bool `true`, `version` int `2`.
- `flag-absent`: `ops.policy` is missing, false, or not a boolean, or `ops_capabilities_schema` is not int `1`. Do not call the read. This is not `source: unreadable`.
- `unreadable`: flag is boolean true and the read `source` is `unreadable`, or `version` / `enabled` is not the explicit value above. Warning code `policy_unreadable`. No invented pair.
- `file-absent`: flag is boolean true and the read `source` is `absent`. Warning code `policy_absent`. No invented pair. Not the same as `flag-absent`.

Transaction `false` means the flag is missing, false, or not a boolean. Kind `not-local` includes `remote`, `ssh`, `cloud`, and missing. A sent write on `not-local` is 403 with no backup (P0-03 section 5 step 1) if it reaches the backend. Ops still does not send.

| txn | policy | kind | Prompt | Model | raw | restore |
|---|---|---|---|---|---|---|
| false | loaded | local | Do not send. | Do not send. | Do not send. | Do not send. |
| false | loaded | not-local | Do not send. | Do not send. | Do not send. | Do not send. |
| false | flag-absent | local | Do not send. | Do not send. | Do not send. | Do not send. |
| false | flag-absent | not-local | Do not send. | Do not send. | Do not send. | Do not send. |
| false | unreadable | local | Do not send. | Do not send. | Do not send. | Do not send. |
| false | unreadable | not-local | Do not send. | Do not send. | Do not send. | Do not send. |
| false | file-absent | local | Do not send. | Do not send. | Do not send. | Do not send. |
| false | file-absent | not-local | Do not send. | Do not send. | Do not send. | Do not send. |
| true | loaded | not-local | Do not send. | Do not send. | Do not send. | Do not send. |
| true | flag-absent | not-local | Do not send. | Do not send. | Do not send. | Do not send. |
| true | unreadable | not-local | Do not send. | Do not send. | Do not send. | Do not send. |
| true | file-absent | not-local | Do not send. | Do not send. | Do not send. | Do not send. |
| true | loaded | local | Send. If `violations` is non-empty, Policy chip and proceed. If empty, proceed with no chip. Never block Prompt for policy. | Send as a selection. Denied body: 400, no replace. Allowed body: proceed, including a repair off a live denied pair. Body equal to the live denied pair: 400. Not an unrelated edit. | Send. Client does not parse the document. Server returns one status: 400 if a governed pair changed and is denied; 200 warn and proceed if every governed pair equals live, including an existing violation. | Send as a selection. Denied restored governed pair: 400, even if those bytes equal live. Allowed restored pair: proceed. Not the unrelated path. |
| true | flag-absent | local | Send. Capability warn only. No Policy badge. No invented pair. | Do not send. No repository YAML. | Do not send. No client YAML parse. | Do not send. No client copy of a backup. |
| true | unreadable | local | Send. Warn `policy_unreadable`. No invented pair. Do not block. | Do not send. Warn `policy_unreadable`. Not allow-all. | Send. Client does not parse. Server returns one status: 400 `policy_unreadable` if any governed pair differs from live; 200 warn `policy_unreadable` and proceed if every governed pair equals live. | Do not send. Warn `policy_unreadable`. Not allow-all. |
| true | file-absent | local | Send. Warn `policy_absent`. No invented pair. Do not block. | Do not send. Warn `policy_absent`. Not allow-all. | Send. Client does not parse. Server returns one status: 400 `policy_absent` if any governed pair differs from live; 200 warn `policy_absent` and proceed if every governed pair equals live. | Do not send. Warn `policy_absent`. Not allow-all. |

existing-violation+unrelated-edit is the `true` / `loaded` / `local` Prompt cell and the same row's raw cell. It is not a second row and not a second answer. installed-unreadable is the `unreadable` policy value, not `flag-absent`. A disabled Model control does not disable Prompt, Office, or Board.

## 8. Rows

| Row | What this card freezes | What it does not do |
|---|---|---|
| O19 | Tokens stay `""` with provenance `unknown` until `ops.usage` is true and A2 returns a value. Null is not `0`. | No usage route. |
| O40 | Default-model menu, once `ops.policy` is true and the read is coherent, is section 5 `candidates` with `decision: allow` and `in_catalog: true`. Not the live-decisions intersection. The write is the shared validator, not a side path through `POST /api/model/set` that skips A6. | No settings UI. |
| O41 | `approvals.mode` is `manual` / `smart` / `off` (P0-02 verification). It is not a governed field. No flag invents Ask first / Safe / Full. | No autonomy control. |
| O50 | The chip is `violations` from the effective-policy read for the focused profile, or absent when the flag is false. The menu is `candidates` with `decision: allow` and `in_catalog: true`, not the live-decisions intersection. A write follows section 7.5. | No chip component. |
| O81 | One A1 body is the presence source when `ops.fleet` is true. When it is false, every surface shows the same `unknown`, not a private copy. | No fleet route. |
| G2 | When `ops.policy` is true and the read is coherent, the offer list is allowed catalog candidates: direct `anthropic` `claude-*` ids, `openai`/`openai-codex` Sol and the two variants, `xai`/`xai-oauth` `grok-4.7`. Live Sol does not hide Claude or Grok. Live nous does not empty the menu. Proxy Anthropic and `grok-4.6` never appear in the offer list. | No picker. |
| G32 | Owner is the A5 manifest `actor`. Version is `sequence`. Both require usable `ops.history`. Otherwise unavailable, not invented. | No manifest writer. |
| G34 | Delegation stays read-only. `ops.delegation` false is unavailable, not an empty graph. No write flag enables Save on that node. | No projection route. |
| G36 | Model node uses the same picker and the same validator as G2 and O50. | No node. |
| G40 | Policy badge is a violation on the effective-policy read. New is "changed since last backup" and needs `ops.history`. Unset is not a policy decision. Flag absent: no Policy badge, and no invented pair. A capability warn is not that badge. | No badge component. |
| G58 | Read-only badge is connection kind not `local` (D11). It stays on when write flags are true. | No switcher. |
| G84 | Provider auth is the verified `GET /api/providers/oauth` card (`oauth.py:356`) plus `GET /api/env` `is_set`. Drop `token_preview`. When `ops.policy` is true, allowed providers are flattened `allow[].provider`, cross-checked with allow-decision `candidates` (section 5). No `providers` field. Intersect with providers whose auth status was actually read. When the flag is false, the category is "policy filter unavailable", not an unfiltered catalog labeled P2, and not an empty catalog labeled "nothing connected". | No new auth route. `token_preview` must not reach the renderer. |

## 9. Out of scope

Not in this commit: installing `ops-policy.yaml` under `HERMES_HOME`, editing `status.py`, adding A1–A7, the unblock route, the typed Electron proxy, the transaction wrapper, history, restore, or a client filter. P0 and P0.5 do not implement those. A judge of this card parses the YAML, checks the fields against SPEC section 4.4, and evaluates the tables in sections 3, 7, and 7.5, plus the catalog countermodels in section 5 and the profile table in section 1.1. A missing route in the tree is expected.
