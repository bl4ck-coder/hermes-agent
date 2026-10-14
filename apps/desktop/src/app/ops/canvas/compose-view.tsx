/** B13: the Compose entry on the Canvas. Proposals never auto-apply: Accept stages drafts, Discard drops them. */
import { useState } from 'react'

import { T } from '../main-i18n'

import { acceptProposal, propose, type Proposal } from './compose'

export function ComposePanel({ profile, edges, readOnly, onStaged }: { profile: string; edges: readonly (readonly [string, string])[]; readOnly?: boolean; onStaged?: (nodes: string[]) => void }) {
  const [text, setText] = useState('')
  const [p, setP] = useState<Proposal | null>(null)
  const [note, setNote] = useState<string | null>(null)

  return (
    <section aria-label={T('Compose')} data-ops-compose="">
      <form
        onSubmit={e => {
          e.preventDefault()

          if (text.trim()) {
            setP(propose(profile, text, edges))
            setNote(null)
          }
        }}
      >
        <textarea
          aria-label={T('Describe a change to this agent')}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          placeholder={T('Describe a change, e.g. "use model openrouter/deepseek-chat; always answer in Spanish"')}
          rows={2}
          value={text}
        />
        <button disabled={!text.trim()} type="submit">
          {T('Propose')}
        </button>
      </form>
      {p ? (
        <div data-ops-proposal={p.id} role="region" aria-label={T('Proposal')}>
          <strong>{T('Proposal (not applied)')}</strong>
          <ul>
            {p.items.map((it, i) => (
              <li data-ops-proposal-item={it.kind} key={i}>
                {it.kind === 'model' ? (
                  <>
                    <b>{T('Model')}</b> → <code>{`${it.provider}/${it.model}`}</code>
                  </>
                ) : it.kind === 'prompt' ? (
                  <>
                    <b>{it.mode === 'replace' ? T('Replace prompt') : T('Add to prompt')}</b>
                    <pre>{it.text.split('\n').map(l => `+ ${l}`).join('\n')}</pre>
                  </>
                ) : (
                  <span data-ops-proposal-note="">{it.text}</span>
                )}
              </li>
            ))}
          </ul>
          <button
            data-ops-proposal-accept=""
            data-ops-write=""
            disabled={readOnly || !p.items.some(i => i.kind !== 'note')}
            onClick={() => {
              const n = acceptProposal(p)
              const nodes = [...new Set(p.items.filter(i => i.kind !== 'note').map(i => i.kind))]
              setNote(`${T('Staged in the node editors:')} ${nodes.join(', ')} (${n}). ${T('Review & save to apply.')}`)
              setP(null)
              setText('')
              onStaged?.(nodes)
            }}
            type="button"
          >
            {T('Accept into drafts')}
          </button>
          <button data-ops-proposal-discard="" onClick={() => (setP(null), setNote(T('Proposal discarded.')))} type="button">
            {T('Discard')}
          </button>
        </div>
      ) : null}
      {note ? <span role="status">{note}</span> : null}
    </section>
  )
}