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
  /** P6: skill count from /api/profiles; undefined = not loaded. */
  skills?: number | null
  /** P7: identity from the kanban profile roster (display name + description). */
  identity?: { name: string; description: string } | null
  /** P7: /api/memory for the profile. */
  memory?: { active: string; builtin_files?: Record<string, number> } | null
}

export const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5] as const

export function stepZoom(z: number, dir: 1 | -1): number {
  const i = ZOOM_STEPS.findIndex(v => v >= z)
  const at = i < 0 ? ZOOM_STEPS.length - 1 : i

  return ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, at + dir))]
}

export const CANVAS_NODES = ['identity', 'prompt', 'model', 'tools', 'skills', 'delegation', 'schedule', 'policy', 'channels', 'memory'] as const

/** G48: fixed three-column layout; left = inputs, centre = Identity/Prompt/Model, right = Tools/Skills/Delegation. */
export const CANVAS_COLUMN: Record<(typeof CANVAS_NODES)[number], 'left' | 'centre' | 'right'> = {
  schedule: 'left',
  policy: 'left',
  channels: 'left',
  memory: 'left',
  identity: 'centre',
  prompt: 'centre',
  model: 'centre',
  tools: 'right',
  skills: 'right',
  delegation: 'right'
}

/** P8: the graph can never be panned fully out of sight (Fit still recentres). */
export const PAN_LIMIT = 2000
export const clampPan = (p: { x: number; y: number }) => ({
  x: Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, p.x)),
  y: Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, p.y))
})

const PAN_KEYS = { ArrowLeft: [-40, 0], ArrowRight: [40, 0], ArrowUp: [0, -40], ArrowDown: [0, 40] } as const

/** G49: port colour by node state. */
export const PORT_COLOUR = { ok: 'champagne', unset: 'amber', policy: 'garnet', unknown: 'muted' } as const
export type CanvasNodeId = (typeof CANVAS_NODES)[number]

export const CANVAS_EDGES: [CanvasNodeId, CanvasNodeId][] = [
  ['identity', 'prompt'],
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
    case 'schedule': {
      if (!d.cron) {
        return { text: 'unknown', state: 'unknown' }
      }

      const next = d.cron
        .filter(j => j.enabled !== false)
        .map(j => (typeof j.next_run_at === 'number' ? j.next_run_at * 1000 : typeof j.next_run_at === 'string' ? Date.parse(j.next_run_at) : NaN))
        .filter(Number.isFinite)
        .sort((a, b) => a - b)[0]

      const failing = d.cron.filter(j => (j.failure_streak ?? 0) > 0).length

      return {
        text: `${d.cron.length} cron jobs${next ? `, next ${new Date(next).toISOString()}` : ''}${failing ? `, ${failing} failing` : ''}`,
        state: failing ? 'policy' : d.cron.length ? 'ok' : 'unset'
      }
    }

    case 'identity':
      return d.identity === undefined || d.identity === null
        ? { text: 'unknown', state: 'unknown' }
        : d.identity.description
          ? { text: `${d.identity.name}: ${d.identity.description}`, state: 'ok' }
          : { text: `${d.identity.name} (no description)`, state: 'unset' }
    case 'memory': {
      if (!d.memory) {
        return { text: 'unknown', state: 'unknown' }
      }

      const files = d.memory.builtin_files ?? {}
      const bytes = Object.values(files).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)

      return { text: `${d.memory.active || 'built-in'} memory, ${bytes} bytes in MEMORY/USER`, state: 'ok' }
    }

    case 'skills':
      return typeof d.skills === 'number' ? { text: `${d.skills} skills installed`, state: d.skills ? 'ok' : 'unset' } : { text: 'unknown', state: 'unknown' }

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
  const [zoom, setZoom] = useState(1)
  const [runOpen, setRunOpen] = useState(true)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const [collapsed, setCollapsed] = useState<Set<CanvasNodeId>>(() => new Set())

  const toggle = (id: CanvasNodeId) =>
    setCollapsed(c => {
      const n = new Set(c)

      if (n.has(id)) {
        n.delete(id)
      } else {
        n.add(id)
      }

      return n
    })

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
      <div
        aria-label="Canvas viewport (drag the background or Shift+arrows to pan)"
        data-ops-canvas-viewport=""
        onKeyDown={e => {
          const step = (PAN_KEYS as Record<string, readonly [number, number] | undefined>)[e.key]

          if (e.shiftKey && step) {
            e.preventDefault()
            setPan(p => clampPan({ x: p.x + step[0], y: p.y + step[1] }))
          }
        }}
        onLostPointerCapture={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onPointerDown={e => {
          // G56: only the bare background pans; node controls are never intercepted.
          if (e.target !== e.currentTarget) {
            return
          }

          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }

          // P8: capture so a drag that leaves the viewport still ends on release.
          try {
            e.currentTarget.setPointerCapture?.(e.pointerId)
          } catch {
            // jsdom / synthetic pointer ids
          }
        }}
        onPointerMove={e => {
          const d = drag.current

          // P8: a move with no button held (release outside the window) ends the drag.
          if (d && e.buttons === 0 && e.pointerType === 'mouse') {
            drag.current = null

            return
          }

          if (d) {
            setPan(clampPan({ x: d.px + e.clientX - d.x, y: d.py + e.clientY - d.y }))
          }
        }}
        onPointerUp={() => (drag.current = null)}
        role="group"
        style={{ overflow: 'hidden', position: 'relative', touchAction: 'none' }}
        tabIndex={0}
      >
      <div
        data-ops-canvas-nodes=""
        data-ops-pan={`${pan.x},${pan.y}`}
        role="list"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {CANVAS_NODES.map(id => {
          const b = nodeBody(id, data)
          const closed = collapsed.has(id)

          return (
            <div
              data-ops-collapsed={closed ? '' : undefined}
              data-ops-column={CANVAS_COLUMN[id]}
              data-ops-lit={run.lit.has(id) ? '' : undefined}
              data-ops-node={id}
              data-ops-port={b.state}
              data-ops-port-colour={PORT_COLOUR[b.state]}
              key={id}
              role="listitem"
              style={{ gridColumn: { left: 1, centre: 2, right: 3 }[CANVAS_COLUMN[id]] }}
            >
              <button aria-expanded={!closed} aria-label={`${closed ? 'Expand' : 'Collapse'} ${id}`} onClick={() => toggle(id)} type="button">
                {closed ? '+' : '−'}
              </button>
              <span data-ops-node-title="">{id}</span>
              {closed ? null : <span data-ops-node-body="">{b.text}</span>}
            </div>
          )
        })}
      </div>
      </div>
      <div
        aria-label="Canvas zoom"
        data-ops-canvas-zoom={String(zoom)}
        data-ops-zoom-position="bottom-centre"
        role="toolbar"
        style={{ position: 'sticky', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 1, width: 'max-content' }}
      >
        <button aria-label="Zoom out" disabled={zoom <= ZOOM_STEPS[0]} onClick={() => setZoom(z => stepZoom(z, -1))} type="button">
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button aria-label="Zoom in" disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} onClick={() => setZoom(z => stepZoom(z, 1))} type="button">
          +
        </button>
        <button aria-label="Fit" onClick={() => (setZoom(1), setPan({ x: 0, y: 0 }))} type="button">
          Fit
        </button>
        <button aria-label="Collapse all" onClick={() => setCollapsed(c => (c.size === CANVAS_NODES.length ? new Set() : new Set(CANVAS_NODES)))} type="button">
          {collapsed.size === CANVAS_NODES.length ? 'Expand all' : 'Collapse all'}
        </button>
      </div>
      <ul aria-label="Canvas edges" data-ops-canvas-edges="">
        {CANVAS_EDGES.map(([a, b]) => (
          <li data-ops-edge={`${a}->${b}`} key={`${a}-${b}`}>
            {a} → {b}
          </li>
        ))}
      </ul>
      <button aria-expanded={runOpen} data-ops-run-toggle="" onClick={() => setRunOpen(o => !o)} type="button">
        {runOpen ? 'Hide run panel' : 'Show run panel'}
      </button>
      <section aria-label="Test run" data-ops-run-panel="" hidden={!runOpen}>
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
