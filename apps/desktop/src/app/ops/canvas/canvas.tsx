/**
 * Canvas, read-only (ops-panel P3-03). Every node shows backend data or an explicit
 * "not available yet" capability state. Test run (D7): one click, no confirm dialog,
 * no token cap; tokens and elapsed time stream live.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { CronJobLite, DelegationView, ModelNode, PolicyView, PromptNode } from '../feed/ops-client'
import { canvasInspectorDetail, usePublishInspectorDetail } from '../inspector-detail'
import { opsMainLocale, P, T } from '../main-i18n'

import { ComposePanel } from './compose-view'
import { saveAllCanvas, useCanvasDirtyCount } from './dirty-store'
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
  /** G86 (P8 b5): the note captured with the newest Prompt backup; null = none, undefined = not loaded. */
  promptNote?: string | null
}

/** P8 b5: drawn edge geometry. Node slots are laid out per column in CANVAS_NODES order. */
export const EDGE_COL_W = 300
export const EDGE_ROW_H = 96

export function nodeSlot(id: CanvasNodeId): { x: number; y: number } {
  const col = CANVAS_COLUMN[id]
  const row = CANVAS_NODES.filter(n => CANVAS_COLUMN[n] === col).indexOf(id)
  const c = { left: 0, centre: 1, right: 2 }[col]

  return { x: c * EDGE_COL_W + EDGE_COL_W / 2, y: row * EDGE_ROW_H + EDGE_ROW_H / 2 }
}

/** Horizontal-tangent cubic from the right edge of `a` to the left edge of `b` (vertical when same column). */
export function edgePath(a: CanvasNodeId, b: CanvasNodeId): string {
  const p = nodeSlot(a)
  const q = nodeSlot(b)

  if (p.x === q.x) {
    return `M ${p.x} ${p.y + 20} C ${p.x} ${(p.y + q.y) / 2}, ${q.x} ${(p.y + q.y) / 2}, ${q.x} ${q.y - 20}`
  }

  const dir = q.x > p.x ? 1 : -1
  const x1 = p.x + (dir * EDGE_COL_W) / 2 - dir * 12
  const x2 = q.x - (dir * EDGE_COL_W) / 2 + dir * 12
  const mx = (x1 + x2) / 2

  return `M ${x1} ${p.y} C ${mx} ${p.y}, ${mx} ${q.y}, ${x2} ${q.y}`
}

/** Live pass B9: node box in the nodes layer's own (untransformed) coordinates. */
export interface NodeRect {
  x: number
  y: number
  w: number
  h: number
}

const r1 = (n: number) => Math.round(n * 10) / 10

/** Edge between two measured node boxes: stacked nodes join bottom to top, side-by-side nodes join facing edges.
 *  The fixed-slot edgePath() drew lines through the middle of the real grid, because the grid's row heights
 *  follow the content and the column widths follow the pane, not EDGE_ROW_H / EDGE_COL_W. */
export function edgePathFromRects(p: NodeRect, q: NodeRect): string {
  const pc = p.x + p.w / 2
  const qc = q.x + q.w / 2

  if (Math.abs(pc - qc) < 1) {
    const down = q.y >= p.y
    const y1 = down ? p.y + p.h : p.y
    const y2 = down ? q.y : q.y + q.h
    const my = (y1 + y2) / 2

    return `M ${r1(pc)} ${r1(y1)} C ${r1(pc)} ${r1(my)}, ${r1(qc)} ${r1(my)}, ${r1(qc)} ${r1(y2)}`
  }

  const right = qc > pc
  const x1 = right ? p.x + p.w : p.x
  const x2 = right ? q.x : q.x + q.w
  const y1 = p.y + p.h / 2
  const y2 = q.y + q.h / 2
  const mx = (x1 + x2) / 2

  return `M ${r1(x1)} ${r1(y1)} C ${r1(mx)} ${r1(y1)}, ${r1(mx)} ${r1(y2)}, ${r1(x2)} ${r1(y2)}`
}

/** Measured boxes of every [data-ops-node] under layer, or null when layout is not real (jsdom, hidden pane). */
export function measureNodes(layer: HTMLElement): Partial<Record<CanvasNodeId, NodeRect>> | null {
  const out: Partial<Record<CanvasNodeId, NodeRect>> = {}
  let real = false

  layer.querySelectorAll<HTMLElement>('[data-ops-node]').forEach(el => {
    const id = el.getAttribute('data-ops-node') as CanvasNodeId
    out[id] = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight }
    real ||= el.offsetWidth > 0
  })

  return real ? out : null
}

/** Ctrl/Cmd + wheel zooms by one step; a plain wheel pans vertically (Shift = horizontally). */
export function wheelAction(e: { deltaY: number; deltaX?: number; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }): { zoom: 1 | -1 } | { pan: [number, number] } | null {
  if (e.ctrlKey || e.metaKey) {
    return e.deltaY === 0 ? null : { zoom: e.deltaY < 0 ? 1 : -1 }
  }

  const d = e.deltaY || e.deltaX || 0

  return d === 0 ? null : { pan: e.shiftKey ? [-d, 0] : [0, -d] }
}

/** G42: every node opens a detail popover; these are its rows (no invented values). */
export function nodeDetail(id: CanvasNodeId, d: CanvasData): [string, string][] {
  switch (id) {
    case 'model':
      return d.model ? [['Provider', d.model.provider || 'unset'], ['Model', d.model.model || 'unset']] : [['State', 'unknown']]

    case 'prompt':
      return d.prompt
        ? [
            ['Exists', d.prompt.exists ? 'yes' : 'no'],
            ['Lines', String((d.prompt.content ?? '').split(/\r?\n/).filter(Boolean).length)],
            ['Words', String((d.prompt.content ?? '').split(/\s+/).filter(Boolean).length)],
            ['Last change', d.promptNote ?? (d.promptNote === null ? 'no note' : 'unknown')]
          ]
        : [['State', 'unknown']]

    case 'schedule':
      return d.cron ? d.cron.slice(0, 8).map(j => [String(j.name ?? j.id), j.enabled === false ? 'paused' : (j.failure_streak ?? 0) > 0 ? `${j.failure_streak} failing` : 'ok']) : [['State', 'unknown']]

    case 'identity':
      return d.identity ? [['Name', d.identity.name], ['Description', d.identity.description || 'unset']] : [['State', 'unknown']]

    case 'memory':
      return d.memory ? [['Provider', d.memory.active || 'built-in'], ...Object.entries(d.memory.builtin_files ?? {}).map(([k, v]) => [k, `${v} bytes`] as [string, string])] : [['State', 'unknown']]

    case 'skills':
      return [['Installed', typeof d.skills === 'number' ? String(d.skills) : 'unknown']]

    case 'delegation':
      return d.delegation ? [['Inherits model', d.delegation.inherit_model ? 'yes' : 'no'], ['Provider', d.delegation.provider ?? '—'], ['Model', d.delegation.model ?? '—']] : [['State', 'unknown']]

    case 'policy':
      return d.policy ? [['Source', d.policy.source], ...(d.policy.violations ?? []).map(v => [v.field, (v as { message?: string }).message ?? 'violation'] as [string, string])] : [['State', 'unknown']]

    default:
      return [['State', UNAVAILABLE]]
  }
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
/** B20 (Outglow): every node type has a glyph tile and a localized title. */
export const NODE_GLYPH: Record<string, string> = { schedule: '◷', identity: '◉', prompt: '¶', tools: '⚒', policy: '⛨', skills: '✦', channels: '⇄', model: '◈', memory: '▤', delegation: '⤳' }
export const nodeTitle = (id: string): string => T(id.charAt(0).toUpperCase() + id.slice(1))

/** Accessible names keep the stable lowercase id in English (tests, screen-reader muscle memory); other locales get the title. */
const nodeAria = (id: string): string => (opsMainLocale() === 'en' ? id : nodeTitle(id))

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
        ? {
            text: `${(d.prompt.content ?? '').split(/\r?\n/).find(l => l.trim()) ?? '(empty)'}${d.promptNote ? ` · last change: ${d.promptNote}` : ''}`,
            state: 'ok'
          }
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
        text: `${d.cron.length} ${T('cron jobs')}${next ? `, ${T('next')} ${new Date(next).toISOString()}` : ''}${failing ? `, ${failing} ${T('failing')}` : ''}`,
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
      return typeof d.skills === 'number' ? { text: P(d.skills, '{n} skills installed', '{n} skill installed'), state: d.skills ? 'ok' : 'unset' } : { text: 'unknown', state: 'unknown' }

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
  onOpenRoute,
  now = () => Date.now()
}: {
  profile: string
  data: CanvasData
  readOnly?: boolean
  /** G51: the unset Identity CTA opens Desktop's profile setup. */
  onOpenRoute?: (route: string) => void
  runs?: RunsBridge | null
  now?: () => number
}) {
  const [run, setRun] = useState<RunView>(initialRun)
  const [zoom, setZoom] = useState(1)
  const [runOpen, setRunOpen] = useState(true)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const [collapsed, setCollapsed] = useState<Set<CanvasNodeId>>(() => new Set())
  const nodesLayer = useRef<HTMLDivElement>(null)
  const [rects, setRects] = useState<Partial<Record<CanvasNodeId, NodeRect>> | null>(null)
  const [layerSize, setLayerSize] = useState({ w: 0, h: 0 })

  // B9: edges follow the real node boxes. offset* ignore the pan/zoom transform, so this runs on layout changes only.
  useLayoutEffect(() => {
    const layer = nodesLayer.current

    if (!layer) {
      return
    }

    const measure = () => {
      setRects(measureNodes(layer))
      setLayerSize({ w: layer.offsetWidth, h: layer.offsetHeight })
    }

    measure()

    if (typeof ResizeObserver === 'undefined') {
      return
    }

    const ro = new ResizeObserver(measure)
    ro.observe(layer)
    layer.querySelectorAll('[data-ops-node]').forEach(el => ro.observe(el))

    return () => ro.disconnect()
  }, [collapsed, data])
  const [detail, setDetail] = useState<CanvasNodeId | null>(null)
  usePublishInspectorDetail(
    canvasInspectorDetail(
      profile,
      detail,
      detail ? nodeDetail(detail, data) : [],
      [
        ['Model', data.model ? `${data.model.provider || 'unset'} / ${data.model.model || 'unset'}` : 'unknown'],
        ['Prompt', data.prompt ? (data.prompt.exists ? 'present' : 'missing') : 'unknown'],
        ['Skills', typeof data.skills === 'number' ? String(data.skills) : 'unknown'],
        ['Policy', data.policy?.source ?? 'unknown'],
        ['Scheduled jobs', data.cron ? String(data.cron.length) : 'unknown']
      ],
      data.promptNote ? [data.promptNote] : []
    )
  )
  const dirtyCount = useCanvasDirtyCount(profile)
  const [saveNote, setSaveNote] = useState<string | null>(null)

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
        <strong>{T("Canvas ·")}{' '}{profile}</strong>
        {readOnly ? <span data-ops-badge="remote">{T("remote: read-only")}</span> : null}
        {/* G57: one header save for every dirty node; disabled at 0. */}
        {readOnly ? null : (
        <button data-ops-save-all={dirtyCount}
          data-ops-write=""
          disabled={readOnly || dirtyCount === 0}
          onClick={async () => {
            const r = await saveAllCanvas(profile)
            setSaveNote(r.failed.length ? `Saved ${r.saved}; not saved: ${r.failed.join(', ')}` : `Saved ${r.saved}`)
          }}
          type="button"
        >
          {T("Save all (")}{dirtyCount})
        </button>
        )}
        {saveNote ? <span role="status">{saveNote}</span> : null}
      </header>
      {readOnly ? null : (
        <ComposePanel
          edges={CANVAS_EDGES}
          onStaged={nodes => {
            if (nodes.includes('prompt') || nodes.includes('model')) {
              setDetail(nodes.includes('model') ? 'model' : 'prompt')
            }
          }}
          profile={profile}
        />
      )}
      <div
        aria-label={T("Canvas viewport (drag the background or Shift+arrows to pan)")}
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
        onWheel={e => {
          const a = wheelAction(e)

          if (!a) {
            return
          }

          if ('zoom' in a) {
            setZoom(z => stepZoom(z, a.zoom))
          } else {
            setPan(p => clampPan({ x: p.x + a.pan[0], y: p.y + a.pan[1] }))
          }
        }}
        role="group"
        style={{ overflow: 'hidden', position: 'relative', touchAction: 'none' }}
        tabIndex={0}
      >
      <div
        data-ops-canvas-nodes=""
        data-ops-pan={`${pan.x},${pan.y}`}
        ref={nodesLayer}
        role="list"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          position: 'relative'
        }}
      >
        <svg
          aria-hidden
          data-ops-edge-layer=""
          height={rects ? layerSize.h : EDGE_ROW_H * 4}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
          viewBox={rects ? `0 0 ${layerSize.w} ${layerSize.h}` : `0 0 ${EDGE_COL_W * 3} ${EDGE_ROW_H * 4}`}
          width={rects ? layerSize.w : '100%'}
        >
          {CANVAS_EDGES.map(([a, b]) => (
            <path
              d={rects?.[a] && rects[b] ? edgePathFromRects(rects[a]!, rects[b]!) : edgePath(a, b)}
              data-ops-edge-lit={run.lit.has(a) && run.lit.has(b) ? '' : undefined}
              data-ops-edge-path={`${a}->${b}`}
              fill="none"
              key={`${a}-${b}`}
              stroke={collapsed.has(a) || collapsed.has(b) ? 'var(--ops-muted, #6b6b6b)' : 'var(--ops-gold, #c9a227)'}
              strokeWidth={1.5}
            />
          ))}
        </svg>
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
              data-ops-selected={detail === id ? '' : undefined}
              key={id}
              role="listitem"
              style={{ gridColumn: { left: 1, centre: 2, right: 3 }[CANVAS_COLUMN[id]], gridRow: CANVAS_NODES.filter(n => CANVAS_COLUMN[n] === CANVAS_COLUMN[id]).indexOf(id) + 1 }}
            >
              <button aria-expanded={!closed} aria-label={T(closed ? 'Expand {id}' : 'Collapse {id}').replace('{id}', nodeAria(id))} data-ops-node-collapse="" onClick={() => toggle(id)} type="button">
                {closed ? '+' : '−'}
              </button>
              <button aria-expanded={detail === id} aria-haspopup="dialog" data-ops-node-title="" onClick={() => setDetail(d => (d === id ? null : id))} type="button">
                <span aria-hidden data-ops-node-icon="">{NODE_GLYPH[id] ?? '•'}</span>
                {nodeTitle(id)}
              </button>
              {closed ? null : <span data-ops-node-body="">{T(b.text)}</span>}
              {id === 'identity' && b.state === 'unset' ? (
                <button data-ops-identity-cta="" data-ops-port-colour="amber" disabled={readOnly || !onOpenRoute} onClick={() => onOpenRoute?.(`/profiles?profile=${encodeURIComponent(profile)}&edit=identity`)} type="button">
                  {T("Set identity")}</button>
              ) : null}
              {detail === id ? (
                <div aria-label={T('{id} details').replace('{id}', nodeAria(id))} data-ops-node-detail={id} onKeyDown={e => e.key === 'Escape' && setDetail(null)} role="dialog">
                  <dl>
                    {nodeDetail(id, data).map(([k, v], i) => (
                      <div key={`${k}-${i}`}>
                        <dt>{T(k)}</dt>
                        <dd>{T(v)}</dd>
                      </div>
                    ))}
                  </dl>
                  <button onClick={() => setDetail(null)} type="button">
                    {T("Close")}</button>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
      </div>
      <div
        aria-label={T("Canvas zoom")}
        data-ops-canvas-zoom={String(zoom)}
        data-ops-zoom-position="bottom-centre"
        role="toolbar"
        style={{ position: 'sticky', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 1, width: 'max-content' }}
      >
        <button aria-label={T("Zoom out")} disabled={zoom <= ZOOM_STEPS[0]} onClick={() => setZoom(z => stepZoom(z, -1))} type="button">
          −
        </button>
        <span>{Math.round(zoom * 100)}%</span>
        <button aria-label={T("Zoom in")} disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]} onClick={() => setZoom(z => stepZoom(z, 1))} type="button">
          +
        </button>
        <button aria-label={T("Fit")} onClick={() => (setZoom(1), setPan({ x: 0, y: 0 }))} type="button">
          {T("Fit")}</button>
        <button aria-label={T("Collapse all")} onClick={() => setCollapsed(c => (c.size === CANVAS_NODES.length ? new Set() : new Set(CANVAS_NODES)))} type="button">
          {collapsed.size === CANVAS_NODES.length ? 'Expand all' : 'Collapse all'}
        </button>
      </div>
      <ul aria-label={T("Canvas edges")} data-ops-canvas-edges="">
        {CANVAS_EDGES.map(([a, b]) => (
          <li data-ops-edge={`${a}->${b}`} key={`${a}-${b}`}>
            {a} → {b}
          </li>
        ))}
      </ul>
      <button aria-expanded={runOpen} data-ops-run-toggle="" onClick={() => setRunOpen(o => !o)} type="button">
        {runOpen ? 'Hide run panel' : 'Show run panel'}
      </button>
      <section aria-label={T("Test run")} data-ops-run-panel="" hidden={!runOpen}>
        <textarea aria-label={T("Test run input")} onChange={e => setInput(e.target.value)} value={input} />
        <button data-ops-test-run="" data-ops-write="" disabled={!runs || active} onClick={() => void start()} type="button">
          {T("Test run")}</button>
        {!runs ? <span>{T("Runs bridge unavailable")}</span> : null}
        <div data-ops-run-status={run.status}>{run.status}</div>
        <div data-ops-run-elapsed="">{ms === null ? '' : `${(ms / 1000).toFixed(1)} s`}</div>
        <div data-ops-run-tokens="">{run.tokens} {T("streamed tokens")}</div>
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
              {T("Sub-agent")}{' '}{s.id} ({s.status})
            </summary>
            <p>{s.goal ?? ''}</p>
          </details>
        ))}
      </section>
    </div>
  )
}
