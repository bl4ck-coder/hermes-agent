# Ops panel transaction contract (P0-03 r2)

Status: documentation only. One backend mutation transaction for every Canvas write. This file does not implement the route, does not add `ops-policy.yaml`, and does not edit a profile.
Tree for handler lines: `feat/ops-panel` at `005b104a506`. Node stores are in `storage-map.md`.
SPEC section 11.1 is the authority for the step order. SPEC section 4.2 names a snapshot route. That name is historical. It is not this contract. SPEC section 4.2 item 4 requires secret-bearing backups to be stored hashed and encrypted. Mode `0o600` plus a hash is not that requirement.

Round 2 closes META IMPROVE r1. F1 is sections 3, 6, and 7. F2 is sections 4 and 9. F3 is section 10. F4 is section 11.

## 1. What is frozen

One transaction, inside the backend. The commit is a byte publish of staged bytes under a lock and a journal. It is not a call to the live HTTP endpoint.

Today's handlers still name the store and the semantic transform (`atomic_write_text`, `atomic_yaml_write`, `atomic_config_replace`, `atomic_json_write`, `cron/jobs.py:1592` `atomic_replace`). A5 may use those transforms to compute staged bytes. It must not call the endpoint intact when that endpoint also installs, restarts, hot-serves, records telemetry, or publishes before it scans. Those effects are classified in section 11.

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

Arbitrary read-back called `normalized`. A hash that merely differs from the submitted document is not success. Section 7 defines the only `normalized` case.

Two transactions for one node. Model chip (O50) and `PUT /api/profiles/{n}/model` are the same transaction. Prompt save and the G86 note are one transaction (the note is a manifest field, not a second write). Save-all is N transactions, one per dirty node, not one transaction that merges nodes (section 13).

## 3. Lock and CAS (F1)

Exclusion starts before the expected-hash re-read and ends only after the manifest is durable, or after an abort that published nothing.

Lock order, always this order, skip a lock the write-set does not need:

1. Proposed `ops_txn_lock` for the profile home. File lock at `<profile home>/backups/ops-panel/.txn.lock`. Same process-and-file idiom as `hermes_cli/webhook.py:41` `_subscriptions_lock`. This lock is not a coverage file and is not a node backup.
2. `hermes_cli/config.py:164` `_CONFIG_LOCK` if `config.yaml` is in the write-set. `save_config` takes it at `hermes_cli/config.py:2464`. It is an `RLock`.
3. `hermes_cli/web_routers/_common.py:28` `_CONFIG_MUTATION_LOCK` if `config.yaml` is in the write-set. `config_write_scope` nests it at `hermes_cli/web_routers/_common.py:32`.
4. `hermes_cli/webhook.py:41` `_subscriptions_lock` if `webhook_subscriptions.json` is in the write-set.
5. `cron/jobs.py:289` `_jobs_lock` if `jobs.json` is in the write-set.
6. `tools/skill_manager_tool.py:84` `_skill_lock_path` if a `SKILL.md` is in the write-set.

A5 does not call a live handler that takes these locks in another order. P2 must take `ops_txn_lock` first on every writer of a coverage file before Canvas Save is enabled. Until that wrap exists, the capability flag stays off. A writer that does not take the lock is not a reason to ship Save.

CAS: under the lock, re-read every coverage member and compute the composite hash (section 4). If it does not equal `expected_hash`, return 409. Release the lock. Create no backup directory. Publish nothing.

Re-check the same hash immediately before the first publish, still holding the lock. If it changed, abort the same way, including deleting a staged directory that has not published. A competitor who waited on `ops_txn_lock` cannot enter until this transaction finishes or aborts. A competitor who does not take the lock is caught by the pre-publish re-check unless they win the `os.replace` itself (`utils.py:168` `atomic_replace`). That remaining window is why every coverage writer must take the same lock before Save is enabled.

On process start, acquiring `ops_txn_lock` runs recovery (section 6) before any new transaction is accepted.

## 4. Composite hash and absence (F2)

One hash covers the whole write-set. Paths are sorted by relative POSIX path from the profile home. For each path the hash updates, in order:

- the relative path as UTF-8, then a NUL
- `absent` and a NUL, if the path does not exist
- or `present`, a NUL, the mode masked to `0o777` in decimal, a NUL, the raw file bytes, a NUL

Absence is a tombstone. It is not `backup_coverage_missing`. A create is allowed only when the write-set lists that path and `expected_hash` encodes absence for it. The manifest records `pre_image: absent` and no file body.

`backup_coverage_missing` is a different failure: a path the writer would touch that is not in the declared write-set, a present file that cannot be read, a path outside the profile home, or a secret-bearing member the protector cannot encrypt.

The editor must not hash a decoded GET body. `get_profile_soul` decodes `utf-8-sig` (`hermes_cli/web_routers/profiles.py:1005`). `get_config_raw` does the same (`hermes_cli/web_routers/analytics.py:48`). The hash input is the raw file bytes, or the absence marker. The backend returns `content_hash`. That field is proposed. It is not on today's GET.

## 5. The transaction

Order is fixed. A later step does not run if an earlier step fails. The lock from section 3 is already held.

1. Gate. Connection kind is `local` (`apps/desktop/src/global.d.ts:1134` `DesktopConnectionKind`). `remote`, `ssh`, and `cloud` are remote (D11). The kind comes from the Desktop main process, not from a renderer body field. A missing kind is remote. Remote returns 403. No backup, no publish. Delegation has no write at all (`storage-map.md` section 4.10), including on local. Memory setup and opaque `provider.save_config` are disabled here, not gated through.
2. Expected hash. The request carries `expected_hash` (sha256 hex of section 4). Mismatch is 409. No backup directory. The conflict dialog is section 12.
3. Coverage check. The write-set is the list in `storage-map.md` for that node, not "whatever the endpoint touches if we call it". A missing member, an outside path, or a secret-bearing member without a protector is 409 `backup_coverage_missing`. No publish.
4. Backup. See section 10 for secret-bearing members and section 9 for the byte copy of the others. Destination: `<profile home>/backups/ops-panel/<YYYYMMDD-HHMMSS>Z-<node>-<seq>/` (`storage-map.md` section 2). `<seq>` is the manifest `sequence`. If the directory exists, backup fails. Do not overwrite. D10: never prune. Disk full is backup failure. An absent member is a tombstone record, not a copied file. If any copy or encrypt fails, delete the incomplete directory, publish nothing, return 500 `backup_failed`.
5. Validate. Parse a memory copy of the staged post-image, not the live file and not the backup bytes. Schema for that node, then A6 on governed fields if the mutation touches them (`model.provider`, `model.default`, `fallback_providers`, `auxiliary.*.provider` / `model`). Disallowed selection returns 400. Live files stay as they were. The backup remains (D10) with `outcome: aborted_validation`. Do not rewrite the backup bytes to make them parse. Do not publish.
6. Stage and publish. Compute the post-image bytes (section 9). Write them under the backup directory as staged blobs. Write `journal.json` with state `publishing` and one entry per write-set member, in sorted path order, before the first live replace. Then publish each member with the byte-writer. Mark each entry `published` only after that replace and its directory fsync. Do not spawn, install, restart, or hot-serve in this step.
7. Read-back. Section 7. Unexpected mismatch is not `normalized`.
8. Manifest commit. Set `outcome` to `committed` or `normalized`, fsync the manifest, then set the journal to `committed`. Only then run post-commit effects (section 11).

Backup failure at step 4 aborts before any publish. The live file is the pre-image. No manifest is published. No install, restart, or hot-serve runs. Response is 500 `backup_failed`. The client must not retry until it re-reads.

Validation failure at step 5 aborts the publish. The pre-image backup stays. Live files unchanged.

A crash during step 6 or before step 8 is recovery (section 6), not a guess. The UI says outcome unknown until reconciliation (section 14).

## 6. Journal and recovery (F1)

`journal.json` lives in the backup directory. States: `publishing`, `committed`, `rolling_back`, `recovered_preimage`.

Each entry: relative path, `pre_image` (`present` or `absent`), staged blob name, `published` boolean. Publish order is the sorted relative path. The same order is the rollback order, reversed.

Recovery runs under `ops_txn_lock` before any new transaction, and on the next acquire after a crash.

- Journal missing, or state still before `publishing`: nothing was published. Leave the live files alone.
- State `publishing` and at least one entry is not `published`: roll back every entry already marked `published` to its pre-image. Present pre-image: byte-publish those backup bytes (decrypt first if secret-bearing). Absent pre-image: unlink the path. Do not roll forward the remaining entries. Then set state `recovered_preimage`. Live bytes equal the pre-image. A failed unlink or failed rollback byte-publish leaves the profile's Canvas writes disabled until recovery succeeds. Do not report saved.
- All entries `published` and the manifest is not yet `committed` or `normalized`: read back every member. If every read-back equals its staged hash, write the manifest `committed` or `normalized` as section 7 already computed, and set the journal `committed`. If any read-back differs, roll back every member to its pre-image and set `recovered_preimage`. Do not leave `.env` new and `config.yaml` old.
- State `committed`: nothing to do.

This is how a kill mid-save leaves the original intact after recovery (SPEC section 4.5). Until recovery runs, the UI does not claim either outcome.

Created directories recorded on the journal (`created_dirs`) are removed on absence rollback only if they are empty. Never `rmtree`.

## 7. Read-back (F1)

Before the first publish, the backend computes `staged_hash` as the sha256 of the exact bytes that will be published for each member, and the composite of those bytes. `submitted_hash` is the sha256 of the editor document when the node has one (raw YAML text, SOUL body, SKILL.md body). It is null for a key patch that has no whole-document submission.

After publish, re-read the raw bytes.

- `committed`: every read-back equals its staged bytes, and `staged_hash` equals `submitted_hash` or `submitted_hash` is null.
- `normalized`: every read-back equals its staged bytes, and `staged_hash` differs from `submitted_hash` because the semantic compute applied the same normalize/strip `save_config` uses (`hermes_cli/config.py:2483`, `:2490`). The UI may say the server normalized. The diff, if shown, is non-secret canonicalization only. This is the only normalized success.
- Anything else is `readback_mismatch`. It is not `normalized` and not `committed`. While the lock is held, roll back to the pre-image (section 6) and return 500. If rollback fails, outcome is `unknown`, Canvas writes for that profile stay disabled, and the UI must not say saved.

`save_config` stripping defaults is a reason to precompute staged bytes. It is not a reason to accept an arbitrary mismatch.

## 8. Manifest

`manifest.json` in the backup directory. No secret values. No secret diffs. No protector key. No ciphertext. Hashes of plaintext only.

| Field | Value |
|---|---|
| `schema_version` | `1` |
| `node` | `schedule`, `trigger`, `channels`, `memory`, `identity`, `prompt`, `model`, `tools`, `skills`, `raw_yaml`, `secrets` |
| `profile` | profile name (`default` for root) |
| `object_id` | job id, platform id, skill name, or profile name |
| `endpoint` | the handler path, not a client-invented URL |
| `actor` | `{connection_id, connection_kind, profile, surface: "ops-canvas"}`. No token, no `.env` value, no OS password. Missing `connection_id` fails the gate. |
| `expected_hash` | composite sha256 the client sent |
| `before_hash` | composite sha256 of the pre-image, including absence markers |
| `staged_hash` | composite sha256 of the bytes to publish, or null if aborted before staging |
| `readback_hash` | composite sha256 after read-back, or null if no publish |
| `outcome` | `aborted_validation`, `committed`, `normalized`, `recovered_preimage`, `readback_mismatch` |
| `files` | relative path, `pre_image` (`present` or `absent`), `mode`, `secret_bearing` boolean. Not file bodies in any API response that reaches the renderer. |
| `note` | optional G86 change note for `prompt` only. Plain text. Not written into `SOUL.md`. Not a diff. Not a secret. |
| `sequence` | monotonic per (profile, node). Same integer as the backup directory `<seq>`. This is the Instructions version (G32). |

History list returns this manifest minus any field that could carry a secret. It does not return `.env` lines, webhook HMAC secrets, ciphertext, or `redacted_value`.

## 9. Byte-writer and restore semantics (F2)

Proposed `ops_byte_publish(path, bytes, mode)` writes a temp file, fsyncs, and `atomic_replace`s (`utils.py:168`) onto the live path. It does not parse. It does not call `save_config`, `yaml.safe_load`, `atomic_yaml_write` of a re-dumped dict, `atomic_json_write` of a re-parsed object, or `_save_jobs_unlocked` (`cron/jobs.py:1581` re-serializes).

Absence publish is unlink of that path, not an empty file. If unlink fails, the transaction does not pretend the file is gone.

Forward semantic save (Model keys, Identity keys, Channels keys, single cron job, skill disabled-bit, Memory `provider`): compute the post-image in memory, stage those bytes, publish them with the byte-writer. The live file is not passed through `save_config` as the commit. For raw YAML, the staged bytes are the normalize/strip output. Comments, BOM, and CRLF in the editor buffer are not preserved on that forward save. The UI must say so when outcome is `normalized`.

Byte-exact restore does not use that semantic compute. It decrypts if needed, checks the plaintext sha256 against `before_hash` of that member, and byte-publishes those exact bytes. Validation parses a copy. A parse failure or an A6 rejection aborts. It does not rewrite the backup and it does not rewrite the live file.

Nodes whose History restore is byte-exact: Prompt `SOUL.md`, Trigger `webhook_subscriptions.json`, Skills `SKILL.md`, raw YAML `config.yaml`, whole-node Schedule `jobs.json`, a memory provider file the original write replaced as a whole. Resource-specific restores (Identity keys when the file already existed, Model assignment, toolset flags, MCP entry, Channels keys, secret keys, single cron job, Memory `provider`) apply only those keys onto the current file, stage that post-image, and byte-publish it. They do not claim byte-exact for the whole shared file.

Restore of a create: if `pre_image` is `absent`, publish is unlink. For Identity, unlink `profile.yaml` only when the live keys are a subset of `description` and `description_auto`. Otherwise 409, no unlink (`hermes_cli/profiles.py:984`). For a skill directory this transaction created, `rmdir` only if empty (`tools/skill_manager_tool.py:479` `skill_dir.rmdir()`, not `rmtree`).

## 10. Encrypted backups (F3)

Secret-bearing class, always encrypted, never a plaintext copy:

- `<home>/.env`
- `<home>/webhook_subscriptions.json` (HMAC secrets, `hermes_cli/web_routers/ops.py:221`)
- `<home>/config.yaml` (inline `api_key` and `delegation.api_key` at `hermes_cli/cli_config_load.py:220`; do not try to detect a secret-free yaml)
- memory provider `config.json` (`hermes_cli/web_routers/memory_providers.py:117`) and the Honcho path (`hermes_cli/web_routers/memory_providers.py:190`)

Not secret-bearing: `SOUL.md`, `profile.yaml`, `cron/jobs.json`, profile-local `SKILL.md`. Those are byte copies with mode preserved. They are still under `backups/ops-panel`, not under `state-snapshots`.

Envelope, proposed, not implemented here. The backup file is not the plaintext.

- Magic `OPSBAK1` and a newline.
- Algorithm `AES-256-GCM`.
- 12-byte nonce, ciphertext of the raw file bytes, 16-byte tag.
- AAD is UTF-8 profile name, NUL, relative POSIX path, NUL, plaintext sha256 hex. The tag binds the ciphertext to that identity.

Protector key:

- Backend only. Not in the manifest, not in History, not in renderer IPC, not in the profile home (a profile copy must not include the key).
- On this contract's target (Windows, SPEC section 0) the key blob is DPAPI `CryptProtectData` for the current user, at `%LOCALAPPDATA%\hermes\ops-panel\backup-protector.dpapi`. That path is proposed. This card does not create it.
- Unprotect happens only in the backend process. The renderer never receives the key or the plaintext backup.
- If the blob is missing, DPAPI fails, or this is not Windows, the protector is missing. Do not invent a raw key file. Do not fall back to a plaintext copy.

Integrity: verify the GCM tag before any restore publish. Tag failure aborts the restore. Live files stay. No mutation.

ACL, fail-closed, on the key blob and on every envelope: inheritance disabled, current user full control, other SIDs removed. Mode `0o600` is necessary and not sufficient. `_secure_file` (`hermes_cli/config.py:503`) chmods and swallows errors (`:511`). A5 must not treat that helper as the protector. If the ACL cannot be applied, step 4 is `backup_failed` and nothing is published.

Decrypt on restore is backend-only. Recovered plaintext must match the stored plaintext sha256 before publish. The response to the renderer is still names and set/unset, never the bytes.

## 11. Write-set versus post-commit (F4)

The transaction is the write-set plus the journal. Effects below are not coverage. They run only after the manifest fsync in step 8. They do not run on `backup_failed`, validation abort, or a 409. Their failure does not roll back the committed files and is not reported as `backup_failed` or as a failed save.

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

409 at step 2. Body: `{conflict: true, current_hash}`. No `current` secret bytes. For non-secret resources the client may re-GET and diff. For secret-bearing coverage the client re-GETs set/unset only and offers Keep mine / Take theirs without a value diff.

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

Reconciliation, when the connection is back:

1. Re-GET the node's coverage hash (and set/unset for secrets). The hash is the composite in section 4, computed by the backend.
2. Compare to the pre-image hash the editor held, and to `staged_hash` if the client still has it.
3. Unchanged from pre-image, including after `recovered_preimage`: the transaction aborted or was rolled back. Buffer stays dirty. Offer Save again.
4. Equal to staged, and the manifest outcome is `committed` or `normalized`: clear dirty. Refresh History. `normalized` still means section 7, not "any difference".
5. Neither: conflict (section 12). Do not auto-retry the PUT.

Save-all: each node that was in flight is reconciled on its own. Nodes not yet sent stay dirty and are not assumed saved.

## 15. Restore

Restore is a mutation. It runs section 5. It is not a copy from the History drawer onto disk in the renderer.

The request is `{backup_id, expected_hash}` where `expected_hash` is the live composite hash, not the backup's hash. Step 4 therefore backs up the current live bytes before any replace. A backup failure aborts the restore. The live file stays. The chosen history entry stays.

Byte-exact and resource-specific rules are section 9. A6 runs on restore. Putting back a disallowed model is a selection and is blocked (D13), even if those bytes were once on disk. An unrelated edit on a profile that already violates policy still warns and proceeds. Restore of the violating governed fields does not count as unrelated.

Delegation has no restore action. A raw-YAML restore may change the `delegation` block because it restores the whole `config.yaml`. That does not add a Save button to the Delegation node.

Secret restore: the renderer sends `backup_id` only. The backend decrypts. The response is `{key, is_set}`. No before/after values.

## 16. Remote Canvas (D11)

`DesktopConnectionKind` is `cloud | local | remote | ssh` (`apps/desktop/src/global.d.ts:1134`). Canvas writes require `local`.

The renderer hides Save, Discard-that-writes, History restore, secret set/clear, and raw YAML save when the active connection is not local. Hiding is not the gate. Step 1 is the gate. A tunneled loopback still counts as remote if the Desktop connection kind is not `local`.

Reads stay allowed. Secret reads on a remote connection are still names and set/unset only. `POST /api/env/reveal` (`hermes_cli/web_routers/config_env.py:1086`) is not an Ops call on any connection kind.

## 17. Secrets on the renderer

O42 and every secret-bearing node:

- Renderer receives `{name or key, is_set}` and, for non-secret allowlist ids only, the id list (`hermes_cli/web_routers/messaging.py:143`).
- Renderer does not receive raw values, `redacted_value` (`hermes_cli/web_routers/config_env.py:279`, `hermes_cli/web_routers/_common.py:127`), reveal plaintext (`hermes_cli/web_routers/config_env.py:1086`), webhook create `secret` (`hermes_cli/web_routers/ops.py:242`), backup plaintext, the protector key, or a diff of those.
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
| Protector missing or ACL/encrypt fails | section 10 | every secret-bearing write disabled; no plaintext copy; no mutation |
| Toolset or channel request that needs `.env` and did not declare it | partial coverage | whole request disabled |
| Webhook enable, tool post-setup, or channel hot-serve before commit or on `backup_failed` | side effect ahead of step 8 | those commands do not run; live files unchanged if backup failed |

A disabled write is a 409 the UI shows as "Save unavailable: backup cannot cover this file". It is not a cue to write from the renderer.

## 19. Walks

Each walk uses section 5. None is a snapshot followed by PUT. None writes from the renderer. These are contract walks, not A5 fault injection. A5 is not in this tree.

Conflict. Editor read Prompt, composite H1. Another writer lands H2 before the lock. Save sends `expected_hash=H1`. Step 2 returns 409. No directory under `backups/ops-panel`. `SOUL.md` is still H2. Keep mine is a new transaction with `expected_hash=H2`. Take theirs re-GETs and does not write.

Competitor between hash and backup. Transaction A holds `ops_txn_lock`, re-reads H1, and has not backed up yet. Transaction B blocks on the same lock. It cannot write H2 into the backup A is about to take. If a writer that does not take the lock changes the file after the check and before publish, the pre-publish re-check sees the new hash, aborts, and publishes nothing. The rejected design (check, drop the lock, backup, replace) is the one where B's bytes get copied and then overwritten. That design is not this contract.

Crash after the first multi-resource replace. Channels journal lists `.env` then `config.yaml`. `.env` is marked `published`. The process dies before `config.yaml` is replaced. Recovery rolls `.env` back to its pre-image (decrypt, byte-publish, or unlink if the pre-image was absent). `config.yaml` was never replaced. Live equals the pre-image. Outcome `recovered_preimage`. Not a partial commit. No hot-serve (`hermes_cli/web_routers/messaging.py:941`).

Crash before the manifest. Both files are marked `published`. Manifest is not committed. Recovery read-back matches staged hashes, so it writes the manifest and stops. If read-back does not match, it rolls both files back. It does not leave one new and one old.

Unexpected read-back. Staged hash was S. Read-back is neither S nor a precomputed normalized form of S. Outcome is not `normalized`. Rollback to pre-image. If rollback fails, `unknown`, and further Canvas writes on that profile stay disabled.

Backup failure. Hash matches. Step 4 cannot create the directory, cannot encrypt, or cannot apply the ACL. Response 500 `backup_failed`. No publish. No install. No restart. No hot-serve. Live bytes are the pre-image.

Validation abort. Model save, hash matches, encrypted backup of `config.yaml` succeeds, A6 rejects `grok-4.6` or `provider: openrouter` with a claude model (SPEC section 4.4). No publish. Backup remains `aborted_validation`. Live model keys unchanged. `gpt-6.1-sol-pro` passes A6 and continues. Validation parsed a copy. It did not rewrite the backup.

Create absent, then restore. `SOUL.md` does not exist (`hermes_cli/web_routers/profiles.py:1003`). `expected_hash` encodes absence. Create byte-publishes the new file. Manifest `files[].pre_image` is `absent`. Restore sends the live hash. Step 4 backs up the current file first. Publish is unlink, not an empty file. After unlink the composite encodes absence. The same walk applies to a missing `profile.yaml` (`hermes_cli/profiles.py:983`) when no other keys exist, and to a missing `SKILL.md` (`tools/skill_manager_tool.py:453`) plus an empty created directory removed with `rmdir`. If Identity unlink would drop `role` or `display_name`, restore is 409 and the file stays.

BOM, CRLF, comments, JSON whitespace. Pre-image `config.yaml` has a BOM, CRLF, and comments. Pre-image `jobs.json` has insignificant whitespace. Backup of `config.yaml` is an envelope; decrypting it yields the same sha256 as the pre-image. A forward raw YAML save does not preserve those bytes: staged bytes are the `save_config` normalize/strip output (`hermes_cli/config.py:2483`). That forward save is `normalized`, not a restore. Restore of the backup byte-publishes the decrypted pre-image. It does not call `update_config_raw` (`hermes_cli/web_routers/analytics.py:56`) or `save_config`. sha256 equals the pre-image, BOM and comments included. Whole-node `jobs.json` restore byte-publishes the backup bytes. It does not call `_save_jobs_unlocked` (`cron/jobs.py:1581`). sha256 equals the pre-image, whitespace included.

Missing protector. Secret-bearing save, protector blob missing or DPAPI fails. Step 4 returns `backup_failed` before any journal publish. Live `.env` and `config.yaml` are unchanged. No restart. No hot-serve. No plaintext file appears under `backups/ops-panel`.

No install or restart before commit, and none on `backup_failed`. Memory setup is not in the Save list, so `_install_memory_provider_setup` (`hermes_cli/web_routers/memory_providers.py:384`) does not run. Tool post-setup (`hermes_cli/web_routers/tools.py:333`) and webhook restart (`hermes_cli/web_routers/ops.py:180`) run only after manifest commit. If backup fails, they do not run, and a later install failure does not roll back a commit that already fsynced.

Disconnect. Client sent Prompt save and the socket died. UI says outcome unknown. On reconnect, re-GET the composite hash. Equal to pre-image: still dirty. Equal to staged and the manifest is committed: dirty cleared. Anything else: conflict. No assumption that the original is intact before recovery has run.

Remote. Connection kind `remote`. Save is not sent. If a client sends it anyway, step 1 returns 403. No backup directory. Same for `ssh` and `cloud`.

Secret. Channels save. Renderer never receives the value or a diff. Backup is an envelope, not a `0o600` copy. Response after commit is `{key, is_set}`. History shows hashes and actor, not ciphertext and not a diff. `POST /api/env/reveal` is not called. Restore sends `backup_id` only.

## 20. Out of scope for this card

Not implemented: the transaction wrapper, the byte-writer, the protector, History routes, A6, `ops-policy.yaml`, capability flags. Not edited: any file under a Hermes profile home, `backup.py`'s pruner, existing dashboard routes. `POST /api/model/set`, profile rename, profile delete, `POST /api/memory/reset`, memory setup, and cron trigger stay as they are and are not Canvas saves.
