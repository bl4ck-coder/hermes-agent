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
function connCopy(s: string): string {
  const m = /^Connected to Hermes (.+)\.$/.exec(s)

  return m ? T('Connected to Hermes {v}.').replace('{v}', m[1]) : T(s)
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

  return (
    <div data-ops-diagnostics="">
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
      <button data-ops-probe="" disabled={probing} onClick={() => void runProbe()} type="button">
        {probing ? T('Probing…') : T('Run capability probe')}
      </button>
      {results ? (
        <ul aria-label={T("Capability probe")} data-ops-probe-results="">
          {results.map(r => (
            <li data-ops-probe-row={r.id} data-ops-probe-state={r.state} key={r.id}>
              {r.id} {T(r.label)}: {r.state === 'ok' ? T('available') : r.detail}
            </li>
          ))}
        </ul>
      ) : null}
      <h4>
        {T("Recent errors")}{' '}<span data-ops-error-count="">{errors.length}</span>
      </h4>
      {errors.length === 0 ? (
        <p data-ops-empty="errors">{T("No Ops request has failed this session.")}</p>
      ) : (
        <ol data-ops-errors="">
          {errors.map((e, i) => (
            <li key={`${e.at}-${i}`}>
              <time>{new Date(e.at).toLocaleTimeString()}</time> {e.method} {e.path}: {e.message}
            </li>
          ))}
        </ol>
      )}
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
      <button disabled={errors.length === 0} onClick={clearOpsErrors} type="button">
        {T("Clear errors")}</button>
      {note ? <p role="status">{note}</p> : null}
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
