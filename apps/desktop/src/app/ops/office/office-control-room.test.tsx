/** P8 batch 2: Office control room (R63-R66, X1-X5, X8). Values are asserted against the fixture board. */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ApprovalItem } from '../feed/ops-client'

import { deliveredToday, myQueue, officeStats, projectProgress, sigil, stuckItems } from './control-room'
import { BOARD, NOW, T } from './control-room.fixtures'
import { NeedsYouQueue } from './needs-you'
import { localDay, OfficeView } from './office'
import { OfficeContainer } from './office-container'

afterEach(() => cleanup())

const cron = [{ id: 'c1', name: 'nightly', failure_streak: 3, last_status: 'error' }, { id: 'c2', name: 'ok', failure_streak: 0 }]
const review = { origin: 'kanban_review', id: 'rev-old', profile: 'builder', session_id: null, run_id: null, tenant: null, exact_request: null, why: '', what_for: '', status: 'pending', expires_at: null, age_s: 10, actions: [] } as ApprovalItem
const cmd = { ...review, origin: 'jsonrpc', id: 'a1', session_id: 's', exact_request: { command: 'ls', pattern_keys: [] }, actions: ['approve', 'deny'] } as ApprovalItem

const base = { nowS: NOW, fleet: null, usage: null, inFlight: [], activity: [], cron, pending: [review, cmd], tasks: BOARD, profile: 'builder' }

describe('R63 stat cards', () => {
  it('values equal the board: working (n stuck), open (n for profile), done this week, needs attention', () => {
    const s = officeStats(BOARD, cron, [review, cmd], 'builder', NOW)
    // running: run-ok, run-stale, p1-run
    expect(s.working).toBe(3)
    // stuck: fail, run-stale, blk, cron c1
    expect(s.stuck).toBe(4)
    // open = not done: 8 rows; for builder: run-ok, run-stale, fail, rev-old, rev-new, todo-hi
    expect(s.open).toBe(8)
    expect(s.openMine).toBe(6)
    expect(s.doneWeek).toBe(2)
    // attention = 4 stuck + jsonrpc a1 + review rev-old (rev-old not stuck) = 6, nothing double counted
    expect(s.attention).toBe(6)
  })

  it('unknown sources stay unknown, never 0', () => {
    expect(officeStats(null, null, null, 'x', NOW)).toEqual({ working: null, stuck: null, open: null, openMine: null, doneWeek: null, attention: null })
  })

  it('renders cards, garnet only when attention > 0, and a click focuses its section', () => {
    render(<OfficeView {...base} />)
    expect(document.querySelector('[data-ops-stat="working"]')?.textContent).toMatch(/3.*Working.*4 stuck/)
    expect(document.querySelector('[data-ops-stat="open"]')?.textContent).toMatch(/8.*6 for builder/)
    expect(document.querySelector('[data-ops-stat="attention"]')?.getAttribute('data-ops-alarm')).toBe('garnet')
    fireEvent.click(document.querySelector('[data-ops-stat="working"]')!)
    expect(document.querySelector('[data-ops-office]')?.getAttribute('data-ops-filter')).toBe('stuck')
    expect(document.querySelector('[data-ops-section="stuck"]')?.hasAttribute('data-ops-focused')).toBe(true)
    expect(document.activeElement?.getAttribute('data-ops-section')).toBe('stuck')
    cleanup()
    render(<OfficeView {...base} cron={[]} pending={[]} tasks={[T('a')]} />)
    expect(document.querySelector('[data-ops-stat="attention"]')?.hasAttribute('data-ops-alarm')).toBe(false)
  })
})

describe('X2 stuck', () => {
  it('lists blocked, stale heartbeat, failing and cron with reason and age, most severe first', () => {
    const s = stuckItems(BOARD, cron, NOW)!
    expect(s.map(x => [x.id, x.reason])).toEqual([
      ['fail', 'failing'],
      ['run-stale', 'stale_heartbeat'],
      ['blk', 'blocked'],
      ['c1', 'cron_failing']
    ])
    expect(s[0].detail).toBe('2 failed run(s): tests red')
    expect(s[1].ageS).toBe(1200)
    render(<OfficeView {...base} />)
    const sec = document.querySelector('[data-ops-section="stuck"]') as HTMLElement
    expect(sec.querySelector('[data-ops-section-count]')?.textContent).toMatch(/4/)
    expect(within(sec).getByText('no heartbeat for 20 min')).toBeTruthy()
    expect(within(sec).getByText('blocked (needs_input)')).toBeTruthy()
  })

  it('empty board says nothing is stuck', () => {
    render(<OfficeView {...base} cron={[]} tasks={[]} />)
    expect(document.querySelector('[data-ops-empty="stuck"]')).toBeTruthy()
  })
})

describe('R64 my queue', () => {
  it('Upcoming / Overdue / Completed with counts; overdue = stale heartbeat or review > 24 h', () => {
    const q = myQueue(BOARD, 'builder', NOW)!
    expect(q.overdue.map(r => [r.task.id, r.why])).toEqual([
      ['run-stale', 'heartbeat 20 min old'],
      ['rev-old', 'in review for 2 d']
    ])
    expect(q.upcoming.map(r => r.task.id)).toEqual(['todo-hi', 'run-ok', 'fail', 'rev-new'])
    expect(q.completed.map(r => r.task.id)).toEqual(['done-1h'])
    render(<OfficeView {...base} />)
    // opens on Overdue because there is overdue work
    expect(document.querySelector('[data-ops-queue-tab="overdue"]')?.getAttribute('aria-selected')).toBe('true')
    expect(document.querySelector('[data-ops-queue-count="upcoming"]')?.textContent).toBe('4')
    fireEvent.click(document.querySelector('[data-ops-queue-tab="completed"]')!)
    expect(document.querySelector('[data-ops-queue-row="done-1h"]')).toBeTruthy()
  })

  it("says You're all caught up when nothing is open", () => {
    render(<OfficeView {...base} tasks={[T('d', { status: 'done', assignee: 'builder', completed_at: NOW })]} />)
    expect(screen.getByText("You're all caught up.")).toBeTruthy()
  })
})

describe('R65 project progress', () => {
  it('status, done/total %, team sigils, updated; newest first', () => {
    const rows = projectProgress([{ id: 'p1', name: 'Launch' }, { id: 'p2', name: 'Empty' }], BOARD)!
    expect(rows[0]).toMatchObject({ id: 'p1', total: 3, done: 2, pct: 67, status: 'active', team: ['builder', 'pixel'], updatedAt: NOW - 10 })
    expect(rows[1]).toMatchObject({ id: 'p2', status: 'empty', updatedAt: null })
    expect(sigil('code-reviewer')).toBe('CR')
    expect(sigil('pixel')).toBe('PI')
    const open = vi.fn()
    render(<OfficeView {...base} onOpenRoute={open} projects={[{ id: 'p1', name: 'Launch' }]} />)
    const row = document.querySelector('[data-ops-project-row="p1"]') as HTMLElement
    expect(row.textContent).toMatch(/2\/3 \(67%\)/)
    expect(row.querySelectorAll('[data-ops-sigil]')).toHaveLength(2)
    fireEvent.click(within(row).getByText('Launch'))
    expect(open).toHaveBeenCalledWith('/kanban?project=p1')
  })
})

describe('R66 header actions', () => {
  it('New task (primary) focuses the composer; New profile opens profile setup; no Invite', () => {
    const newProfile = vi.fn()
    render(<OfficeView {...base} onNewProfile={newProfile} />)
    fireEvent.click(document.querySelector('[data-ops-new-task]')!)
    expect(document.activeElement).toBe(screen.getByLabelText(/Dispatch a task/))
    expect(document.querySelector('[data-ops-new-task]')?.hasAttribute('data-ops-primary')).toBe(true)
    fireEvent.click(document.querySelector('[data-ops-new-profile]')!)
    expect(newProfile).toHaveBeenCalled()
    expect(screen.queryByText(/invite/i)).toBeNull()
  })

  it('the header date is the local calendar day', () => {
    const d = new Date(2026, 9, 13, 23, 30)
    expect(localDay(d.getTime() / 1000)).toBe('2026-10-13')
  })
})

describe('X1 every section independently stateful', () => {
  it('loading, unavailable with reason, stale-with-last-answer and ok are separate per section', () => {
    render(
      <OfficeView
        {...base}
        activity={null}
        errors={{ activity: new Error('500: boom'), usage: new Error('timeout') }}
        pending={null}
        usage={{ input_tokens: 5, output_tokens: 6 }}
      />
    )
    const st = (id: string) => document.querySelector(`[data-ops-section="${id}"]`)?.getAttribute('data-ops-state')
    expect(st('needs-you')).toBe('loading')
    expect(st('activity')).toBe('unavailable')
    expect(document.querySelector('[data-ops-section="activity"]')?.textContent).toMatch(/500: boom/)
    expect(st('cost')).toBe('stale')
    expect(st('stuck')).toBe('ok')
    expect(st('delivered')).toBe('ok')
  })
})

describe('X3 needs-you covers every decision kind', () => {
  it('approval, review, unblock, cron and policy each have their own action', () => {
    const openProfile = vi.fn()
    render(
      <NeedsYouQueue
        cron={cron}
        items={[cmd, review, { ...review, origin: 'kanban_blocked', id: 'blk' }]}
        onOpenProfile={openProfile}
        policy={[{ profile: 'pixel', field: 'model', provider: 'x', model: 'm1', reason: 'not on the allow list' }]}
      />
    )
    const kinds = [...document.querySelectorAll('[data-ops-origin]')].map(e => e.getAttribute('data-ops-origin'))
    expect(kinds).toEqual(['jsonrpc', 'kanban_review', 'kanban_blocked', 'policy', 'cron_failure'])
    expect(document.querySelector('[data-ops-approve="jsonrpc:a1"]')).toBeTruthy()
    expect(document.querySelector('[data-ops-cron-run="c1"]')).toBeTruthy()
    fireEvent.click(document.querySelector('[data-ops-policy-fix="pixel"]')!)
    expect(openProfile).toHaveBeenCalledWith('pixel')
  })

  it('an empty queue says so', () => {
    render(<NeedsYouQueue cron={[]} items={[]} />)
    expect(document.querySelector('[data-ops-empty="needs-you"]')).toBeTruthy()
  })
})

describe('X4 / X8 delivered today', () => {
  it('done in the last 24 h, newest first, with summary; one click opens the newest output', () => {
    const tasks = [...BOARD, T('done-2h', { status: 'done', completed_at: NOW - 7200 })]
    expect(deliveredToday(tasks, NOW)!.map(t => t.id)).toEqual(['done-1h', 'done-2h'])
    const openFile = vi.fn()
    render(
      <OfficeView
        {...base}
        attachments={{
          'done-1h': [
            { id: 'old', filename: 'draft.md', size: 10, created_at: NOW - 5000 },
            { id: 'new', filename: 'report.pdf', size: 2048, created_at: NOW - 3700, stored_path: '/a/report.pdf' }
          ]
        }}
        onOpenAttachment={openFile}
        tasks={tasks}
      />
    )
    const li = document.querySelector('[data-ops-delivered-task="done-1h"]') as HTMLElement
    expect(li.textContent).toMatch(/shipped the report/)
    const btn = li.querySelector('[data-ops-open-output]') as HTMLElement
    expect(btn.textContent).toBe('Open report.pdf (2.0 KB) +1 more')
    fireEvent.click(btn)
    expect(openFile).toHaveBeenCalledWith('done-1h', expect.objectContaining({ id: 'new' }))
    expect(document.querySelector('[data-ops-delivered-task="done-2h"] [data-ops-loading]')).toBeTruthy()
  })
})

describe('X5 jobs reachable in one click', () => {
  it('tasks, cron jobs and live runs each open from the Office in one click', () => {
    const route = vi.fn()
    const task = vi.fn()
    const run = vi.fn()
    render(
      <OfficeView
        {...base}
        fleet={{ now: NOW, profiles: [{ profile: 'builder', presence: 'working', observed_at: NOW, active_runs: [{ source: 'kanban', id: 41, task_id: 'run-ok' }] }] }}
        inFlight={[BOARD[0]]}
        layout="table"
        onOpenRoute={route}
        onOpenRun={run}
        onOpenTask={task}
      />
    )
    fireEvent.click(within(document.querySelector('[data-ops-in-flight-task="run-ok"]') as HTMLElement).getByRole('button', { name: 'Task run-ok' }))
    expect(task).toHaveBeenCalledWith('run-ok')
    fireEvent.click(document.querySelector('[data-ops-cron-failure="c1"]')!)
    expect(route).toHaveBeenCalledWith('/cron?job=c1')
    fireEvent.click(document.querySelector('[data-ops-open-run="41"]')!)
    expect(run).toHaveBeenCalledWith('41')
  })
})

describe('F5 container hardening', () => {
  const client = (over: Record<string, unknown> = {}) => ({
    fleet: vi.fn().mockResolvedValue({ now: NOW, profiles: [] }),
    pendingApprovals: vi.fn().mockResolvedValue({ items: [], observed_at: {} }),
    usageToday: vi.fn().mockResolvedValue({ input_tokens: 1, output_tokens: 1 }),
    cronJobs: vi.fn().mockResolvedValue([]),
    board: vi.fn().mockResolvedValue({ columns: [{ name: 'done', tasks: [T('d1', { status: 'done', completed_at: Date.now() / 1000 - 60 })] }] }),
    resolvedApprovals: vi.fn().mockResolvedValue({ items: [] }),
    policy: vi.fn().mockResolvedValue({ violations: [] }),
    dispatch: vi.fn(),
    ...over
  })

  const actions = (over: Record<string, unknown> = {}) => ({
    blueprints: vi.fn().mockResolvedValue({ blueprints: [] }),
    projects: vi.fn().mockResolvedValue({ projects: [] }),
    attachments: vi.fn().mockResolvedValue({ attachments: [{ id: 'f', filename: 'out.txt', size: 3 }] }),
    ...over
  })

  it('a section whose request throws synchronously shows unavailable; the others still load', async () => {
    const c = client({
      usageToday: () => {
        throw new Error('no bridge')
      }
    })

    render(<OfficeContainer actions={actions() as never} client={c as never} profile="builder" />)
    await waitFor(() => expect(document.querySelector('[data-ops-section="cost"]')?.getAttribute('data-ops-state')).toBe('unavailable'))
    expect(document.querySelector('[data-ops-section="cost"]')?.textContent).toMatch(/no bridge/)
    await waitFor(() => expect(document.querySelector('[data-ops-open-output="f"]')).toBeTruthy())
  })

  it('a refused dispatch keeps the text and shows the server reason; one dispatch in flight', async () => {
    let fail: (e: Error) => void = () => undefined
    const c = client({ dispatch: vi.fn(() => new Promise((_, rej) => (fail = rej))) })
    render(<OfficeContainer actions={actions() as never} client={c as never} />)
    const input = screen.getByLabelText(/Dispatch a task/) as HTMLInputElement
    fireEvent.change(input, { target: { value: '@pixel draw it' } })
    fireEvent.submit(document.querySelector('[data-ops-dispatch]')!)
    fireEvent.submit(document.querySelector('[data-ops-dispatch]')!)
    expect(c.dispatch).toHaveBeenCalledTimes(1)
    fail(new Error('422: title required'))
    await screen.findByText('Dispatch failed: 422: title required')
    expect(input.value).toBe('@pixel draw it')
  })

  it('without onOpenTask the live Office still opens tasks through the host route', async () => {
    const route = vi.fn()
    render(<OfficeContainer actions={actions() as never} client={client() as never} onOpenRoute={route} />)

    const b = await waitFor(() => {
      const el = document.querySelector('[data-ops-delivered-task="d1"] button') as HTMLButtonElement
      expect(el).toBeTruthy()

      return el
    })

    fireEvent.click(b)
    expect(route).toHaveBeenCalledWith('/kanban?task=d1')
  })
})
