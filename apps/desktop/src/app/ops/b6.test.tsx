import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { latestDiff, TaskTabView } from './detail/task-tab'
import type { TaskDetail } from './feed/ops-actions'
import { fleetRows } from './lenses/b4-model'
import { applyOpsLaunchRoute, isColdStartHash, launchRouteFromPrefs } from './motion/launch'
import { opsLaunchRoute } from './motion/settings'
import { CopyLink, linkFor, setCopyWriter } from './office/copy-link'
import { handoffArcs } from './office/office'

afterEach(() => cleanup())

const detail = (): TaskDetail => ({
  task: { id: 't1', title: 'Fix build', status: 'review', assignee: 'builder' },
  comments: [],
  events: [{ id: 1, task_id: 't1', kind: 'created', payload: null, created_at: 0 }],
  attachments: [{ id: 'a1', filename: 'report.md' }],
  links: { parents: [], children: [] },
  child_results: [],
  runs: [
    { id: 1, task_id: 't1', profile: 'builder', status: 'ended', started_at: 1, metadata: { diff: 'old' } },
    { id: 2, task_id: 't1', profile: 'builder', status: 'ended', started_at: 5, metadata: JSON.stringify({ diffstat: ' 2 files changed' }) }
  ]
})

describe('X9 evidence flow', () => {
  it('picks the newest run diff and tolerates bad metadata', () => {
    expect(latestDiff(detail().runs!)).toBe(' 2 files changed')
    expect(latestDiff([{ metadata: '{bad' }, { metadata: null }])).toBeNull()
  })

  it('renders timeline, runs, diff and outputs before every action', () => {
    render(<TaskTabView detail={detail()} onAction={vi.fn()} />)
    const actions = document.querySelector('[data-ops-task-actions]')!

    for (const sel of ['[data-ops-timeline]', '[data-ops-runs]', '[data-ops-diff]', '[data-ops-attachments]']) {
      const el = document.querySelector(sel)!

      expect(el.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }

    expect(document.querySelector('[data-ops-diff-body]')?.textContent).toContain('2 files changed')
    expect(actions.querySelector('select[aria-label="assignee"]')).toBeTruthy()
  })
})

describe('R55 startup hook', () => {
  const store = (v: unknown) => ({ getItem: () => (v === undefined ? null : JSON.stringify(v)) })

  it('opens the default Ops tab only on a cold start when enabled', () => {
    const loc = { hash: '' }

    expect(applyOpsLaunchRoute(loc, store({ openOnLaunch: true, defaultTab: 'board' }))).toBe('/ops/board')
    expect(loc.hash).toBe('#/ops/board')

    const deep = { hash: '#/session/abc' }

    expect(applyOpsLaunchRoute(deep, store({ openOnLaunch: true }))).toBeNull()
    expect(deep.hash).toBe('#/session/abc')
    expect(applyOpsLaunchRoute({ hash: '#/' }, store({ openOnLaunch: false }))).toBeNull()
    expect(isColdStartHash('#/')).toBe(true)
  })

  it('agrees with the Settings preview and survives junk', () => {
    expect(launchRouteFromPrefs(JSON.stringify({ openOnLaunch: true, defaultTab: 'nope' }))).toBe('/ops/office')
    expect(launchRouteFromPrefs('{')).toBeNull()
    expect(opsLaunchRoute({ openOnLaunch: true, defaultTab: 'canvas' } as never)).toBe(launchRouteFromPrefs(JSON.stringify({ openOnLaunch: true, defaultTab: 'canvas' })))
  })
})

describe('X12 copy link', () => {
  it('builds routes and reports copy state', async () => {
    expect(linkFor('run', '7')).toBe('/ops/run/7')
    expect(linkFor('task', 't 1')).toBe('/kanban?task=t%201')
    const w = vi.fn().mockResolvedValue(undefined)

    setCopyWriter(w)
    render(<CopyLink id="t_abc" kind="task" />)
    const b = document.querySelector('[data-ops-copy-link="task:t_abc"]')!

    await act(async () => {
      fireEvent.click(b)
    })
    expect(w).toHaveBeenCalledWith('/kanban?task=t_abc')
    expect(b.getAttribute('data-ops-copy-state')).toBe('copied')

    setCopyWriter(() => Promise.reject(new Error('no clipboard')))
    await act(async () => {
      fireEvent.click(b)
    })
    expect(b.getAttribute('data-ops-copy-state')).toBe('failed')
  })
})

describe('X7 handoff arcs and Fleet runs', () => {
  it('arcs only recent real handoffs', () => {
    const ev = (id: number, at: number, payload: unknown, kind = 'assigned') => ({ id, task_id: 't', kind, payload, created_at: at })

    expect(
      handoffArcs([ev(1, 95, { from: 'a', assignee: 'b' }), ev(2, 50, { from: 'a', assignee: 'b' }), ev(3, 99, { assignee: 'b' }), ev(4, 99, { from: 'b', assignee: 'b' }), ev(5, 99, { from: 'a', assignee: 'c' }, 'commented')], 100)
    ).toEqual([{ id: 1, from: 'a', to: 'b' }])
  })

  it('counts real runs when stats exist, task starts otherwise', () => {
    const tasks = [{ id: 't', title: 'x', status: 'done', assignee: 'a', started_at: 99 }] as never
    const [withStats] = fleetRows([{ name: 'a' }], tasks, [], 100, { a: { runs: 5, failed: 2, last_started_at: 120 } } as never)
    const [without] = fleetRows([{ name: 'a' }], tasks, [], 100)

    expect([withStats.runs7d, withStats.runsSource, withStats.failed7d, withStats.lastActive]).toEqual([5, 'runs', 2, 120])
    expect([without.runs7d, without.runsSource, without.failed7d]).toEqual([1, 'task-starts', null])
  })
})
