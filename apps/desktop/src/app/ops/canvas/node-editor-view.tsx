/**
 * Writable Canvas node editors (ops-panel P5-02): prompt, raw_yaml and model over the P2-03 routes.
 * Save shows a normalisation diff first; conflicts need an explicit choice; History lists committed
 * backups with Restore; the model picker (P2) offers policy-allowed pairs and blocked saves show manual
 * repair suggestions. Remote connections render read-only (D11).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { PolicyView } from '../feed/ops-client'

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
  readOnly
}: {
  profile: string
  node: WritableNode
  client: NodeClient
  policy: PolicyView | null
  readOnly?: boolean
}) {
  const [s, setS] = useState<NodeState | null>(null)
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
    return <p data-ops-node-editor={node}>Loading {LABEL[node]}…</p>
  }

  const diff = node === 'model' ? null : diffLines(s.base.content ?? '', s.draft.content ?? '')

  return (
    <section aria-label={LABEL[node]} data-ops-node-editor={node} data-ops-node-status={s.status}>
      <h3>
        {LABEL[node]} {isDirty(s) ? <span data-ops-dirty="">● unsaved</span> : null}
      </h3>
      {ro ? <span data-ops-badge="read-only">read-only</span> : null}

      {node === 'model' ? (
        <div>
          <input aria-label="provider" disabled={ro} onChange={e => setS(edit(s, { provider: e.target.value }))} value={s.draft.provider ?? ''} />
          <input aria-label="model" disabled={ro} onChange={e => setS(edit(s, { model: e.target.value }))} value={s.draft.model ?? ''} />
          {picks.length > 0 ? (
            <select
              aria-label="allowed models"
              disabled={ro}
              onChange={e => {
                const [provider, model] = e.target.value.split('\u0000')

                if (provider && model) {
                  setS(edit(s, { provider, model }))
                }
              }}
              value=""
            >
              <option value="">Allowed by policy…</option>
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
          <input aria-label="note" onChange={e => setNote(e.target.value)} placeholder="note (optional)" value={note} />
          <button disabled={!isDirty(s) || s.status === 'saving'} onClick={() => setPreview(true)} type="button">
            Review & save
          </button>
          <button disabled={!isDirty(s)} onClick={() => (setS(discard(s)), setPreview(false))} type="button">
            Discard
          </button>
          <button onClick={() => void openHistory()} type="button">
            History
          </button>
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
              {s.base.provider}/{s.base.model} → {s.draft.provider}/{s.draft.model} (config.yaml is re-written; comments are not kept)
            </p>
          )}
          <button
            data-ops-confirm-save=""
            onClick={async () => {
              setS({ ...s, status: 'saving' })
              setS(await save(s, profile, client, note || undefined))
              setPreview(false)
            }}
            type="button"
          >
            Save
          </button>
          <button onClick={() => setPreview(false)} type="button">
            Cancel
          </button>
        </div>
      ) : null}

      {s.message ? (
        <p data-ops-node-message={s.status} role={s.status === 'saved' ? 'status' : 'alert'}>
          {s.message}
        </p>
      ) : null}

      {s.status === 'conflict' ? (
        <div data-ops-conflict="">
          <button onClick={async () => setS(await reloadTheirs(s, profile, client))} type="button">
            Reload theirs
          </button>
          <button onClick={async () => setS(await rebaseMine(s, profile, client))} type="button">
            Keep mine (rebase)
          </button>
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
            <div aria-label="repair suggestions">
              Suggestions (manual):
              {suggestions.map(p => (
                <button data-ops-repair={`${p.provider}/${p.model}`} key={`${p.provider}/${p.model}`} onClick={() => setS(edit(s, { provider: p.provider, model: p.model }))} type="button">
                  {p.provider} / {p.model}
                </button>
              ))}
            </div>
          ) : (
            <p>No allowed alternative is known. Ask for a policy change.</p>
          )}
        </div>
      ) : null}

      {history ? (
        <aside aria-label="History" data-ops-history="">
          {history.length === 0 ? <p>No committed backups yet.</p> : null}
          <ol>
            {history.map(h => (
              <li data-ops-history-item={h.backup} key={h.backup}>
                #{h.sequence} {h.note ?? ''}{' '}
                {!ro ? (
                  <button onClick={async () => (setS(await restore(s, profile, h.backup, client)), void openHistory())} type="button">
                    Restore
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
          <button onClick={() => setHistory(null)} type="button">
            Close history
          </button>
        </aside>
      ) : null}
    </section>
  )
}

export function NodeEditors({ profile, policy, readOnly, client: c }: { profile: string; policy: PolicyView | null; readOnly?: boolean; client?: NodeClient }) {
  const client = useMemo(() => c ?? createNodeClient(), [c])
  const [node, setNode] = useState<WritableNode>('prompt')

  return (
    <section aria-label="Edit nodes" data-ops-node-editors="">
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
