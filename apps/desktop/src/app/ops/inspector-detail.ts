/**
 * B10: the Inspector's real detail. Views publish what is selected (a Board card, a Canvas node, the
 * Settings summary) into this tiny store; the Inspector reads it. Nothing is fetched here, and a
 * value the view does not know is left out instead of shown as 0 or "unset".
 */

import { useEffect, useSyncExternalStore } from 'react'

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

let current: InspectorDetail | null = null
const listeners = new Set<() => void>()

export function publishInspectorDetail(detail: InspectorDetail | null): void {
  current = detail
  listeners.forEach(listener => listener())
}

export function getInspectorDetail(): InspectorDetail | null {
  return current
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function useInspectorDetail(): InspectorDetail | null {
  return useSyncExternalStore(subscribe, getInspectorDetail, () => null)
}

/** Publish while mounted; clear on unmount (only if this view still owns the slot). */
export function usePublishInspectorDetail(detail: InspectorDetail | null): void {
  const key = detail ? JSON.stringify(detail) : ''

  useEffect(() => {
    publishInspectorDetail(detail)

    return () => {
      if (current && detail && current.kind === detail.kind && current.id === detail.id) {
        publishInspectorDetail(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
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
  push(rows, 'Priority', typeof t.priority === 'number' ? `P${t.priority}` : null)
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
    body: t.body ? t.body.slice(0, 600) : null,
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
