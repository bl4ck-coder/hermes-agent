/** P8 b5: Diagnostics group (L1 probe, L6 stream/policy/errors, S7 redacted copy, R77 dev-only simulation). */
import { useState, useSyncExternalStore } from 'react'

import { connectionScoped, hermesApi } from '@/api/client'

import {
  clearOpsErrors,
  connectionView,
  type ConnectionView,
  diagnosticsText,
  opsErrors,
  probe,
  type ProbeResult,
  setSimMode,
  simAllowed,
  simMode,
  type SimMode,
  subscribeOpsErrors,
  subscribeSim
} from '../feed/diag'
import { useKanbanStream } from '../feed/kanban-stream'
import { setOpsConnection } from '../feed/write-gate'
import { T } from '../main-i18n'


/** B16: the connection line is localized at render; the copied diagnostics report stays English. */
/** B17: every connection-state line (diag.ts copy) localizes at render; the copied report stays English. */
const CONN_PATTERNS: [RegExp, string, string[]][] = [
  [/^Connected to Hermes (.+)\.$/, 'Connected to Hermes {v}.', ['v']],
  [/^Hermes is unreachable: (.+)\. Showing the last data, labelled stale\.$/, 'Hermes is unreachable: {msg}. Showing the last data, labelled stale.', ['msg']],
  [/^Hermes (.+) is outside this Ops window \((.+) to below (.+)\)\. Ops is read-only until Desktop or Hermes is updated\.$/, 'Hermes {v} is outside this Ops window ({min} to below {max}). Ops is read-only until Desktop or Hermes is updated.', ['v', 'min', 'max']],
  [/^Hermes (.+) lacks (.+)\. Ops is read-only for those features\.$/, 'Hermes {v} lacks {list}. Ops is read-only for those features.', ['v', 'list']],
  [/^Hermes (.+) is newer than tested \((.+)\); unknown fields are ignored\.$/, 'Hermes {v} is newer than tested ({t}); unknown fields are ignored.', ['v', 't']],
  [/^Hermes (.+) does not publish capability tokens; the route probe decides each section\.$/, 'Hermes {v} does not publish capability tokens; the route probe decides each section.', ['v']]
]

export function connCopy(s: string): string {
  for (const [re, key, names] of CONN_PATTERNS) {
    const m = re.exec(s)

    if (m) {return names.reduce((out, name, i) => out.replace(`{${name}}`, m[i + 1]), T(key))}
  }

  return T(s)
}

export function DiagnosticsPanel({
  policySource,
  get,
  copy
}: {
  policySource: string | null
  get?: (path: string) => Promise<unknown>
  copy?: (text: string) => Promise<void> | void
}) {
  const stream = useKanbanStream()
  const errors = useSyncExternalStore(subscribeOpsErrors, opsErrors, opsErrors)
  const sim = useSyncExternalStore(subscribeSim, simMode, simMode)
  const [results, setResults] = useState<ProbeResult[] | null>(null)
  const [probing, setProbing] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [conn, setConn] = useState<ConnectionView | null>(null)
  const fetcher = get ?? ((path: string) => hermesApi({ ...connectionScoped(), path }))

  const runProbe = async () => {
    setProbing(true)

    try {
      const v = connectionView((await fetcher('/api/status')) as never)
      setConn(v)
      setOpsConnection(v)
    } catch (e) {
      const v = connectionView(null, e)
      setConn(v)
      setOpsConnection(v)
    }

    setResults(await probe(fetcher))
    setProbing(false)
  }

  const text = () => diagnosticsText({ probe: results, stream: { mode: stream.mode, reason: stream.reason }, policySource, errors })

  const ok = results ? results.filter(r => r.state === 'ok').length : 0
  const total = results?.length ?? 0
  const failing = results ? results.filter(r => r.state !== 'ok') : []
  const tone = !results ? 'idle' : failing.length === 0 && errors.length === 0 ? 'good' : 'warn'

  // P7: confirmed state, then the evidence for it, then the next action. Details fold away.
  return (
    <div data-ops-diagnostics="">
      <header data-ops-diag-hero={tone}>
        <h3 data-ops-diag-state="">
          {!results ? T('Not probed yet') : tone === 'good' ? T('All systems go') : T('Some capabilities need attention')}
        </h3>
        <p data-ops-diag-summary="">
          {results ? `${ok}/${total} ${T('available')} · ` : ''}
          {T('Recent errors')} {errors.length} · {stream.mode}
          {stream.reason ? ` (${stream.reason})` : ''}
        </p>
      </header>
      {failing.length ? (
        <section aria-label={T('Needs attention')} data-ops-diag-evidence="probe">
          <h4>{T('Needs attention')}</h4>
          <ul data-ops-probe-failing="">
            {failing.map(r => (
              <li data-ops-probe-fail={r.state} key={r.id}>
                <strong>{T(r.label)}</strong>
                <span>{r.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : results ? (
        <section aria-label={T('Checked')} data-ops-diag-evidence="checked">
          <h4>{T('Checked')}</h4>
          <ul data-ops-diag-checked="">
            {results.map(r => (
              <li key={r.id}>{T(r.label)}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {/* P20c: the next step sits right after the summary, before the error evidence. */}
      <div data-ops-diag-next="">
          <span data-ops-diag-actions="">
            <button data-ops-primary="" data-ops-probe="" disabled={probing} onClick={() => void runProbe()} type="button">
              {probing ? T('Probing…') : results ? T('Probe again') : T('Run capability probe')}
            </button>
            <button
              data-ops-copy-diagnostics=""
              onClick={async () => {
                try {
                  await (copy ?? (t => navigator.clipboard.writeText(t)))(text())
                  setNote('Diagnostics copied (redacted).')
                } catch (e) {
                  setNote(`Copy failed: ${e instanceof Error ? e.message : String(e)}`)
                }
              }}
              type="button"
            >
              {T("Copy diagnostics")}</button>
          </span>
        {note ? <p role="status">{note}</p> : null}
      </div>
      {errors.length > 0 ? (
        <section aria-label={T('Recent errors')} data-ops-diag-evidence="errors">
          <h4>
            {T("Recent errors")}{' '}<span data-ops-error-count="">{errors.length}</span>
          </h4>
          {/* P20c: one line per failing endpoint (latest message, repeat count); the raw log is secondary. */}
          <ul data-ops-error-groups="">
            {groupOpsErrors(errors).map(g => (
              <li data-ops-error-group="" key={g.key}>
                <strong>{g.key}</strong> <span>{g.message}</span>
                {g.count > 1 ? <span data-ops-error-repeat="">{' \u00d7'}{g.count}</span> : null}
              </li>
            ))}
          </ul>
          <details data-ops-errors-log="">
            <summary>{T('Full error log')}</summary>
            <ol data-ops-errors="">
              {errors.map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  <time>{new Date(e.at).toLocaleTimeString()}</time> {e.method} {e.path}: {e.message}
                </li>
              ))}
            </ol>
            <button onClick={clearOpsErrors} type="button">
              {T("Clear errors")}</button>
          </details>
        </section>
      ) : null}
      <details data-ops-diag-details="">
        <summary>{T('Details')}</summary>
        <dl>
          <dt>{T("Stream")}</dt>
          <dd data-ops-diag-stream={stream.mode}>
            {stream.mode}
            {stream.reason ? ` (${stream.reason})` : ''}
          </dd>
          <dt>{T("Connection")}</dt>
          <dd data-ops-diag-connection={conn?.state ?? 'not probed'} data-ops-writes={conn ? (conn.writesEnabled ? 'on' : 'off') : undefined}>
            {conn ? connCopy(conn.copy) : T('Run the probe to check the Hermes version and capabilities.')}
          </dd>
          <dt>{T("Stream generation")}</dt>
          <dd data-ops-diag-generation="">{stream.generation ?? 0}</dd>
          <dt>{T("Policy source")}</dt>
          <dd data-ops-diag-policy="">{policySource ?? T('unknown')}</dd>
        </dl>
        {results ? (
          <ul aria-label={T("Capability probe")} data-ops-probe-results="">
            {results.map(r => (
              <li data-ops-probe-row={r.id} data-ops-probe-state={r.state} key={r.id}>
                <b data-ops-probe-id="">{r.id}</b> {T(r.label)}{r.state === 'ok' ? <span data-ops-probe-ok="">: {T('available')}</span> : <>: {r.detail}</>}
              </li>
            ))}
          </ul>
        ) : null}
      </details>
      {simAllowed() ? (
        <label data-ops-simulate="">
          {T("Simulate (dev only)")}<select aria-label={T("simulate")} onChange={e => setSimMode(e.target.value as SimMode)} value={sim}>
            <option value="off">{T("Off")}</option>
            <option value="offline">{T("Offline")}</option>
            <option value="slow">{T("Slow (> 10 s)")}</option>
            <option value="auth">401</option>
          </select>
        </label>
      ) : null}
    </div>
  )
}

/** P7: the one-line system status Settings shows; the full panel lives in the Diagnostics view. */
export function SystemStatus({ policySource, onOpen }: { policySource: string | null; onOpen: () => void }) {
  const stream = useKanbanStream()
  const errors = useSyncExternalStore(subscribeOpsErrors, opsErrors, opsErrors)

  return (
    <p data-ops-system-status={errors.length ? 'warn' : 'ok'}>
      <span>
        {errors.length ? `${T('Recent errors')} ${errors.length}` : T('No Ops request has failed this session.')} · {stream.mode} · {T('Policy source')}{' '}
        {policySource ?? T('unknown')}
      </span>
      <button data-ops-open-diagnostics="" onClick={onOpen} type="button">
        {T('Open Diagnostics')}
      </button>
    </p>
  )
}

export function groupOpsErrors(errors: readonly { at: number | string; message: string; method?: string; path?: string }[]) {
  const m = new Map<string, { count: number; key: string; message: string }>()
  for (const e of errors) {
    const key = `${e.method ?? ''} ${e.path ?? ''}`.trim() || '?'
    const g = m.get(key)
    if (g) { g.count += 1; g.message = e.message } else m.set(key, { count: 1, key, message: e.message })
  }
  return [...m.values()]
}
