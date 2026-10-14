import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** B10: the Inspector shows real Board / Canvas / Settings detail instead of the shell stub. */
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { I18nProvider } from '@/i18n'

import { Inspector } from './inspector'
import {
  boardInspectorSummary,
  canvasInspectorDetail,
  detailKindForSlot,
  getInspectorDetail,
  publishInspectorDetail,
  taskInspectorDetail
} from './inspector-detail'
import { loadScope } from './navigation-store'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')

afterEach(() => {
  cleanup()
  publishInspectorDetail(null)
})

const scopeFor = (kind: string) =>
  ({
    ...loadScope('local', 'default'),
    inspectorOpen: true,
    tabs: [{ id: kind, kind, label: kind }],
    selectedTabId: kind,
    inspectorSlot: kind === 'canvas' ? 'node' : kind === 'board' ? 'task' : 'row'
  }) as never

const mount = (kind: string) =>
  render(
    <I18nProvider>
      <Inspector fleet={{ a1: 'missing', a3: 'missing', rows: [] }} focusedRun={null} onSlot={() => undefined} overlay={false} scope={scopeFor(kind)} />
    </I18nProvider>
  )

describe('B10 inspector detail builders', () => {
  it('a task lists only the fields the board knows, never invented zeros', () => {
    const d = taskInspectorDetail({ id: 't_1', title: 'Ship it', status: 'review', priority: 2, comment_count: 3, created_at: 1_700_000_000 })
    const labels = d.rows.map(r => r[0])

    expect(d).toMatchObject({ kind: 'task', id: 't_1', title: 'Ship it', badge: 'review' })
    expect(labels).toEqual(['Assignee', 'Priority', 'Comments', 'Created'])
    expect(d.rows[0][1]).toBe('Unassigned')
    expect(d.rows[1][1]).toBe('P2')
    expect(labels).not.toContain('Started')
  })

  it('the board summary counts non-empty columns and hints to select a card', () => {
    const d = boardInspectorSummary({ columns: [{ name: 'ready', tasks: [{ id: 'a', title: 'a', status: 'ready' }] }, { name: 'done', tasks: [] }] })

    expect(d.rows).toEqual([['ready', '1']])
    expect(d.badge).toBe('1 cards')
    expect(d.hint).toMatch(/Select a card/)
    expect(boardInspectorSummary(null).badge).toBeNull()
  })

  it('canvas: profile summary without a node, node rows with one', () => {
    expect(canvasInspectorDetail('default', null, [], [['Model', 'x / y']], []).hint).toMatch(/Select a node/)
    expect(canvasInspectorDetail('default', 'model', [['Provider', 'x']], [], ['note']).title).toBe('Model')
  })

  it('maps slots to detail kinds', () => {
    expect(detailKindForSlot('task')).toBe('task')
    expect(detailKindForSlot('history')).toBe('node')
    expect(detailKindForSlot('row')).toBe('settings')
    expect(detailKindForSlot('events')).toBeNull()
  })
})

describe('B10 inspector rendering', () => {
  it('renders the published task detail in the Board inspector', () => {
    mount('board')
    act(() => publishInspectorDetail(taskInspectorDetail({ id: 't_9', title: 'Fix login', status: 'blocked', assignee: 'sandhi' })))

    expect(document.querySelector('[data-ops-inspector-detail="task"]')).toBeTruthy()
    expect(screen.getByText('Fix login')).toBeTruthy()
    expect(screen.getByText('sandhi')).toBeTruthy()
    expect(document.querySelector('[data-ops-inspector-badge]')?.textContent).toBe('blocked')
    expect(document.body.textContent).not.toMatch(/not built in this shell/)
  })

  it('ignores a detail of another kind and falls back to an honest empty state', () => {
    mount('board')
    act(() => publishInspectorDetail(canvasInspectorDetail('default', 'model', [['Provider', 'x']], [], [])))

    expect(document.querySelector('[data-ops-inspector-detail]')).toBeNull()
    expect(document.querySelector('[data-ops-unavailable]')?.textContent).toMatch(/Nothing selected/)
    expect(document.querySelector('.ops-why-footer')).toBeNull()
  })

  it('the stub copy is gone from en and es', () => {
    const src = read('locales.ts')

    expect(src).not.toContain('detail is not built in this shell')
    expect(src).not.toContain('no está construido en este shell')
  })

  it('Board, Canvas and Settings publish their detail', () => {
    expect(read('board/board.tsx')).toContain('usePublishInspectorDetail(openTask ? taskInspectorDetail(openTask) : boardInspectorSummary(board ?? null))')
    expect(read('canvas/canvas.tsx')).toContain('usePublishInspectorDetail(')
    expect(read('motion/settings.tsx')).toContain("kind: 'settings'")
    expect(getInspectorDetail()).toBeNull()
  })
})
