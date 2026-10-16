/**
 * B10: the Inspector's real detail. Views publish what is selected (a Board card, a Canvas node, the
 * Settings summary) into this tiny store; the Inspector reads it. Nothing is fetched here, and a
 * value the view does not know is left out instead of shown as 0 or "unset".
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'

import type { BoardData, BoardTask } from './board/board-model'

export type InspectorDetailKind = 'task' | 'node' | 'settings'

export interface InspectorDetail {
  kind: InspectorDetailKind
  id: string
  title: string
  /** A one-word state shown as a pill next to the title. */
  badge?: string | null
  rows: [string, string][]
  /** Longer text (a task body, a node description). Plain text, never HTML. */
  body?: string | null
  history?: string[]
  /** Text for an empty history list, supplied by the publishing view. */
  historyEmpty?: string
  /** Shown under the rows, e.g. "Select a card to inspect it". */
  hint?: string | null
  source: string
  why: string
}

const details: Partial<Record<InspectorDetailKind, InspectorDetail>> = {}
const owners: Partial<Record<InspectorDetailKind, object>> = {}
let last: InspectorDetail | null = null
const listeners = new Set<() => void>()

const emit = () => listeners.forEach(listener => listener())

/**
 * Publish one view's detail. Each kind has its own slot, so a kept-alive Board tab that re-publishes on
 * every poll never overwrites the Settings or Canvas detail. `null` with a kind clears that slot; `null`
 * with no kind clears every slot.
 */
export function publishInspectorDetail(detail: InspectorDetail | null, by: object | null = null, kind?: InspectorDetailKind): void {
  if (detail) {
    details[detail.kind] = detail

    if (by) {
      owners[detail.kind] = by
    } else {
      delete owners[detail.kind]
    }

    last = detail
  } else if (kind) {
    delete details[kind]
    delete owners[kind]

    if (last?.kind === kind) {
      last = null
    }
  } else {
    for (const k of Object.keys(details) as InspectorDetailKind[]) {
      delete details[k]
      delete owners[k]
    }

    last = null
  }

  emit()
}

/** The detail for one kind; with no argument, the most recently published one. */
export function getInspectorDetail(kind?: InspectorDetailKind | null): InspectorDetail | null {
  if (kind === undefined) {
    return last
  }

  return kind ? (details[kind] ?? null) : null
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function useInspectorDetail(kind: InspectorDetailKind | null): InspectorDetail | null {
  return useSyncExternalStore(subscribe, () => (kind ? (details[kind] ?? null) : null), () => null)
}

/** Publish while mounted; on unmount clear the slot only if this instance still owns it. */
export function usePublishInspectorDetail(detail: InspectorDetail | null): void {
  const key = detail ? JSON.stringify(detail) : ''
  const me = useRef<object>({})
  const kind = detail?.kind ?? null

  useEffect(() => {
    if (detail) {
      publishInspectorDetail(detail, me.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    const token = me.current

    return () => {
      if (kind && owners[kind] === token) {
        publishInspectorDetail(null, null, kind)
      }
    }
  }, [kind])
}

/** Which detail kind an Inspector slot shows. */
export function detailKindForSlot(slot: string): InspectorDetailKind | null {
  if (slot === 'task') {
    return 'task'
  }

  if (slot === 'node' || slot === 'history') {
    return 'node'
  }

  if (slot === 'row' || slot === 'context') {
    return 'settings'
  }

  return null
}

export function formatEpoch(s: number | null | undefined, timeZone?: string): string | null {
  if (typeof s !== 'number' || !Number.isFinite(s) || s <= 0) {
    return null
  }

  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(s * 1000))
  } catch {
    return new Date(s * 1000).toISOString()
  }
}

function push(rows: [string, string][], label: string, value: string | null | undefined) {
  if (value !== null && value !== undefined && value !== '') {
    rows.push([label, value])
  }
}

export function taskInspectorDetail(t: BoardTask, timeZone?: string): InspectorDetail {
  const rows: [string, string][] = []
  push(rows, 'Assignee', t.assignee || 'Unassigned')
  push(rows, 'Priority', typeof t.priority === 'number' && t.priority > 0 ? `P${t.priority}` : null)
  push(rows, 'Project', t.project_id)
  push(rows, 'Tenant', t.tenant)
  push(rows, 'Progress', t.progress && t.progress.total > 0 ? `${t.progress.done} of ${t.progress.total}` : null)
  push(rows, 'Parents / children', t.link_counts ? `${t.link_counts.parents} / ${t.link_counts.children}` : null)
  push(rows, 'Comments', typeof t.comment_count === 'number' ? String(t.comment_count) : null)
  push(rows, 'Failures in a row', t.consecutive_failures ? String(t.consecutive_failures) : null)
  push(rows, 'Skills', t.skills && t.skills.length ? t.skills.join(', ') : null)
  push(rows, 'Created', formatEpoch(t.created_at, timeZone))
  push(rows, 'Started', formatEpoch(t.started_at, timeZone))
  push(rows, 'Last heartbeat', formatEpoch(t.last_heartbeat_at, timeZone))
  push(rows, 'Completed', formatEpoch(t.completed_at, timeZone))

  return {
    kind: 'task',
    id: t.id,
    title: t.title || t.id,
    badge: t.status,
    rows,
    body: t.body ? t.body.replace(/<!--[\s\S]*?-->/g, '').trim().slice(0, 600) || null : null,
    source: 'Kanban board',
    why: 'the card open in Board'
  }
}

export function boardInspectorSummary(board: BoardData | null): InspectorDetail {
  const columns = board?.columns ?? []
  const total = columns.reduce((n, c) => n + c.tasks.length, 0)

  return {
    kind: 'task',
    id: 'board',
    title: 'Board',
    badge: board ? `${total} cards` : null,
    rows: columns.filter(c => c.tasks.length > 0).map(c => [c.name, String(c.tasks.length)] as [string, string]),
    hint: total > 0 ? 'Select a card to inspect it.' : 'No cards in this scope yet.',
    source: 'Kanban board',
    why: 'column totals for the current scope'
  }
}

export function canvasInspectorDetail(
  profile: string,
  node: string | null,
  rows: [string, string][],
  summary: [string, string][],
  history: string[]
): InspectorDetail {
  if (!node) {
    return {
      kind: 'node',
      id: `profile:${profile}`,
      title: profile,
      badge: 'profile',
      rows: summary,
      history,
      historyEmpty: 'No saved changes recorded for this profile yet.',
      hint: 'Select a node to inspect it.',
      source: 'Profile canvas',
      why: 'the profile shown in Canvas'
    }
  }

  return {
    kind: 'node',
    id: `${profile}:${node}`,
    title: node.charAt(0).toUpperCase() + node.slice(1),
    badge: profile,
    rows,
    history,
    historyEmpty: 'No saved changes recorded for this profile yet.',
    source: 'Profile canvas',
    why: 'the node selected in Canvas'
  }
}
