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
  const passing = results ? results.filter(r => r.state === 'ok') : []
  // P25 (pass 19 #2): the verdict is the PRESENT probe only. The error ring is history: listed below, never the headline.
  const tone = !results ? 'idle' : failing.length === 0 ? 'good' : 'warn'

  // P7/P24: confirmed state, then the next action, then the probe result and error evidence. Details and the raw log fold away, last.
  return (
    <div data-ops-diagnostics="">
      <header data-ops-diag-hero={tone}>
        <h3 data-ops-diag-state="">
          {!results ? T('Not probed yet') : tone === 'good' ? T('All capabilities available') : T('Some capabilities need attention')}
        </h3>
        {!results ? (
          <p data-ops-diag-unprobed="">{T('Run the probe to see what works now. Errors listed below are earlier failures, not the current state.')}</p>
        ) : null}
        <p data-ops-diag-summary="">
          {results ? `${ok}/${total} ${T('available')} · ` : ''}
          {T('Recent errors')} {errors.length} · {stream.mode}
          {stream.reason ? ` (${stream.reason})` : ''}
        </p>
      </header>
      {/* P20c/P24: the next step sits right after the summary, before the probe result and the error evidence. */}
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
      {/* P24: the finished probe, one line per check (failures first, with their reason), right after the actions. */}
      {results ? (
        <section aria-label={T('Capability probe')} data-ops-diag-evidence="probe" data-ops-diag-result="">
          {failing.length ? (
            <>
              <h4>{T('Needs attention')}</h4>
              <ul data-ops-probe-failing="">
                {failing.map(r => (
                  <li data-ops-probe-check={r.id} data-ops-probe-fail={r.state} data-ops-probe-state={r.state} key={r.id}>
                    <strong>{T(r.label)}</strong>
                    <span>{r.detail}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {passing.length ? (
            <>
              <h4>{T('Checked')}</h4>
              <ul data-ops-diag-checked="">
                {passing.map(r => (
                  <li data-ops-probe-check={r.id} data-ops-probe-state="ok" key={r.id}>
                    {T(r.label)}
                    <span data-ops-probe-ok="">: {T('available')}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      ) : null}
      {errors.length > 0 ? (
        <section aria-label={T('Recent errors')} data-ops-diag-evidence="errors">
          <h4>
            {T("Recent errors")}{' '}<span data-ops-error-count="">{errors.length}</span>
          </h4>
          {/* P20c/P24: one line per failing endpoint (latest message, repeat count); the raw log is folded at the end. */}
          <ul data-ops-error-groups="">
            {groupOpsErrors(errors).map(g => (
              <li data-ops-error-group="" key={g.key}>
                <strong>{g.key}</strong> <span>{g.message}</span>
                {g.count > 1 ? <span data-ops-error-repeat="">{' \u00d7'}{g.count}</span> : null}
              </li>
            ))}
          </ul>
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
      {errors.length > 0 ? (
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

/** P20c/P24: one line per endpoint with its repeat count and its MOST RECENT message (by `at`; the ring prepends, so on ties the first seen is newest). */
export function groupOpsErrors(errors: readonly { at: number | string; message: string; method?: string; path?: string }[]) {
  const m = new Map<string, { count: number; key: string; message: string }>()
  const latest = new Map<string, number>()
  const time = (at: number | string) => (typeof at === 'number' ? at : Date.parse(at))

  for (const e of errors) {
    const key = `${e.method ?? ''} ${e.path ?? ''}`.trim() || '?'
    const g = m.get(key)
    const t = time(e.at)

    if (!g) {
      m.set(key, { count: 1, key, message: e.message })
      latest.set(key, t)

      continue
    }

    g.count += 1

    // Only a strictly newer entry replaces the message (older ones further down the ring never do).
    if (t > (latest.get(key) ?? Number.NaN)) {
      g.message = e.message
      latest.set(key, t)
    }
  }

  return [...m.values()]
}
