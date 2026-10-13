# Ops panel transaction contract (P0-03 r3)

Status: documentation only. One backend mutation transaction for every Canvas write. This file does not implement the route, does not add `ops-policy.yaml`, and does not edit a profile.
Tree for handler lines: `feat/ops-panel` at `005b104a506`. Node stores are in `storage-map.md`.
SPEC section 11.1 is the authority for the step order. SPEC section 4.2 names a snapshot route. That name is historical. It is not this contract. SPEC section 4.2 item 4 requires secret-bearing backups to be stored hashed and encrypted. Mode `0o600` plus a hash is not that requirement.

Round 2 closed META IMPROVE r1. F2 (absence and byte-exact restore) stays closed in sections 4 and 9. F4 (setup and install versus the write-set) stays closed in section 11. This round does not reopen them.
Round 3 closes META IMPROVE r2. F1a is sections 5 and 6: per-member `before_hash` and `staged_hash` are durable before the first live replace, and recovery of `publishing` and `rolling_back` restores every possibly-touched member to its pre-image. F3 is section 10: secret-bearing staged blobs, journal temporaries, and recovery artifacts use the same OPSBAK1 envelope. F1b is section 7: document, per-file, and composite are different hash domains, and `committed` compares one domain to itself.

## 1. What is frozen

One transaction, inside the backend. The commit is a byte publish of staged bytes under a lock and a journal. It is not a call to the live HTTP endpoint.

Today's handlers still name the store and the semantic transform (`atomic_write_text`, `atomic_yaml_write`, `atomic_config_replace`, `atomic_json_write`, `cron/jobs.py:1592` `atomic_replace`). A5 may use those transforms to compute staged bytes in memory. It must not call the endpoint intact when that endpoint also installs, restarts, hot-serves, records telemetry, or publishes before it scans. Those effects are classified in section 11.

The byte-writer, the profile transaction lock, the journal, and the backup protector are proposed. They are not symbols in this tree. Until `ops.transaction` exists on `/api/status`, Canvas Save stays disabled. There is no degraded write and no plaintext fallback.

Not frozen as code in this commit:

- the route that runs the steps
- `content_hash` on today's GET responses
- `ops.transaction` on `/api/status`

## 2. Rejected designs

These are failures, not alternatives.

Standalone snapshot-then-PUT. A client snapshot followed by `PUT` is not atomic. The file can change between the two calls. SPEC section 11.1 forbids it. Ops must not call a snapshot route as the write path.

Renderer filesystem fallback. The Electron renderer and the main process do not write `SOUL.md`, `config.yaml`, `.env`, `profile.yaml`, `jobs.json`, `webhook_subscriptions.json`, or `SKILL.md` for Canvas. A missing or old backend disables Save. It does not open a file dialog and write.

Client-orchestrated backup. The renderer does not copy files into `backups/ops-panel` and then PUT. Backup is a step inside the backend transaction, after the expected-hash check and before validation.

Calling the live endpoint intact and calling that the commit. `update_config_raw` parses and `save_config` re-serializes (`hermes_cli/web_routers/analytics.py:56`, `hermes_cli/config.py:2495`). `enable_webhooks` restarts (`hermes_cli/web_routers/ops.py:180`). `toggle_toolset` may spawn (`hermes_cli/web_routers/tools.py:333`). `setup_memory_provider` installs (`hermes_cli/web_routers/memory_providers.py:546`). `_guarded_write` publishes and then scans (`tools/skill_manager_tool.py:406`). Wrapping those functions and hoping the side effect waits is not this contract.

Unlocked check, then backup, then replace. A competitor can land between the hash check and the backup. That race is rejected. The lock in section 3 is held across that span.

Plaintext secret backup. Copying `.env` or `config.yaml` with mode `0o600` (`hermes_cli/config.py:503` `_secure_file`, which also swallows `OSError` at `:511`) does not meet SPEC section 4.2 item 4. There is no plaintext fallback if the protector is missing.

Plaintext secret stage. Writing the post-image of a secret-bearing member under `backups/ops-panel` as a raw blob, a journal temporary, or a recovery scratch is the same failure as a plaintext backup. Section 10 covers those artifacts. Missing protector means no stage and no write.

Published-flag recovery. Marking an entry `published` only after replace plus directory fsync, then rolling back only the flagged entries, leaves a member on the new bytes when the process dies between replace and the flag. That design is rejected. The `published` flag is diagnostic. Recovery does not read it (section 6).

Roll-forward from `publishing`. If the journal is `publishing` or `rolling_back`, recovery does not commit the staged bytes, even when every live file already matches `staged_hash`. A kill before journal state `committed` leaves the pre-image after recovery (SPEC section 4.5).

Cross-domain hash compare. `committed` and `normalized` do not compare a document hash to a composite hash, and do not compare a per-file hash to a composite hash. Section 7 names the three domains. An identical SOUL save is `committed` because the document hash equals the per-file hash of `SOUL.md`, not because it equals the composite.

Arbitrary read-back called `normalized`. A hash that merely differs from the submitted document is not success. Section 7 defines the only `normalized` case, and that comparison stays inside one domain.

Two transactions for one node. Model chip (O50) and `PUT /api/profiles/{n}/model` are the same transaction. Prompt save and the G86 note are one transaction (the note is a manifest field, not a second write). Save-all is N transactions, one per dirty node, not one transaction that merges nodes (section 13).

## 3. Lock and CAS (F1)

Exclusion starts before the expected-hash re-read and ends only after the journal state `committed` is durable, or after an abort that published nothing.

Lock order, always this order, skip a lock the write-set does not need:

1. Proposed `ops_txn_lock` for the profile home. File lock at `<profile home>/backups/ops-panel/.txn.lock`. Same process-and-file idiom as `hermes_cli/webhook.py:41` `_subscriptions_lock`. This lock is not a coverage file and is not a node backup.
2. `hermes_cli/config.py:164` `_CONFIG_LOCK` if `config.yaml` is in the write-set. `save_config` takes it at `hermes_cli/config.py:2464`. It is an `RLock`.
3. `hermes_cli/web_routers/_common.py:28` `_CONFIG_MUTATION_LOCK` if `config.yaml` is in the write-set. `config_write_scope` nests it at `hermes_cli/web_routers/_common.py:32`.
4. `hermes_cli/webhook.py:41` `_subscriptions_lock` if `webhook_subscriptions.json` is in the write-set.
5. `cron/jobs.py:289` `_jobs_lock` if `jobs.json` is in the write-set.
6. `tools/skill_manager_tool.py:84` `_skill_lock_path` if a `SKILL.md` is in the write-set.

A5 does not call a live handler that takes these locks in another order. P2 must take `ops_txn_lock` first on every writer of a coverage file before Canvas Save is enabled. Until that wrap exists, the capability flag stays off. A writer that does not take the lock is not a reason to ship Save.

CAS: under the lock, re-read every coverage member and compute the composite hash (section 4). If it does not equal `expected_hash`, return 409. Release the lock. Create no backup directory. Publish nothing.

Re-check the same composite hash immediately before the first live replace, still holding the lock, and only after the journal barrier in section 5 step 6b. If it changed, do not replace. Set the journal to `recovered_preimage` because every live hash still equals `before_hash`, fsync it, and return 409. Secret-bearing blobs already fsynced stay encrypted (section 10). They are not rewritten to plaintext. Do not leave the journal in `publishing` after a clean abort. A competitor who waited on `ops_txn_lock` cannot enter until this transaction finishes or aborts. A competitor who does not take the lock is caught by the pre-publish re-check unless they win the `os.replace` itself (`utils.py:168` `atomic_replace`). That remaining window is why every coverage writer must take the same lock before Save is enabled.

On process start, acquiring `ops_txn_lock` runs recovery (section 6) before any new transaction is accepted.

## 4. Composite hash and absence (F2)

F2 is unchanged this round. Absence is still a tombstone, not a missing-coverage failure. Byte-exact restore is still section 9.

One composite hash covers the whole write-set. This is the composite domain in section 7. It is not the document hash and not a per-file hash. Paths are sorted by relative POSIX path from the profile home. For each path the hash updates, in order:

- the relative path as UTF-8, then a NUL
- `absent` and a NUL, if the path does not exist
- or `present`, a NUL, the mode masked to `0o777` in decimal, a NUL, the raw file bytes, a NUL

Absence is a tombstone. It is not `backup_coverage_missing`. A create is allowed only when the write-set lists that path and `expected_hash` encodes absence for it. The manifest records `pre_image: absent` and no file body.

`backup_coverage_missing` is a different failure: a path the writer would touch that is not in the declared write-set, a present file that cannot be read, a path outside the profile home, or a secret-bearing member the protector cannot encrypt. The last of those is 409, never 500 (section 10).

The editor must not hash a decoded GET body. `get_profile_soul` decodes `utf-8-sig` (`hermes_cli/web_routers/profiles.py:1005`). `get_config_raw` does the same (`hermes_cli/web_routers/analytics.py:48`). The composite input is the raw file bytes, or the absence marker. The backend returns `content_hash` as this composite. That field is proposed. It is not on today's GET.

## 5. The transaction

Order is fixed. A later step does not run if an earlier step fails. The lock from section 3 is already held.

1. Gate. Connection kind is `local` (`apps/desktop/src/global.d.ts:1134` `DesktopConnectionKind`). `remote`, `ssh`, and `cloud` are remote (D11). The kind comes from the Desktop main process, not from a renderer body field. A missing kind is remote. Remote returns 403. No backup, no publish. Delegation has no write at all (`storage-map.md` section 4.10), including on local. Memory setup and opaque `provider.save_config` are disabled here, not gated through.
2. Expected hash. The request carries `expected_hash` (sha256 hex of the composite in section 4). Mismatch is 409. No backup directory. The conflict dialog is section 12.
3. Coverage check. The write-set is the list in `storage-map.md` for that node, not "whatever the endpoint touches if we call it". A missing member, an outside path, or a secret-bearing member without a protector is 409 `backup_coverage_missing`. No directory. No stage. No plaintext file. No publish. Missing protector is this code, not 500.
4. Backup of the pre-image only. See section 10 for secret-bearing members and section 9 for the byte copy of the others. Destination: `<profile home>/backups/ops-panel/<YYYYMMDD-HHMMSS>Z-<node>-<seq>/` (`storage-map.md` section 2). `<seq>` is the manifest `sequence`. If the directory exists, backup fails. Do not overwrite. D10: never prune a fsynced envelope or a fsynced non-secret copy. Disk full is backup failure. An absent member is a tombstone record, not a copied file. This step does not write the post-image. If any copy or encrypt fails, unlink incomplete temps, publish nothing, and return 500 `backup_failed`. A directory with no fsynced envelope and no fsynced copy is removed. A directory that already holds a fsynced envelope is retained, marked not a restore source, and still not published. No plaintext file is written in either case.
5. Compute and validate in memory. Build the post-image bytes in memory (section 9). Parse that memory copy, not the live file, not the pre-image backup, and not a file under the backup directory. Schema for that node, then A6 on governed fields if the mutation touches them (`model.provider`, `model.default`, `fallback_providers`, `auxiliary.*.provider` / `model`). Disallowed selection returns 400. Live files stay as they were. The pre-image backup remains (D10) with `outcome: aborted_validation`. No staged post-image blob is created on this failure. Do not rewrite the backup bytes to make them parse. Do not publish.
6. Persist the stage, then the journal barrier, then publish. Three ordered substeps. A crash cut is named by the last substep that returned.
   - 6a. Persist post-image blobs under the backup directory. Secret-bearing members are OPSBAK1 role `post` (section 10). Other members are byte copies. Fsync each blob. Do not replace a live path in this substep.
   - 6b. Durability barrier. Write `journal.json` with state `publishing` and one entry per write-set member, in sorted path order. Each entry already carries `pre_image`, `before_hash` (per-file), and `staged_hash` (per-file). Fsync `journal.json` and fsync the backup directory. The first live replace is forbidden until this fsync returns. The `published` flag is false on every entry at this barrier.
   - 6c. Publish each member with the byte-writer, in sorted path order. Re-check the composite hash before the first replace (section 3). After each replace and that file's directory fsync, the implementation may set that entry's `published` flag. Recovery does not read the flag. Do not spawn, install, restart, or hot-serve in this step.
7. Read-back. Section 7. Unexpected mismatch is not `normalized`. While the process is still alive and the lock is held, a mismatch rolls back to the pre-image. A crash before step 8 is not this live path; it is recovery (section 6).
8. Commit barrier. Write the manifest with `outcome` `committed` or `normalized`, then set the journal state to `committed`, then fsync the journal and the backup directory. The client is told saved only after that journal fsync returns. Only then run post-commit effects (section 11). A crash before journal state `committed` is durable is not a commit, even if the manifest file was already written. Recovery restores the pre-image and sets the manifest outcome to `recovered_preimage`.

Backup failure at step 4 aborts before any publish and before any post-image stage. The live file is the pre-image. No install, restart, or hot-serve runs. Response is 500 `backup_failed`. The client must not retry until it re-reads.

Validation failure at step 5 aborts before step 6. No post-image blob exists. The pre-image backup stays. Live files unchanged.

A crash during step 6 or before the journal `committed` fsync in step 8 is recovery (section 6), not a guess. The UI says outcome unknown until reconciliation (section 14).

Multi-resource writes stay enabled. The barrier in 6b plus the possibly-touched rule in section 6 is the specified recovery. Disabling multi-resource writes is not required.

## 6. Journal and recovery (F1, F1a)

`journal.json` lives in the backup directory. States: `publishing`, `committed`, `rolling_back`, `recovered_preimage`.

The journal is metadata. It stores paths, states, flags, and hashes. It does not store file bodies, secret values, or ciphertext. A temporary used to write the journal is the same metadata, ACL fail-closed, and is not an envelope. A temporary that would hold secret-bearing member bytes is forbidden unless it is an OPSBAK1 envelope (section 10).

Each entry, all of it durable at step 6b, before the first live replace:

| Field | Domain | Meaning |
|---|---|---|
| `path` |  | relative POSIX path from the profile home |
| `pre_image` |  | `present` or `absent` |
| `before_hash` | per-file | sha256 of the pre-image. This is the pre_hash recovery compares. Absent members use the absence digest in section 7, not a file-body hash. |
| `staged_hash` | per-file | sha256 of the post-image bytes that step 6a persisted. Not a composite. Not the document hash. |
| `pre_blob` |  | pre-image envelope or copy name, or null if `pre_image` is `absent` |
| `staged_blob` |  | post-image envelope or copy name |
| `secret_bearing` |  | boolean |
| `published` |  | diagnostic boolean, false at the barrier. Recovery must not read it. |

Publish order is the sorted relative path. Recovery does not use that order as an already-flagged cursor. It scans every entry.

`created_dirs` lists directories this transaction created. Absence rollback removes one only if it is empty. Never `rmtree`.

Recovery runs under `ops_txn_lock` before any new transaction, and on the next acquire after a crash. It is idempotent and re-runnable. It does not create a new backup directory. It does not roll forward.

Live per-file hash of a path: if the path exists, sha256 of its raw bytes; if it does not exist, the absence digest of that path (section 7). A member is possibly touched when that live hash differs from the entry's `before_hash`. The `published` flag is not part of this predicate. A member whose live bytes are the new post-image, a torn write, or a file that exists where the pre-image was absent, is possibly touched. A member whose live hash already equals `before_hash` is not touched.

- Journal missing, unreadable, or state not yet `publishing`: no live replace was authorized. Do not publish staged blobs. Leave live coverage files alone. Unlink a leftover `*.ops-txn-tmp` beside a coverage path without copying it into `backups/ops-panel`.
- State `committed`: nothing to do. Do not restore.
- State `recovered_preimage`: nothing to do. A second run returns immediately. It does not decrypt again and it does not rewrite a live file.
- State `publishing` or `rolling_back`, including a crash during `rolling_back`: run the procedure below. Both states use it. A crash during `rolling_back` is any kill after the journal has been set to `rolling_back` and before it has been set to `recovered_preimage`. That includes a kill between two member restores, during a restore replace, during a restore fsync, or during the fsync of `recovered_preimage`. There is no in-memory cursor to resume.

Procedure for `publishing` and `rolling_back`:

1. If the state is `publishing`, set `rolling_back` and fsync the journal and the directory before any restore replace. If the state is already `rolling_back`, do not treat that write as a failure. A crash in this fsync leaves one of those two states. The next run enters this same procedure.
2. For each entry, in sorted path order: if the member is not possibly touched, do not rewrite it. If it is possibly touched, restore the pre-image. `pre_image: present`: decrypt the role-`pre` envelope in memory if secret-bearing, or read the non-secret copy, and byte-publish those exact bytes. `pre_image: absent`: unlink the path. Unlink of a path that is already gone is success. Do not write the pre-image plaintext under `backups/ops-panel`.
3. Unlink leftover `*.ops-txn-tmp` beside each coverage path. Do not archive those temps.
4. Re-read every member. If any is still possibly touched, leave Canvas writes for that profile disabled. Do not set `recovered_preimage`. Do not report saved. The next recovery run repeats from step 1 of this procedure.
5. If none are possibly touched, set `recovered_preimage`, set the manifest `outcome` to `recovered_preimage` if a manifest exists, and fsync the journal and the directory. Live bytes equal the pre-image.

A failed decrypt, a failed rollback byte-publish, or a failed unlink of a path that still exists leaves the profile's Canvas writes disabled until a later run succeeds. Do not report saved.

This procedure is how a kill mid-save leaves the original intact after recovery (SPEC section 4.5). Until recovery runs, the UI does not claim either outcome. Running it twice does not append a second mutation: the second run either returns on `recovered_preimage` or finds every live hash already equal to `before_hash` and only writes that state.

The r2 rule that rolled back only entries already marked `published`, and the r2 rule that committed on recovery when every read-back matched `staged_hash`, are withdrawn. Both fail the replace-before-flag cut.

## 7. Hash domains and read-back (F1, F1b)

Three domains. A compare is legal only when both sides name the same domain. Comparing document to composite, or per-file to composite, is a contract bug. It is not `normalized` and not `committed`.

Document domain. sha256 of the editor buffer bytes alone. No path, no NUL, no mode. Used for Prompt (`SOUL.md` body), raw YAML (the editor buffer, not the normalize/strip output), and Skills content (`SKILL.md` body). Null for a key patch that has no whole-document submission (Model keys, Identity keys, Channels keys, one cron job, a toolset flag, a secret key, Memory `provider`).

Per-file domain. One coverage member.

- Present: sha256 of the raw file bytes alone. No path, no mode, no NUL framing.
- Absent: sha256 of the UTF-8 bytes `absent`, then a NUL, then the relative POSIX path. That digest is not a file-body hash. Restore of an absent pre-image is unlink, not a byte compare against a file.

Composite domain. The section 4 running hash of every coverage member. `expected_hash`, `before_composite`, `staged_composite`, and `readback_composite` are this domain. They record the write-set. They do not decide `committed` or `normalized`.

The post-image is computed in memory and validated (step 5) before any staged blob is persisted (step 6a). Hashes of those memory bytes are what step 6b stores. The journal does not hash a file it has not decided to publish.

While the process is alive, after step 6c, re-read the raw bytes and compute each member's read-back per-file hash.

- `committed`: every read-back per-file hash equals that member's `staged_hash`, and either `document_hash` is null or `document_hash` equals the staged per-file hash of the document member (`SOUL.md`, `config.yaml` for raw YAML, or `SKILL.md`). Prompt has no normalize step. Its staged bytes are the editor bytes, so an identical-bytes SOUL save has `document_hash` equal to `files[SOUL.md].staged_hash` and the outcome is `committed`.
- `normalized`: every read-back per-file hash equals that member's `staged_hash`, `document_hash` is not null, `document_hash` differs from the staged per-file hash of the document member, and the node is raw YAML whose staged bytes are the normalize/strip output `save_config` uses (`hermes_cli/config.py:2483`, `:2490`). The UI may say the server normalized. The diff, if shown, is non-secret canonicalization only. This is the only normalized success. Prompt, Skills content, and an identical-bytes raw YAML document are not this outcome.
- Anything else is `readback_mismatch`. It is not `normalized` and not `committed`. While the lock is held and the process is alive, roll back every member to its pre-image (same restore as section 6, not flagged entries only) and return 500. If that rollback fails, outcome is `unknown`, Canvas writes for that profile stay disabled, and the UI must not say saved.

`save_config` stripping defaults is a reason to precompute staged bytes in memory. It is not a reason to accept an arbitrary mismatch, and it is not a reason to compare the editor buffer to the composite.

Example, identical SOUL save, bytes `identical-soul\n`, mode `420`, path `SOUL.md`. Document hash and per-file hash are both `fb695edfab2cbfb65240bcc32f95f02b5434d4cbaa9e60be8610b2f3d1c60b6a`. Composite hash is `c7ac30a74b4a0d2a01f0c52819ae89ff247ee88bf0c1927510da4cd0f730687f`. Those two digests differ. The save still yields `committed`, because the predicate never consults the composite. It does not yield `normalized` or `readback_mismatch`.

## 8. Manifest

`manifest.json` in the backup directory. No secret values. No secret diffs. No protector key. No ciphertext. No file bodies. Hashes of plaintext only.

| Field | Value |
|---|---|
| `schema_version` | `1` |
| `node` | `schedule`, `trigger`, `channels`, `memory`, `identity`, `prompt`, `model`, `tools`, `skills`, `raw_yaml`, `secrets` |
| `profile` | profile name (`default` for root) |
| `object_id` | job id, platform id, skill name, or profile name |
| `endpoint` | the handler path, not a client-invented URL |
| `actor` | `{connection_id, connection_kind, profile, surface: "ops-canvas"}`. No token, no `.env` value, no OS password. Missing `connection_id` fails the gate. |
| `expected_hash` | composite the client sent |
| `before_composite` | composite of the pre-image, including absence markers |
| `staged_composite` | composite of the post-image bytes, or null if aborted before the in-memory compute |
| `readback_composite` | composite after read-back, or null if no publish |
| `document_hash` | document domain, or null |
| `outcome` | `aborted_validation`, `backup_failed`, `committed`, `normalized`, `recovered_preimage`, `readback_mismatch` |
| `files` | one object per coverage member. Fields: relative path, `pre_image` (`present` or `absent`), `mode`, `secret_bearing`, `before_hash` (per-file), `staged_hash` (per-file, null if aborted before staging), `readback_hash` (per-file, null if no publish). Not file bodies in any API response that reaches the renderer. |
| `note` | optional G86 change note for `prompt` only. Plain text. Not written into `SOUL.md`. Not a diff. Not a secret. |
| `sequence` | monotonic per (profile, node). Same integer as the backup directory `<seq>`. This is the Instructions version (G32). |

`files[].before_hash` is the per-member value section 9 restore compares. `before_composite` is not that value. A manifest that omits per-file `before_hash`, `staged_hash`, or `readback_hash` is not a valid commit.

History list returns this manifest minus any field that could carry a secret. It does not return `.env` lines, webhook HMAC secrets, ciphertext, or `redacted_value`. History does not treat a manifest as committed unless the journal state is `committed`.

## 9. Byte-writer and restore semantics (F2)

F2 is unchanged. Proposed `ops_byte_publish(path, bytes, mode)` writes a temp file beside the live path, named `.<filename>.ops-txn-tmp`, fsyncs, and `atomic_replace`s (`utils.py:168`) onto the live path. It does not parse. It does not call `save_config`, `yaml.safe_load`, `atomic_yaml_write` of a re-dumped dict, `atomic_json_write` of a re-parsed object, or `_save_jobs_unlocked` (`cron/jobs.py:1581` re-serializes).

That live-path temp is the product store format. It is not a backup artifact and it is not under `backups/ops-panel`. For a secret-bearing member it is plaintext only because the live store is plaintext. Recovery unlinks it if the replace did not complete, and does not copy it into the backup directory. The staged blob under the backup directory is a different file and, when secret-bearing, is an envelope (section 10).

Absence publish is unlink of that path, not an empty file. If unlink fails, the transaction does not pretend the file is gone. Unlink of an already-absent path, during recovery, is success.

Forward semantic save (Model keys, Identity keys, Channels keys, single cron job, skill disabled-bit, Memory `provider`): compute the post-image in memory, validate it (step 5), persist the stage (step 6a), then publish with the byte-writer. The live file is not passed through `save_config` as the commit. For raw YAML, the staged bytes are the normalize/strip output. Comments, BOM, and CRLF in the editor buffer are not preserved on that forward save. The UI must say so when outcome is `normalized`.

Byte-exact restore does not use that semantic compute. It decrypts in memory if the member is secret-bearing, checks sha256 of that plaintext against `files[].before_hash` of that member (per-file domain), and byte-publishes those exact bytes. It does not look up `before_composite` for this check. Validation parses a copy in memory. A parse failure or an A6 rejection aborts. It does not rewrite the backup and it does not rewrite the live file.

Nodes whose History restore is byte-exact: Prompt `SOUL.md`, Trigger `webhook_subscriptions.json`, Skills `SKILL.md`, raw YAML `config.yaml`, whole-node Schedule `jobs.json`, a memory provider file the original write replaced as a whole. Resource-specific restores (Identity keys when the file already existed, Model assignment, toolset flags, MCP entry, Channels keys, secret keys, single cron job, Memory `provider`) apply only those keys onto the current file, stage that post-image, and byte-publish it. They do not claim byte-exact for the whole shared file.

Restore of a create: if `pre_image` is `absent`, publish is unlink. For Identity, unlink `profile.yaml` only when the live keys are a subset of `description` and `description_auto`. Otherwise 409, no unlink (`hermes_cli/profiles.py:984`). For a skill directory this transaction created, `rmdir` only if empty (`tools/skill_manager_tool.py:479` `skill_dir.rmdir()`, not `rmtree`).

## 10. Encrypted backups and staging (F3)

Secret-bearing class, always encrypted, never a plaintext copy and never a plaintext stage:

- `<home>/.env`
- `<home>/webhook_subscriptions.json` (HMAC secrets, `hermes_cli/web_routers/ops.py:221`)
- `<home>/config.yaml` (inline `api_key` and `delegation.api_key` at `hermes_cli/cli_config_load.py:220`; do not try to detect a secret-free yaml)
- memory provider `config.json` (`hermes_cli/web_routers/memory_providers.py:117`) and the Honcho path (`hermes_cli/web_routers/memory_providers.py:190`)

Not secret-bearing: `SOUL.md`, `profile.yaml`, `cron/jobs.json`, profile-local `SKILL.md`. Those pre-images and staged copies are byte copies with mode preserved. They are still under `backups/ops-panel`, not under `state-snapshots`.

An artifact is any file this transaction creates under `<profile home>/backups/ops-panel/`, including pre-image envelopes, staged post-image envelopes, non-secret copies, `journal.json`, journal temps, `manifest.json`, recovery scratch, and partial temps. The live coverage file is the store, not an artifact. The live-path `*.ops-txn-tmp` is not an artifact. It is unlinked if the replace does not complete, and it is never copied into an artifact.

Invariant: plaintext bytes of a secret-bearing member do not occur in any artifact. This holds after save, after validation abort, at every crash cut before recovery, after recovery, and after restore. The live store may contain the secret. That is not an artifact.

Envelope, proposed, not implemented here. The artifact is not the plaintext. The ciphertext is produced in memory. The first byte written to the backup directory for a secret-bearing member is envelope bytes.

- Magic `OPSBAK1` and a newline.
- Algorithm `AES-256-GCM`.
- 12-byte nonce, ciphertext of the raw file bytes, 16-byte tag.
- AAD is UTF-8 profile name, NUL, relative POSIX path, NUL, role, NUL, plaintext sha256 hex. Role is `pre` for the pre-image backup and `post` for the staged post-image. The tag binds the ciphertext to that identity. A `pre` envelope does not open as `post`, and a `post` envelope does not open as `pre`.

Which artifacts are envelopes, for every secret-bearing member:

- the pre-image backup (role `pre`)
- the staged post-image blob (role `post`)
- a journal temporary or recovery scratch that would otherwise hold that member's bytes (role `pre` if the bytes are the pre-image, role `post` if they are the post-image)
- an incomplete temp of those bytes, which is already ciphertext, never plaintext

The journal document and the manifest do not hold member bytes, so they are not envelopes. They are still ACL fail-closed. Recovery decrypts to memory and byte-publishes to the live path. It does not write a plaintext recovery file under `backups/ops-panel`. If a recovery scratch must touch disk inside that tree, the scratch is an envelope, retained under D10, and not a second plaintext copy.

Staged-blob lifecycle under D10:

- A post-image blob is written only after step 5 validation succeeds.
- Validation abort: no post-image blob exists. The pre-image envelope, if step 4 finished, stays. It is not pruned.
- Once a pre-image or post-image envelope is fsynced, it is retained. Ops does not prune it and does not rewrite it to plaintext.
- A failed write unlinks only an incomplete temp that is not yet a final envelope name. That temp is ciphertext if it exists.
- Missing protector: step 3 returns 409 `backup_coverage_missing` before the backup directory is created. Step 6a does not run. There is no stage and no write. A later step that rediscovers a missing protector uses the same 409, not 500, and still writes no plaintext.
- Encrypt or ACL failure when the protector exists: 500 `backup_failed`. No publish. No plaintext artifact.

Protector key:

- Backend only. Not in the manifest, not in History, not in renderer IPC, not in the profile home (a profile copy must not include the key).
- On this contract's target (Windows, SPEC section 0) the key blob is DPAPI `CryptProtectData` for the current user, at `%LOCALAPPDATA%\hermes\ops-panel\backup-protector.dpapi`. That path is proposed. This card does not create it.
- Unprotect happens only in the backend process. The renderer never receives the key or the plaintext backup.
- If the blob is missing, DPAPI fails, or this is not Windows, the protector is missing. Do not invent a raw key file. Do not fall back to a plaintext copy. Do not fall back to a plaintext stage.

Integrity: verify the GCM tag and the AAD role before any restore publish. Tag failure or role mismatch aborts the restore. Live files stay. No mutation.

ACL, fail-closed, on the key blob and on every envelope, including staged post-image envelopes and envelope temps: inheritance disabled, current user full control, other SIDs removed. Mode `0o600` is necessary and not sufficient. `_secure_file` (`hermes_cli/config.py:503`) chmods and swallows errors (`:511`). A5 must not treat that helper as the protector. If the ACL cannot be applied, the step is `backup_failed` and nothing is published.

Decrypt on restore is backend-only. Recovered plaintext must match `files[].before_hash` before publish. The response to the renderer is still names and set/unset, never the bytes.

## 11. Write-set versus post-commit (F4)

F4 is unchanged. The transaction is the write-set plus the journal. Effects below are not coverage. They run only after the journal `committed` fsync in step 8. They do not run on `backup_failed`, validation abort, a 409, or recovery of `publishing` / `rolling_back`. Their failure does not roll back the committed files and is not reported as `backup_failed` or as a failed save.

| Endpoint | Primitive | Write-set | After commit only | Canvas Save |
|---|---|---|---|---|
| Schedule job routes `hermes_cli/web_routers/cron.py:683` | `cron/jobs.py:1566` adapted to staged bytes | holding `jobs.json` | none for the in-process ticker (`hermes_cli/web_server_cron.py:183`) | allowed only if the scheduler is in-process; external reconcile (`hermes_cli/web_server_cron.py:176`) disables the write. Do not call `create_job_with_scheduler_registration` (`hermes_cli/web_server_cron.py:164`) |
| Trigger create/delete/route enable | `hermes_cli/webhook.py:72` adapted; do not re-serialize on restore | `webhook_subscriptions.json` | file is hot-reloaded by readers (`hermes_cli/web_routers/ops.py:273`); the transaction does not restart | allowed |
| Trigger platform enable `hermes_cli/web_routers/ops.py:172` | `_write_platform_enabled` (`hermes_cli/web_server_messaging.py:326`) | `config.yaml`, plus the subscriptions file if it also changes | `_restart_gateway_after` (`hermes_cli/web_routers/ops.py:180`) | allowed; do not call the endpoint intact |
| Channels `hermes_cli/web_routers/messaging.py:883` | `hermes_cli/config.py:2763` `save_env_value` and `hermes_cli/web_routers/messaging.py:927` | `.env` and `config.yaml` if `enabled` is set; both or neither | `_notify_multiplexer_hot_serve` (`hermes_cli/web_routers/messaging.py:941`) | allowed; do not call the endpoint intact |
| Memory provider select `hermes_cli/web_routers/ops.py:507` | `save_config` of `memory.provider` only, staged | `config.yaml` | none | allowed |
| Memory declared config `hermes_cli/web_routers/memory_providers.py:308` | flat or Honcho writer (`:309`) plus optional `.env` (`:134`) | provider file, `.env` if a secret is submitted, `config.yaml` if the provider name is written | `_invalidate_plugins_hub_cache` (`hermes_cli/web_routers/memory_providers.py:564`) | allowed only if every path is inside the profile home |
| Memory setup `hermes_cli/web_routers/memory_providers.py:528` | persist then `_install_memory_provider_setup` (`:384`, called at `:546`) | not a Canvas write-set | install is not a Canvas post-commit effect | disabled |
| Memory `provider.save_config` `hermes_cli/web_routers/memory_providers.py:456` | opaque | not enumerable | none | disabled. Do not infer coverage from a returned path |
| Tools toggle `hermes_cli/web_routers/tools.py:280` | `save_config` of the toolset keys, staged | `config.yaml` | spawn at `hermes_cli/web_routers/tools.py:333`. `POST` post-setup at `hermes_cli/web_routers/tools.py:631` is not a Canvas save | allowed; do not call the endpoint intact |
| Tools env `hermes_cli/web_routers/tools.py:590` | `save_env_value` | `.env` | none | allowed |
| MCP add `hermes_cli/web_routers/mcp.py:110` | `hermes_cli/mcp_config.py:233` `_save_mcp_server`; bearer at `:336` | `config.yaml`, plus `.env` if a bearer is submitted | `record_mcp_install` (`hermes_cli/web_routers/mcp.py:143`, `hermes_cli/mcp_catalog.py:735`) | allowed; telemetry is not coverage |
| Skills toggle `hermes_cli/web_routers/skills.py:379` | `hermes_cli/skills_config.py:43` | `config.yaml` | none | allowed |
| Skills content `hermes_cli/web_routers/skills.py:418` and `:433` | scan staged dir via `tools/skill_manager_tool.py:50`, then byte-publish. Do not call `_guarded_write` (`tools/skill_manager_tool.py:395`) | `SKILL.md`, plus a created empty skill dir if this transaction created it | prompt-cache clear (`hermes_cli/web_routers/skills.py:429`) | allowed when the file is under the profile home |
| Identity `hermes_cli/web_routers/profiles.py:1035` | staged merge of description keys | `profile.yaml` | none | allowed; create records a tombstone |
| Prompt `hermes_cli/web_routers/profiles.py:1013` | byte-publish of the editor bytes | `SOUL.md` | none | allowed |
| Model `hermes_cli/web_routers/profiles.py:1049` | staged model assignment | `config.yaml` | none | allowed. Not `hermes_cli/web_routers/models.py:376` |
| Raw YAML `hermes_cli/web_routers/analytics.py:53` | semantic forward save; byte-exact restore | `config.yaml` | approvals broadcast (`hermes_cli/web_routers/analytics.py:67`) | allowed |
| Secrets `hermes_cli/web_routers/config_env.py:328` | staged `.env`, plus `config.yaml` if a mirror changes (`:330`) | those files, or the write is disabled | none | allowed only when the write-set is fully listed |
| Delegation | none | none | none | refused |

## 12. Conflict

409 at step 2. Body: `{conflict: true, current_hash}`. `current_hash` is the composite. No `current` secret bytes. For non-secret resources the client may re-GET and diff. For secret-bearing coverage the client re-GETs set/unset only and offers Keep mine / Take theirs without a value diff.

Keep mine: a new transaction whose `expected_hash` is `current_hash` and whose body is the editor buffer. Not a resume.

Take theirs: discard the buffer and render the re-GET. No write.

Diff: allowed for `SOUL.md`, `profile.yaml` description, skill `SKILL.md`, and non-secret `config.yaml` keys. Forbidden for `.env`, `webhook_subscriptions.json`, MCP bearer tokens, memory-provider secrets, and `delegation.api_key`. A config.yaml diff redacts `api_key` and any `«redacted:` sentinel before IPC.

## 13. Save, dirty, Save all (G57)

Each writable node has its own dirty bit, Save, and Discard. Discard drops the buffer. It does not write and does not create a backup.

Save runs one transaction for that node. The button is disabled at zero dirty nodes. Header "Save all (n)" runs one transaction per dirty node, in this order: Schedule, Trigger, Channels, Memory, Identity, Prompt, Model, Tools, Skills, raw YAML. Secrets edited from O42 are their own node. Delegation is never in the list. Memory setup is never in the list.

A failure does not roll back a sibling that already committed. The header count is the nodes still dirty. A 409 on one node does not cancel the others that have not started. Do not start the next node until the current one returns or the socket drops (section 14).

G32 owner is `actor` of the latest `committed` or `normalized` Prompt manifest. Version is `sequence`.

G86 note is sent only with the Prompt transaction. Empty note is allowed. It is not required for Save to enable.

## 14. Disconnect

If the socket drops after the request is sent and before a terminal response, the UI shows "outcome unknown". It does not show "saved". It does not show "original intact". It does not enable Undo that writes.

Reconciliation, when the connection is back, compares composite to composite. It does not compare the editor document hash to the composite.

1. Re-GET the node's coverage hash (and set/unset for secrets). The hash is the composite in section 4, computed by the backend.
2. Compare that composite to the pre-image composite the editor held, and to `staged_composite` if the client still has it.
3. Unchanged from the pre-image composite, including after `recovered_preimage`: the transaction aborted or was rolled back. Buffer stays dirty. Offer Save again.
4. Equal to `staged_composite`, and the journal state is `committed` with manifest outcome `committed` or `normalized`: clear dirty. Refresh History. `normalized` still means section 7, not "any difference".
5. Neither: conflict (section 12). Do not auto-retry the PUT.

Save-all: each node that was in flight is reconciled on its own. Nodes not yet sent stay dirty and are not assumed saved.

## 15. Restore

Restore is a mutation. It runs section 5. It is not a copy from the History drawer onto disk in the renderer.

The request is `{backup_id, expected_hash}` where `expected_hash` is the live composite hash, not the backup's hash. Step 4 therefore backs up the current live bytes before any replace. A backup failure aborts the restore. The live file stays. The chosen history entry stays.

Byte-exact and resource-specific rules are section 9. The byte-exact check uses `files[].before_hash` for that member. A6 runs on restore. Putting back a disallowed model is a selection and is blocked (D13), even if those bytes were once on disk. An unrelated edit on a profile that already violates policy still warns and proceeds. Restore of the violating governed fields does not count as unrelated.

Delegation has no restore action. A raw-YAML restore may change the `delegation` block because it restores the whole `config.yaml`. That does not add a Save button to the Delegation node.

Secret restore: the renderer sends `backup_id` only. The backend decrypts in memory. The response is `{key, is_set}`. No before/after values. The new pre-image backup created by step 4 is an envelope. The history entry being restored stays an envelope.

## 16. Remote Canvas (D11)

`DesktopConnectionKind` is `cloud | local | remote | ssh` (`apps/desktop/src/global.d.ts:1134`). Canvas writes require `local`.

The renderer hides Save, Discard-that-writes, History restore, secret set/clear, and raw YAML save when the active connection is not local. Hiding is not the gate. Step 1 is the gate. A tunneled loopback still counts as remote if the Desktop connection kind is not `local`.

Reads stay allowed. Secret reads on a remote connection are still names and set/unset only. `POST /api/env/reveal` (`hermes_cli/web_routers/config_env.py:1086`) is not an Ops call on any connection kind.

## 17. Secrets on the renderer

O42 and every secret-bearing node:

- Renderer receives `{name or key, is_set}` and, for non-secret allowlist ids only, the id list (`hermes_cli/web_routers/messaging.py:143`).
- Renderer does not receive raw values, `redacted_value` (`hermes_cli/web_routers/config_env.py:279`, `hermes_cli/web_routers/_common.py:127`), reveal plaintext (`hermes_cli/web_routers/config_env.py:1086`), webhook create `secret` (`hermes_cli/web_routers/ops.py:242`), backup plaintext, staged plaintext, the protector key, or a diff of those.
- Main process strips those fields before IPC even if the dashboard route still returns them. This card does not change those routes.
- A write of a `«redacted:` preview is already refused (`hermes_cli/web_routers/_common.py:122`). Ops must not send one.

## 18. Coverage disables the write

If step 3 cannot name and copy or tombstone every path in the write-set, the write does not run. Concrete cases:

| Case | Why coverage is missing | Result |
|---|---|---|
| Skill `SKILL.md` resolved outside the profile home | bundled or external dir (`tools/skill_manager_tool.py:268`) | content write disabled; toggle still allowed if `config.yaml` copies |
| External cron scheduler | remote registry is not `jobs.json` (`hermes_cli/web_server_cron.py:176`) | Schedule write disabled |
| Memory setup or opaque `save_config` | install or unknown write-set (`hermes_cli/web_routers/memory_providers.py:528`, `:456`) | that route disabled |
| Honcho path outside the profile home | not under the backup root | that provider's config write disabled |
| Protector missing | section 10 | 409 `backup_coverage_missing`, not 500. No directory, no stage, no plaintext, no mutation. Every secret-bearing write disabled |
| Protector present but ACL or encrypt fails | section 10 | 500 `backup_failed`. No plaintext artifact. No mutation |
| Toolset or channel request that needs `.env` and did not declare it | partial coverage | whole request disabled |
| Webhook enable, tool post-setup, or channel hot-serve before commit or on `backup_failed` | side effect ahead of step 8 | those commands do not run; live files unchanged if backup failed |

A disabled write is a 409 the UI shows as "Save unavailable: backup cannot cover this file". It is not a cue to write from the renderer.

## 19. Walks

Each walk uses section 5. None is a snapshot followed by PUT. None writes from the renderer. These are contract walks, not A5 fault injection. A5 is not in this tree.

Conflict. Editor read Prompt, composite H1. Another writer lands H2 before the lock. Save sends `expected_hash=H1`. Step 2 returns 409. No directory under `backups/ops-panel`. `SOUL.md` is still H2. Keep mine is a new transaction with `expected_hash=H2`. Take theirs re-GETs and does not write.

Competitor between hash and backup. Transaction A holds `ops_txn_lock`, re-reads H1, and has not backed up yet. Transaction B blocks on the same lock. It cannot write H2 into the backup A is about to take. If a writer that does not take the lock changes the file after the check and before publish, the pre-publish re-check sees the new hash, aborts, and publishes nothing. The rejected design (check, drop the lock, backup, replace) is the one where B's bytes get copied and then overwritten. That design is not this contract.

F1a cuts. Channels write-set is `.env` then `config.yaml`. Pre-image bytes are `old-env` and `old-yaml`. Post-image bytes are `new-env` and `new-yaml`. Journal at step 6b already stores both `before_hash` values and both `staged_hash` values, and both `published` flags are false. Recovery ignores the flags. Final live bytes equal the pre-image on every cut, including a second recovery run.

| Cut | Journal | Live `.env` | Live `config.yaml` | Flags | After recovery | Second run |
|---|---|---|---|---|---|---|
| Before replace | `publishing`, barrier fsynced, no replace yet | `old-env` | `old-yaml` | false, false | both old; neither member is possibly touched | no rewrite |
| After replace, before that file's fsync | `publishing` | `new-env`, or torn, or still `old-env` | `old-yaml` | false, false | if `.env` differs from `before_hash`, restore it; `config.yaml` stays old | no rewrite |
| After fsync, before flag | `publishing` | `new-env` | `old-yaml` | false, false | restore `.env` to `old-env`. The false flag is not consulted. `preimage_restored` is true | state `recovered_preimage`, no second replace |
| Mid-rollback | `rolling_back` | `old-env` already restored | `new-yaml` | ignored | restore `config.yaml`; skip `.env` because it already equals `before_hash` | no rewrite |
| Recovery run twice | first run ends `recovered_preimage` | `old-env` | `old-yaml` | ignored | already the pre-image | returns immediately; live still the pre-image |

The r2 countermodel (flags false/false, recovery leaves `.env` new and `config.yaml` old, `preimage_restored` false) is a contract failure. It is not the outcome of the table above.

Crash during `rolling_back`. Recovery has set `rolling_back`, restored `.env`, and dies before `config.yaml` is restored or before the `recovered_preimage` fsync. The next run does not resume a memory cursor. It classifies `config.yaml` as possibly touched and `.env` as not touched, restores only `config.yaml`, then sets `recovered_preimage`. Live equals the pre-image. A further run does not decrypt and does not replace.

Crash before the commit barrier. Both files match their staged hashes and both flags are true, but the journal is not yet `committed`. Recovery does not roll forward and does not write a committed manifest. It restores both members to the pre-image and sets `recovered_preimage`. It does not leave `.env` new and `config.yaml` old.

Unexpected read-back, process still alive. Staged per-file hash was S. Read-back per-file hash is not S, and this is not the raw-YAML same-domain normalize case. Outcome is not `normalized`. Rollback every member to the pre-image, flags ignored. If rollback fails, `unknown`, and further Canvas writes on that profile stay disabled.

Backup failure. Hash matches. Step 4 cannot create the directory, cannot encrypt, or cannot apply the ACL. Response 500 `backup_failed` when the protector exists. No post-image stage. No publish. No install. No restart. No hot-serve. Live bytes are the pre-image. No plaintext artifact.

Validation abort. Model save, hash matches, encrypted pre-image of `config.yaml` succeeds, A6 rejects `grok-4.6` or `provider: openrouter` with a claude model (SPEC section 4.4). Step 5 fails in memory. No post-image blob is written. No publish. Pre-image backup remains `aborted_validation`. Live model keys unchanged. `gpt-6.1-sol-pro` passes A6 and continues to step 6. Validation parsed a memory copy. It did not rewrite the backup.

Create absent, then restore. `SOUL.md` does not exist (`hermes_cli/web_routers/profiles.py:1003`). `expected_hash` encodes absence. `before_hash` for that member is the absence digest, not a file-body hash. Create byte-publishes the new file. Manifest `files[].pre_image` is `absent`. Restore sends the live hash. Step 4 backs up the current file first. Publish is unlink, not an empty file. After unlink the composite encodes absence. The same walk applies to a missing `profile.yaml` (`hermes_cli/profiles.py:983`) when no other keys exist, and to a missing `SKILL.md` (`tools/skill_manager_tool.py:453`) plus an empty created directory removed with `rmdir`. If Identity unlink would drop `role` or `display_name`, restore is 409 and the file stays.

BOM, CRLF, comments, JSON whitespace. Pre-image `config.yaml` has a BOM, CRLF, and comments. Pre-image `jobs.json` has insignificant whitespace. Backup of `config.yaml` is an envelope; decrypting it in memory yields the same per-file sha256 as `files[].before_hash`. A forward raw YAML save does not preserve those bytes: staged bytes are the `save_config` normalize/strip output (`hermes_cli/config.py:2483`). That forward save is `normalized` only when the document-domain hash differs from that staged per-file hash. It is not a restore. Restore of the backup byte-publishes the decrypted pre-image. It does not call `update_config_raw` (`hermes_cli/web_routers/analytics.py:56`) or `save_config`. The published sha256 equals `files[].before_hash`, BOM and comments included. Whole-node `jobs.json` restore byte-publishes the backup bytes. It does not call `_save_jobs_unlocked` (`cron/jobs.py:1581`). sha256 equals `files[].before_hash`, whitespace included.

Identical-bytes SOUL save. Editor bytes are `identical-soul\n`. Document hash `fb695edfab2cbfb65240bcc32f95f02b5434d4cbaa9e60be8610b2f3d1c60b6a` equals `files[SOUL.md].staged_hash` and the read-back per-file hash. Composite `c7ac30a74b4a0d2a01f0c52819ae89ff247ee88bf0c1927510da4cd0f730687f` is different and is not consulted. Outcome is `committed`, not `normalized`, not `readback_mismatch`.

Byte-exact restore finds the member hash. The history manifest for that SOUL backup has `files[SOUL.md].before_hash` equal to sha256 of the pre-image bytes. Restore decrypts only if the member is secret-bearing, compares that per-file digest, and publishes. A compare against `before_composite` is not the check. If the per-file digest is missing, restore aborts and the live file stays.

Missing protector. Secret-bearing save, protector blob missing or DPAPI fails. Step 3 returns 409 `backup_coverage_missing`. It does not reach step 4 and it does not reach step 6a. No backup directory. No staged blob. No plaintext file under `backups/ops-panel`. Live `.env` and `config.yaml` are unchanged. No restart. No hot-serve. The same request is not 500.

No install or restart before commit, and none on `backup_failed`. Memory setup is not in the Save list, so `_install_memory_provider_setup` (`hermes_cli/web_routers/memory_providers.py:384`) does not run. Tool post-setup (`hermes_cli/web_routers/tools.py:333`) and webhook restart (`hermes_cli/web_routers/ops.py:180`) run only after journal `committed`. If backup fails, or recovery restores the pre-image, they do not run. A later install failure does not roll back a commit that already fsynced.

Disconnect. Client sent Prompt save and the socket died. UI says outcome unknown. On reconnect, re-GET the composite hash. Equal to the pre-image composite: still dirty. Equal to `staged_composite` and the journal is `committed`: dirty cleared. Anything else: conflict. No assumption that the original is intact before recovery has run. The document hash is not compared to the composite in this check.

Remote. Connection kind `remote`. Save is not sent. If a client sends it anyway, step 1 returns 403. No backup directory. Same for `ssh` and `cloud`.

Secret. Channels save. Renderer never receives the value or a diff. Pre-image and post-image artifacts are envelopes, not `0o600` copies. Response after commit is `{key, is_set}`. History shows hashes and actor, not ciphertext and not a diff. `POST /api/env/reveal` is not called. Restore sends `backup_id` only.

Fixture secret absent from artifacts. The fixture plaintext is the bytes `OPS-P0-03-FIXTURE-SECRET`. It is inside the pre-image and the post-image of `.env` and `config.yaml`. After a committed save, after a validation abort, at each F1a crash cut before recovery, after recovery, and after restore: a scan of every file under that transaction's `backups/ops-panel` directory finds those bytes in no file. Journal and manifest contain hashes only. Staged and pre-image files are `OPSBAK1` envelopes whose AAD role is `post` or `pre`. Recovery does not write a plaintext scratch there. A missing protector produces no directory, so the scan has nothing to hit. The live `.env` may contain the fixture. That file is the store, not an artifact.

## 20. Out of scope for this card

Not implemented: the transaction wrapper, the byte-writer, the protector, History routes, A6, `ops-policy.yaml`, capability flags. Not edited: any file under a Hermes profile home, `backup.py`'s pruner, existing dashboard routes. `POST /api/model/set`, profile rename, profile delete, `POST /api/memory/reset`, memory setup, and cron trigger stay as they are and are not Canvas saves.
