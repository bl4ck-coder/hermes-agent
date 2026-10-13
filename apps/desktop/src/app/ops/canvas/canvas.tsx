/**
 * Canvas, read-only (ops-panel P3-03). Every node shows backend data or an explicit
 * "not available yet" capability state. Test run (D7): one click, no confirm dialog,
 * no token cap; tokens and elapsed time stream live.
 */

import { useEffect, useRef, useState } from 'react'

import type { CronJobLite, DelegationView, ModelNode, PolicyView, PromptNode } from '../feed/ops-client'

import { elapsedMs, initialRun, reduceRun, type RunView } from './run-stream'

export interface CanvasData {
  model: ModelNode | null
  policy: PolicyView | null
  prompt: PromptNode | null
  cron: CronJobLite[] | null
  delegation: DelegationView | null
}

export const CANVAS_NODES = ['prompt', 'model', 'tools', 'skills', 'delegation', 'schedule', 'policy', 'channels', 'memory'] as const
export type CanvasNodeId = (typeof CANVAS_NODES)[number]

export const CANVAS_EDGES: [CanvasNodeId, CanvasNodeId][] = [
  ['prompt', 'model'],
  ['model', 'tools'],
  ['model', 'skills'],
  ['model', 'delegation'],
  ['schedule', 'model'],
  ['policy', 'model'],
  ['channels', 'model'],
  ['memory', 'model']
]

interface RunsBridge {
  create: (ref: object, body: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown; code?: string; message?: string }>
  openEvents: (ref: object, runId: string, opts?: object) => Promise<{ subscriptionId: string; ended: boolean }>
  closeEvents: (id: string) => Promise<unknown>
  onEvent: (cb: (p: { subscriptionId: string; type: string; event?: string; data?: string; code?: string }) => void) => () => void
}

const UNAVAILABLE = 'Not available yet: no backend source in this phase.'

function nodeBody(id: CanvasNodeId, d: CanvasData): { text: string; state: 'ok' | 'unset' | 'policy' | 'unknown' } {
  switch (id) {
    case 'model': {
      if (!d.model) {
        return { text: 'unknown', state: 'unknown' }
      }

      const bad = (d.policy?.violations ?? []).some(v => v.field === 'model')

      return d.model.provider && d.model.model
        ? { text: `${d.model.provider} · ${d.model.model}`, state: bad ? 'policy' : 'ok' }
        : { text: 'Unset', state: 'unset' }
    }

    case 'prompt':
      if (!d.prompt) {
        return { text: 'unknown', state: 'unknown' }
      }

      return d.prompt.exists
        ? { text: (d.prompt.content ?? '').split(/\r?\n/).find(l => l.trim()) ?? '(empty)', state: 'ok' }
        : { text: 'Unset', state: 'unset' }

    case 'schedule':
      return d.cron ? { text: `${d.cron.length} cron jobs`, state: d.cron.length ? 'ok' : 'unset' } : { text: 'unknown', state: 'unknown' }

    case 'delegation':
      return d.delegation
        ? {
            text: d.delegation.inherit_model ? 'inherits main model' : `${d.delegation.provider ?? ''} · ${d.delegation.model ?? ''}`,
            state: 'ok'
          }
        : { text: 'unknown', state: 'unknown' }
    case 'policy': {
      if (!d.policy) {
        return { text: 'unknown', state: 'unknown' }
      }

      const n = d.policy.violations?.length

      return n === undefined || n === null
        ? { text: `P2 ${d.policy.source}`, state: 'unknown' }
        : n
          ? { text: `${n} violation(s): warn only (D13)`, state: 'policy' }
          : { text: 'P2 compliant', state: 'ok' }
    }

    default:
      return { text: UNAVAILABLE, state: 'unknown' }
  }
}

export function CanvasView({
  profile,
  data,
  readOnly,
  runs,
  now = () => Date.now()
}: {
  profile: string
  data: CanvasData
  readOnly?: boolean
  runs?: RunsBridge | null
  now?: () => number
}) {
  const [run, setRun] = useState<RunView>(initialRun)
  const [input, setInput] = useState('Say hello and name the tools you can use.')
  const [, tick] = useState(0)
  const sub = useRef<string | null>(null)

  useEffect(() => {
    if (!runs) {
      return
    }

    const off = runs.onEvent(p => {
      if (!sub.current || p.subscriptionId !== sub.current) {
        return
      }

      if (p.type === 'end') {
        setRun(r => (r.status === 'completed' || r.status === 'failed' ? r : { ...r, status: 'failed', endedAt: now(), error: p.code ?? 'stream ended' }))

        return
      }

      setRun(r => reduceRun(r, p, now()))
    })

    return () => {
      off()

      if (sub.current) {
        void runs.closeEvents(sub.current)
      }
    }
  }, [runs, now])

  const active = run.status === 'starting' || run.status === 'running' || run.status === 'waiting_for_approval'

  useEffect(() => {
    if (!active) {
      return
    }

    const t = setInterval(() => tick(n => n + 1), 100)

    return () => clearInterval(t)
  }, [active])

  const start = async () => {
    if (!runs) {
      return
    }

    setRun({ ...initialRun(), status: 'starting', startedAt: now() })
    // D7: no confirmation dialog and no token cap - the body carries the input only.
    const res = await runs.create({ profile }, { input })

    const runId = res.ok && res.data && typeof (res.data as { run_id?: unknown }).run_id === 'string'
      ? (res.data as { run_id: string }).run_id
      : null

    if (!runId) {
      setRun(r => ({ ...r, status: 'failed', endedAt: now(), error: res.code ?? res.message ?? 'run not started' }))

      return
    }

    setRun(r => ({ ...r, runId, status: 'running' }))
    const opened = await runs.openEvents({ profile }, runId)
    sub.current = opened.ended ? null : opened.subscriptionId
  }

  const ms = elapsedMs(run, now())

  return (
    <div data-ops-canvas={profile} data-ops-readonly={readOnly ? '' : undefined}>
      <header>
        <strong>Canvas · {profile}</strong>
        {readOnly ? <span data-ops-badge="remote">remote: read-only</span> : null}
      </header>
      <div data-ops-canvas-nodes="" role="list">
        {CANVAS_NODES.map(id => {
          const b = nodeBody(id, data)

          return (
            <div data-ops-lit={run.lit.has(id) ? '' : undefined} data-ops-node={id} data-ops-port={b.state} key={id} role="listitem">
              <span data-ops-node-title="">{id}</span>
              <span data-ops-node-body="">{b.text}</span>
            </div>
          )
        })}
      </div>
      <ul aria-label="Canvas edges" data-ops-canvas-edges="">
        {CANVAS_EDGES.map(([a, b]) => (
          <li data-ops-edge={`${a}->${b}`} key={`${a}-${b}`}>
            {a} → {b}
          </li>
        ))}
      </ul>
      <section aria-label="Test run" data-ops-run-panel="">
        <textarea aria-label="Test run input" onChange={e => setInput(e.target.value)} value={input} />
        <button data-ops-test-run="" disabled={!runs || active} onClick={() => void start()} type="button">
          Test run
        </button>
        {!runs ? <span>Runs bridge unavailable</span> : null}
        <div data-ops-run-status={run.status}>{run.status}</div>
        <div data-ops-run-elapsed="">{ms === null ? '' : `${(ms / 1000).toFixed(1)} s`}</div>
        <div data-ops-run-tokens="">{run.tokens} streamed tokens</div>
        <pre data-ops-run-text="">{run.text}</pre>
        {run.error ? <div role="alert">{run.error}</div> : null}
        {run.tools.map(t => (
          <details data-ops-run-tool={t.kind} key={t.id}>
            <summary>
              {t.kind === 'skill' ? 'Skill' : 'Tool'} {t.tool} ({t.status})
            </summary>
            <pre>{t.preview ?? ''}</pre>
          </details>
        ))}
        {run.subagents.map(s => (
          <details data-ops-run-subagent={s.id} key={s.id}>
            <summary>
              Sub-agent {s.id} ({s.status})
            </summary>
            <p>{s.goal ?? ''}</p>
          </details>
        ))}
      </section>
    </div>
  )
}
