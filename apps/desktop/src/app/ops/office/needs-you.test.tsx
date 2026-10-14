import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ApprovalItem } from '../feed/ops-client'

import { FULL_ARGS_MAX, NeedsYouQueue } from './needs-you'

afterEach(() => cleanup())

const item = (origin: string, id: string, command: string | null = null): ApprovalItem => ({
  origin, id, profile: 'sandhi', session_id: 's', run_id: null, tenant: null,
  exact_request: command ? { command, pattern_keys: [] } : null,
  why: 'why', what_for: `task ${id}`, status: 'pending', expires_at: null, age_s: 125, actions: ['approve']
})

describe('Needs-you queue (P6 F1)', () => {
  it('shows the O59 columns and one-click approve only for unabridged commands', async () => {
    const onApprove = vi.fn().mockResolvedValue({})
    render(<NeedsYouQueue items={[item('jsonrpc', 'a', 'rm x'), item('jsonrpc', 'b', 'x'.repeat(FULL_ARGS_MAX + 1))]} onApprove={onApprove} />)
    expect([...document.querySelectorAll('th')].map(t => t.textContent)).toEqual(['Agent', 'Kind', 'Waiting on', 'Age', 'Why', 'Actions'])
    expect(screen.getAllByText('2 min').length).toBe(2)
    expect(document.querySelector('[data-ops-approve="jsonrpc:b"]')).toBeNull()
    await act(async () => fireEvent.click(document.querySelector('[data-ops-approve="jsonrpc:a"]')!))
    expect(onApprove).toHaveBeenCalled()
    expect(screen.getByText('Approved')).toBeTruthy()
  })

  it('kanban review: approve, or request changes only with a note', async () => {
    const onKanban = vi.fn().mockResolvedValue({})
    render(<NeedsYouQueue items={[item('kanban_review', 't1')]} onKanban={onKanban} />)
    expect((screen.getByText('Request changes') as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('changes for t1'), { target: { value: 'fix tests' } })
    await act(async () => fireEvent.click(screen.getByText('Request changes')))
    expect(onKanban).toHaveBeenCalledWith({ kind: 'request_changes', taskId: 't1', note: 'fix tests' })
  })

  it('kanban blocked: unblock needs a note; failures show the server reason', async () => {
    const onKanban = vi.fn().mockRejectedValue(new Error('409: blocked by parent'))
    const onOpenTask = vi.fn()
    render(<NeedsYouQueue items={[item('kanban_blocked', 't2')]} onKanban={onKanban} onOpenTask={onOpenTask} />)
    fireEvent.click(screen.getByText('Open'))
    expect(onOpenTask).toHaveBeenCalledWith('t2')
    fireEvent.change(screen.getByLabelText('unblock note for t2'), { target: { value: 'creds added' } })
    await act(async () => fireEvent.click(document.querySelector('[data-ops-unblock="kanban_blocked:t2"]')!))
    expect(screen.getByRole('alert').textContent).toContain('blocked by parent')
  })

  it('cron failures get Run now; read-only hides every action', async () => {
    const onCronRun = vi.fn().mockResolvedValue({})
    const cron = [{ id: 'j1', name: 'nightly', failure_streak: 2, last_status: 'error', profile: 'ops' }, { id: 'j2', failure_streak: 0 }]
    const { rerender } = render(<NeedsYouQueue cron={cron} items={[]} onCronRun={onCronRun} />)
    expect(screen.getByText('Needs you (1)')).toBeTruthy()
    await act(async () => fireEvent.click(document.querySelector('[data-ops-cron-run="j1"]')!))
    expect(onCronRun).toHaveBeenCalledWith('j1')
    rerender(<NeedsYouQueue cron={cron} items={[item('kanban_review', 't1')]} readOnly />)
    expect(document.querySelector('button')).toBeNull()
  })

  it('unknown stays unknown', () => {
    render(<NeedsYouQueue items={null} />)
    expect(screen.getByText('Needs you unknown')).toBeTruthy()
  })
})
