# Ops panel transaction contract (P0-03)

Status: documentation only. One backend mutation transaction for every Canvas write. This file does not implement the route, does not add `ops-policy.yaml`, and does not edit a profile.
Tree: `hermes-agent` at `005b104a506`. Node stores are in `storage-map.md`.
SPEC section 11.1 is the authority for the step order. SPEC section 4.2's `POST /api/profiles/{n}/snapshot` name is historical. It is not this contract.

## 1. What is frozen

One transaction, inside the backend, around the existing handler for that node. The handler still performs the replace (`atomic_write_text`, `atomic_yaml_write`, `atomic_config_replace`, `atomic_json_write`, or `cron.jobs.atomic_replace`). The transaction adds the steps around it. It does not move the write into the renderer.

Not frozen as code in this commit:

- the route that runs the steps
- `content_hash` on today's GET responses
- `ops.transaction` on `/api/status`

Until that capability exists, Canvas Save stays disabled. There is no degraded write.

## 2. Rejected designs

These are failures, not alternatives.

Standalone snapshot-then-PUT. A client `POST /api/profiles/{n}/snapshot` followed by `PUT` is not atomic. The file can change between the two calls. SPEC section 11.1 forbids it. A snapshot route, if one is added later, is not sufficient and is not the write path. Ops must not call it.

Renderer filesystem fallback. The Electron renderer and the main process do not write `SOUL.md`, `config.yaml`, `.env`, `profile.yaml`, `jobs.json`, `webhook_subscriptions.json`, or `SKILL.md` for Canvas. SPEC section 11.1 dropped that fallback. A missing or old backend disables Save. It does not open a file dialog and write.

Client-orchestrated backup. The renderer does not copy files into `backups/ops-panel` and then PUT. Backup is a step inside the backend transaction, after the expected-hash check and before validation.

Two transactions for one node. Model chip (O50) and `PUT /api/profiles/{n}/model` are the same transaction. Prompt save and the G86 note are one transaction (the note is a manifest field, not a second write). Save-all is N transactions, one per dirty node, not one transaction that merges nodes (`section 6`).

## 3. The transaction

Order is fixed. A later step does not run if an earlier step fails.

1. Gate. Connection kind is `local` (`apps/desktop/src/global.d.ts:1134` `DesktopConnectionKind`). `remote`, `ssh`, and `cloud` are remote (D11). The kind comes from the Desktop main process, not from a renderer body field. A missing kind is remote. Remote returns 403. No backup, no handler call. Delegation has no write at all (`storage-map.md` section 4.10), including on local.
2. Expected hash. The request carries `expected_hash` (sha256, hex) of the coverage bytes the editor read. The server re-reads those bytes and hashes them. Mismatch is 409. No backup directory is created. The live file is untouched. The client opens the conflict dialog (`section 5`).
3. Coverage check. The handler declares the paths it will modify (`storage-map.md` per node). Every path must be readable and copyable, inside the profile home, and not a secret the copier cannot preserve mode on. If any path is missing from that set, or cannot be copied, the write is disabled: 409 `backup_coverage_missing`. No handler call. This is the rule for secrets, skill files outside the profile, shared cron's external registry, toolset env, memory-provider external config, and webhook files.
4. Backup. Copy each covered file into `<profile home>/backups/ops-panel/<YYYYMMDD-HHMMSS>Z-<node>-<seq>/` (`storage-map.md` section 2). Preserve mode (`0o600` for `.env` and `webhook_subscriptions.json`). Write `manifest.json` only after every copy succeeds. If the directory name exists, treat that as backup failure. Do not overwrite. D10: never prune to make room. Disk full is backup failure.
5. Validate. Schema for that handler, then A6 on governed fields if the mutation touches them (`model.provider`, `model.default`, `fallback_providers`, `auxiliary.*.provider` / `model`). Disallowed selection returns 400. Live files stay as they were. The backup from step 4 remains (D10). Manifest `outcome` is `aborted_validation`. Do not delete it. Do not call the handler.
6. Atomic replace. Call the existing handler once. The handler's own replace is the commit. Do not write the live file a second time from the backup copy. Do not spawn toolset post-setup or restart the gateway in this step.
7. Read-back. Re-read the coverage bytes. Hash them. Compare to the hash the handler intended. `save_config` strips defaults (`hermes_cli/config.py:2490`), so a normalized hash may differ from the submitted document. That is `normalized`, not a rollback. The live file stays as read back. Manifest records `intended_hash` and `readback_hash`.
8. Manifest commit. Set `outcome` to `committed` or `normalized`. Then, and only then, run post-commit side effects that the handler already has: toolset post-setup spawn (`hermes_cli/web_routers/tools.py:312`), webhook enable restart (`hermes_cli/web_routers/ops.py:180`). A crash before this step leaves the replace either committed or not; reconciliation decides (`section 7`).

Backup failure at step 4 aborts. The live file is the pre-image. No manifest is published. No side effect runs. Response is 500 `backup_failed`. The client must not retry until it re-reads.

Validation failure at step 5 aborts the replace. The pre-image backup stays, labeled aborted. Live file unchanged.

Handler exception at step 6: if the handler's atomic replace did not land, live file is the pre-image. If it landed and the process died before step 8, outcome is unknown until reconciliation. Do not assume either.

## 4. Manifest

`manifest.json` in the backup directory. No secret values. No secret diffs. Hashes only for secret-bearing files.

| Field | Value |
|---|---|
| `schema_version` | `1` |
| `node` | `schedule`, `trigger`, `channels`, `memory`, `identity`, `prompt`, `model`, `tools`, `skills`, `raw_yaml`, `secrets` |
| `profile` | profile name (`default` for root) |
| `object_id` | job id, platform id, skill name, or profile name |
| `endpoint` | the handler path, not a client-invented URL |
| `actor` | `{connection_id, connection_kind, profile, surface: "ops-canvas"}`. No token, no `.env` value, no OS password. Missing `connection_id` fails the gate. |
| `expected_hash` | sha256 the client sent |
| `before_hash` | sha256 of coverage bytes copied in step 4 |
| `intended_hash` | sha256 the handler meant to land, or null if aborted before replace |
| `readback_hash` | sha256 after read-back, or null if no replace |
| `outcome` | `aborted_validation`, `committed`, `normalized` |
| `files` | relative paths copied, plus `mode`. Not file bodies in any API response that reaches the renderer. |
| `note` | optional G86 change note for `prompt` only. Plain text. Not written into `SOUL.md`. |
| `sequence` | monotonic per (profile, node). This is the Instructions version (G32). |

History list returns this manifest minus any field that could carry a secret. It does not return `.env` lines, webhook HMAC secrets, or `redacted_value`.

## 5. Conflict

409 at step 2. Body: `{conflict: true, current_hash}`. No `current` secret bytes. For non-secret resources the client may re-GET and diff. For secret-bearing coverage the client re-GETs set/unset only and offers Keep mine / Take theirs without a value diff.

Keep mine: client sends a new mutation whose `expected_hash` is `current_hash` and whose body is the editor buffer. That is a new transaction, not a resume.

Take theirs: client discards the buffer and renders the re-GET. No write.

Diff: allowed for `SOUL.md`, `profile.yaml` description, skill `SKILL.md`, and non-secret `config.yaml` keys. Forbidden for `.env`, `webhook_subscriptions.json`, MCP bearer tokens, memory-provider secrets, and `delegation.api_key`. A config.yaml diff redacts `api_key` and any `«redacted:` sentinel before IPC.

## 6. Save, dirty, Save all (G57)

Each writable node has its own dirty bit, Save, and Discard. Discard drops the buffer. It does not write and does not create a backup.

Save runs one transaction for that node. The button is disabled at zero dirty nodes. Header "Save all (n)" runs one transaction per dirty node, in this order: Schedule, Trigger, Channels, Memory, Identity, Prompt, Model, Tools, Skills, raw YAML. Secrets edited from O42 are their own node and run with Channels/Tools only if that node is dirty. Delegation is never in the list.

A failure does not roll back a sibling that already committed. The header count is the nodes still dirty. A 409 on one node does not cancel the others that have not started. Do not start the next node until the current one returns or the socket drops (`section 7`).

G32 owner is `actor` of the latest `committed` or `normalized` Prompt manifest. Version is `sequence`.

G86 note is sent only with the Prompt transaction. Empty note is allowed. It is not required for Save to enable.

## 7. Disconnect

If the socket drops after the request is sent and before a terminal response, the UI shows "outcome unknown". It does not show "saved". It does not show "original intact". It does not enable Undo that writes.

Reconciliation, when the connection is back:

1. Re-GET the node's coverage hash (and set/unset for secrets).
2. Compare to the pre-image hash the editor held, and to the intended hash if the client still has the body it sent.
3. Unchanged from pre-image: the transaction aborted or never started. Buffer stays dirty. Offer Save again.
4. Equal to intended (or normalized, and the re-GET matches the handler's public shape): committed. Clear dirty. Refresh History.
5. Neither: someone else wrote, or normalization the client cannot check. Treat as conflict (`section 5`). Do not auto-retry the PUT.

Save-all: each node that was in flight is reconciled on its own. Nodes not yet sent stay dirty and are not assumed saved.

## 8. Restore

Restore is a mutation. It runs section 3. It is not a copy from the History drawer onto disk in the renderer.

The request is `{backup_id, expected_hash}` where `expected_hash` is the live hash, not the backup's hash. Step 4 therefore backs up the current live bytes before any replace. A backup failure aborts the restore. The live file stays. The chosen history entry stays.

Byte-exact restore (Prompt `SOUL.md`, Trigger subscriptions file, Skills `SKILL.md`, raw YAML `config.yaml`, whole-node Schedule `jobs.json`, a memory provider file that the original write replaced as a whole): step 6 writes those backed-up bytes back through the same atomic replace the handler uses.

Resource-specific restore (Identity keys, Model assignment, toolset flags, MCP server entry, skill disabled-bit, Channels keys, secret keys, single cron job, Memory `provider` field): step 6 applies only those keys onto the current file, then the handler's normal writer. Other keys that changed since the backup are kept.

A6 runs on restore. Putting back a disallowed model is a selection and is blocked (D13), even if those bytes were once on disk. An unrelated edit on a profile that already violates policy still warns and proceeds. Restore of the violating governed fields does not count as unrelated.

Delegation has no restore action. A raw-YAML restore may change the `delegation` block because it restores the whole `config.yaml`. That does not add a Save button to the Delegation node.

Secret restore: the renderer sends `backup_id` only. The backend reads the secret from the backup file. The response is `{key, is_set}`. No before/after values.

## 9. Remote Canvas (D11)

`DesktopConnectionKind` is `cloud | local | remote | ssh` (`apps/desktop/src/global.d.ts:1134`). Canvas writes require `local`.

The renderer hides Save, Discard-that-writes, History restore, secret set/clear, and raw YAML save when the active connection is not local. Hiding is not the gate. The backend gate in section 3 step 1 is the gate. A tunneled loopback still counts as remote if the Desktop connection kind is not `local`.

Reads stay allowed. Secret reads on a remote connection are still names and set/unset only. `POST /api/env/reveal` is not an Ops call on any connection kind.

## 10. Secrets on the renderer

O42 and every secret-bearing node:

- Renderer receives `{name or key, is_set}` and, for non-secret allowlist ids only, the id list (`hermes_cli/web_routers/messaging.py:143`).
- Renderer does not receive raw values, `redacted_value` (`hermes_cli/web_routers/config_env.py:279`, `hermes_cli/web_routers/_common.py:127`), reveal plaintext (`hermes_cli/web_routers/config_env.py:1086`), webhook create `secret` (`hermes_cli/web_routers/ops.py:242`), or a diff of those.
- Main process strips those fields before IPC even if the dashboard route still returns them. This card does not change those routes.
- A write of a `«redacted:` preview is already refused (`hermes_cli/web_routers/_common.py:122`). Ops must not send one.

## 11. Coverage disables the write

If step 3 cannot name and copy every path the handler will modify, the write does not run. Concrete cases:

| Case | Why coverage is missing | Result |
|---|---|---|
| Skill `SKILL.md` resolved outside the profile home | bundled or external dir (`tools/skill_manager_tool.py:268`) | content write disabled; toggle of the disabled-list still allowed if `config.yaml` copies |
| External cron scheduler reconcile | remote registry is not `jobs.json` (`hermes_cli/web_server_cron.py:176`) | Schedule write disabled; in-process ticker does not trip this |
| Memory provider `save_config` or Honcho path outside the profile home | path not in the profile backup root | that provider's config write disabled |
| `.env` or `webhook_subscriptions.json` not copyable, or mode cannot be preserved | secret file | Channels, toolset env, MCP bearer, O42 set/clear, Trigger subscription write disabled |
| Toolset toggle that also writes an env key, and `.env` was not declared | partial coverage | whole request disabled; do not write `config.yaml` alone |
| Webhook enable that would also restart before backup succeeds | side effect ahead of step 8 | restart does not run; if backup failed, enabled flag is unchanged |

A disabled write is a 409 the UI shows as "Save unavailable: backup cannot cover this file". It is not a cue to write from the renderer.

## 12. Walk the judge runs

Each walk uses the steps in section 3. None of them is a snapshot followed by PUT. None writes from the renderer.

Conflict. Editor read Prompt, hash H1. Another writer lands H2. Save sends `expected_hash=H1`. Step 2 returns 409. No directory under `backups/ops-panel`. `SOUL.md` is still H2. Dialog offers Keep mine (new transaction with `expected_hash=H2`) or Take theirs (re-GET, no write).

Backup failure. Step 2 matches. Step 4 cannot create the directory (disk full, path exists, or permission). Response 500 `backup_failed`. Handler is not called. `SOUL.md` / `config.yaml` / `jobs.json` bytes are the pre-image. No manifest. Client does not retry blindly.

Validation abort. Model save, hash matches, backup copies `config.yaml`, A6 rejects `grok-4.6` or `provider: openrouter` with a claude model (SPEC section 4.4). Replace does not run. Backup remains with `outcome: aborted_validation`. Live `model` keys unchanged. `gpt-6.1-sol-pro` passes A6 and continues to replace.

Disconnect. Client sent Prompt save and the socket died before the response. UI says outcome unknown. On reconnect, re-GET `SOUL.md` hash. Equal to pre-image: still dirty. Equal to the body that was sent: committed, dirty cleared. Anything else: conflict. No assumption that the original is intact.

Restore. History restore of Prompt sends `backup_id` and the live hash. Step 4 copies the current `SOUL.md` to a new directory first. Then step 6 writes the historical bytes. Read-back hash equals the historical file. A new manifest records the actor. If step 4 fails, historical bytes are not written. Delegation still has no restore button. A raw-YAML restore is byte-exact of `config.yaml` and still creates that pre-image backup first.

Remote. Connection kind `remote`. Save is not sent. If a client sends it anyway, step 1 returns 403. No backup directory. Same for `ssh` and `cloud`.

Secret. Channels save. Renderer body has `is_set` only on the way out of a read, and on a write it sends a new value only through main, never a preview. Response after commit is `{key, is_set}`. History shows hashes and actor, not a diff. `POST /api/env/reveal` is not called.

## 13. Out of scope for this card

Not implemented: the transaction wrapper, History routes, A6, `ops-policy.yaml`, capability flags. Not edited: any file under a Hermes profile home, `backup.py`'s pruner, existing dashboard routes. `POST /api/model/set`, profile rename, profile delete, `POST /api/memory/reset`, and cron trigger stay as they are and are not Canvas saves.
