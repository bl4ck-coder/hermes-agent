/**
 * Writable Canvas node editors (ops-panel P5-02): prompt, raw_yaml and model over the P2-03 routes.
 * Save shows a normalisation diff first; conflicts need an explicit choice; History lists committed
 * backups with Restore; the model picker (P2) offers policy-allowed pairs and blocked saves show manual
 * repair suggestions. Remote connections render read-only (D11).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { PolicyView } from '../feed/ops-client'
import { T } from '../main-i18n'

import { patchFor, takeStaged, useStagedVersion } from './compose'
import { registerCanvasSaver, setCanvasDirty } from './dirty-store'
import { clearDraft, loadDraft, saveDraft } from './drafts'
import {
  createNodeClient,
  diffLines,
  discard,
  edit,
  fromRead,
  type HistoryItem,
  isDirty,
  type NodeClient,
  type NodeState,
  rebaseMine,
  reconcile,
  reloadTheirs,
  repairSuggestions,
  restore,
  save,
  WRITABLE_NODES,
  type WritableNode
} from './node-editor'

const LABEL: Record<WritableNode, string> = { prompt: 'Prompt (SOUL.md)', raw_yaml: 'Raw config.yaml', model: 'Model' }

export function NodeEditor({
  profile,
  node,
  client,
  policy,
  readOnly,
  connection = 'local'
}: {
  profile: string
  node: WritableNode
  client: NodeClient
  policy: PolicyView | null
  readOnly?: boolean
  /** L8: drafts are kept per connection. */
  connection?: string
}) {
  const [s, setS] = useState<NodeState | null>(null)
  const [stored, setStored] = useState(() => loadDraft(connection, profile, node))
  const [preview, setPreview] = useState(false)
  const [history, setHistory] = useState<HistoryItem[] | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    let live = true

    client.read(profile, node).then(
      r => live && setS(fromRead(node, r)),
      () => live && setS(fromRead(node, null))
    )

    return () => {
      live = false
    }
  }, [client, profile, node])

  const ro = Boolean(readOnly) || s?.status === 'read_only'
  const dirtyNow = s ? isDirty(s) : false
  const stagedVer = useStagedVersion()

  // B13: consume accepted compose proposals into this node's draft (never auto-save).
  useEffect(() => {
    if (!s || ro) {
      return
    }

    const items = takeStaged(profile, node)

    if (!items.length) {
      return
    }

    setS(cur => {
      if (!cur) {
        return cur
      }

      let next = cur

      for (const item of items) {
        const p = patchFor(item, next.draft)

        if (p && p.node === node) {
          next = edit(next, p.patch)
        }
      }

      return next
    })
  }, [stagedVer, profile, node, s, ro])


  // L8: keep the latest unsaved draft (Prompt/Model only) so a profile switch, delete or disconnect never loses it.
  useEffect(() => {
    if (!s) {
      return
    }

    if (dirtyNow) {
      saveDraft(connection, profile, node, s.draft)
    } else if (s.status === 'saved') {
      clearDraft(connection, profile, node)
    }
  }, [s, dirtyNow, connection, profile, node])

  // O47: publish the unsaved draft so the Canvas tab shows the gold dot; cleared on save/discard/unmount.
  useEffect(() => {
    setCanvasDirty(profile, node, dirtyNow)

    return () => setCanvasDirty(profile, node, false)
  }, [profile, node, dirtyNow])

  // G57: Save all (n) on the Canvas header saves this draft with its note, like the node's own Save.
  useEffect(() => {
    if (!s || !dirtyNow || ro) {
      registerCanvasSaver(profile, node, null)

      return
    }

    registerCanvasSaver(profile, node, async () => {
      setS({ ...s, status: 'saving' })
      const next = await save(s, profile, client, note || undefined)
      setS(next)

      return next.status === 'saved' || next.status === 'clean'
    })

    return () => registerCanvasSaver(profile, node, null)
  }, [s, dirtyNow, ro, profile, node, client, note])

  const openHistory = useCallback(async () => {
    try {
      setHistory((await client.history(profile, node)).items ?? [])
    } catch {
      setHistory(null)
    }
  }, [client, profile, node])

  const suggestions = useMemo(() => (s?.status === 'blocked' ? repairSuggestions(policy, s.draft.provider) : []), [s, policy])
  const picks = useMemo(() => repairSuggestions(policy), [policy])

  if (!s) {
    return <p data-ops-node-editor={node}>{T("Loading")}{' '}{T(LABEL[node])}…</p>
  }

  const diff = node === 'model' ? null : diffLines(s.base.content ?? '', s.draft.content ?? '')

  return (
    <section aria-label={T(LABEL[node])} data-ops-node-editor={node} data-ops-node-status={s.status}>
      <h3>
        {T(LABEL[node])} {isDirty(s) ? <span data-ops-dirty="">{T("● unsaved")}</span> : null}
      </h3>
      {ro ? <span data-ops-badge="read-only">{T('read-only')}</span> : null}
      {stored && !dirtyNow && !ro && (stored.draft.content !== s.base.content || stored.draft.provider !== s.base.provider || stored.draft.model !== s.base.model) ? (
        <p data-ops-draft-restore="">
          {T("An unsaved draft from")}{' '}{new Date(stored.at).toLocaleString()} {T("was kept.")}<button onClick={() => (setS(edit(s, stored.draft)), setStored(null))} type="button">
            {T("Restore draft")}</button>
          <button onClick={() => (clearDraft(connection, profile, node), setStored(null))} type="button">
            {T("Dismiss")}</button>
        </p>
      ) : null}

      {node === 'model' ? (
        <div>
          <input aria-label={T("provider")} disabled={ro} onChange={e => setS(edit(s, { provider: e.target.value }))} value={s.draft.provider ?? ''} />
          <input aria-label={T("model")} disabled={ro} onChange={e => setS(edit(s, { model: e.target.value }))} value={s.draft.model ?? ''} />
          {picks.length > 0 ? (
            <select
              aria-label={T("allowed models")}
              disabled={ro}
              onChange={e => {
                const [provider, model] = e.target.value.split('\u0000')

                if (provider && model) {
                  setS(edit(s, { provider, model }))
                }
              }}
              value=""
            >
              <option value="">{T("Allowed by policy…")}</option>
              {picks.map(p => (
                <option key={`${p.provider}/${p.model}`} value={`${p.provider}\u0000${p.model}`}>
                  {p.provider} / {p.model}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      ) : (
        <textarea aria-label={`${node} content`} disabled={ro} onChange={e => setS(edit(s, { content: e.target.value }))} rows={12} value={s.draft.content ?? ''} />
      )}

      {!ro ? (
        <div role="toolbar">
          <input aria-label={T("note")} onChange={e => setNote(e.target.value)} placeholder={T("note (optional)")} value={note} />
          <button data-ops-write="" disabled={!isDirty(s) || s.status === 'saving'} onClick={() => setPreview(true)} type="button">
            {T("Review & save")}</button>
          <button data-ops-node-discard="" disabled={!isDirty(s)} onClick={() => ((clearDraft(connection, profile, node), setS(discard(s))), setPreview(false))} type="button">
            {T("Discard")}</button>
          <button onClick={() => void openHistory()} type="button">
            {T("History")}</button>
        </div>
      ) : null}

      {preview && isDirty(s) ? (
        <div data-ops-save-preview="">
          {diff ? (
            <pre data-ops-diff="">
              {diff
                .filter(d => d.op !== ' ')
                .map(d => `${d.op} ${d.line}`)
                .join('\n')}
            </pre>
          ) : (
            <p data-ops-diff="">
              {s.base.provider}/{s.base.model} → {s.draft.provider}/{s.draft.model} {T("(config.yaml is re-written; comments are not kept)")}</p>
          )}
          <button data-ops-confirm-save=""
            data-ops-write=""
            onClick={async () => {
              setS({ ...s, status: 'saving' })
              setS(await save(s, profile, client, note || undefined))
              setPreview(false)
            }}
            type="button"
          >
            {T("Save")}</button>
          <button onClick={() => setPreview(false)} type="button">
            {T("Cancel")}</button>
        </div>
      ) : null}

      {s.message ? (
        <p data-ops-node-message={s.status} role={s.status === 'saved' ? 'status' : 'alert'}>
          {s.message}
        </p>
      ) : null}

      {s.status === 'unknown' ? (
        <div data-ops-outcome-unknown={s.pendingOp ?? ''}>
          <button onClick={async () => setS(await reconcile(s, profile, client))} type="button">
            {T("Check again")}</button>
          <button onClick={() => setS({ ...discard(s), pendingOp: null })} type="button">
            {T("Discard draft")}</button>
        </div>
      ) : null}

      {s.status === 'conflict' ? (
        <div data-ops-conflict="">
          <button onClick={async () => setS(await reloadTheirs(s, profile, client))} type="button">
            {T("Reload theirs")}</button>
          <button onClick={async () => setS(await rebaseMine(s, profile, client))} type="button">
            {T("Keep mine (rebase)")}</button>
        </div>
      ) : null}

      {s.status === 'blocked' ? (
        <div data-ops-policy-blocked="">
          <ul>
            {(s.violations ?? []).map(v => (
              <li key={`${v.field}:${v.provider}:${v.model}`}>
                {v.field}: {v.provider}/{v.model}, {v.reason}
              </li>
            ))}
          </ul>
          {suggestions.length ? (
            <div aria-label={T("repair suggestions")}>
              {T("Suggestions (manual):")}{suggestions.map(p => (
                <button data-ops-repair={`${p.provider}/${p.model}`} key={`${p.provider}/${p.model}`} onClick={() => setS(edit(s, { provider: p.provider, model: p.model }))} type="button">
                  {p.provider} / {p.model}
                </button>
              ))}
            </div>
          ) : (
            <p>{T("No allowed alternative is known. Ask for a policy change.")}</p>
          )}
        </div>
      ) : null}

      {history ? (
        <aside aria-label={T("History")} data-ops-history="">
          {history.length === 0 ? <p>{T("No committed backups yet.")}</p> : null}
          <ol>
            {history.map(h => (
              <li data-ops-history-item={h.backup} key={h.backup}>
                #{h.sequence} {h.note ?? ''}{' '}
                {!ro ? (
                  <button data-ops-write="" onClick={async () => (setS(await restore(s, profile, h.backup, client)), void openHistory())} type="button">
                    {T("Restore")}</button>
                ) : null}
              </li>
            ))}
          </ol>
          <button onClick={() => setHistory(null)} type="button">
            {T("Close history")}</button>
        </aside>
      ) : null}
    </section>
  )
}

export function NodeEditors({ profile, policy, readOnly, client: c }: { profile: string; policy: PolicyView | null; readOnly?: boolean; client?: NodeClient }) {
  const client = useMemo(() => c ?? createNodeClient(), [c])
  const [node, setNode] = useState<WritableNode>('prompt')

  return (
    <section aria-label={T("Edit nodes")} data-ops-node-editors="">
      <div role="tablist">
        {WRITABLE_NODES.map(n => (
          <button aria-selected={n === node} key={n} onClick={() => setNode(n)} role="tab" type="button">
            {LABEL[n]}
          </button>
        ))}
      </div>
      <NodeEditor client={client} key={`${profile}:${node}`} node={node} policy={policy} profile={profile} readOnly={readOnly} />
    </section>
  )
}
