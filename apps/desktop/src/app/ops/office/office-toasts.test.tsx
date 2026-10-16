import { cleanup, fireEvent, render, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ApprovalItem } from '../feed/ops-client'

import { OfficeView } from './office'
import { activityRow, toastsFromPending } from './office-toasts'

afterEach(() => cleanup())

const item = (o: Partial<ApprovalItem>): ApprovalItem =>
  ({ origin: 'jsonrpc', id: 'a1', profile: 'builder', session_id: null, run_id: null, tenant: null, exact_request: null, why: '', what_for: '', status: 'pending', expires_at: null, age_s: 10, actions: [], ...o }) as ApprovalItem

describe('office toasts + activity (P6 F7)', () => {
  it('derives approval and blocked toasts; unknown pending yields none', () => {
    expect(toastsFromPending(null, 0, {})).toEqual([])
    const onApprove = vi.fn()
    const onOpenTask = vi.fn()

    const t = toastsFromPending(
      [item({ exact_request: { command: 'ls -la', pattern_keys: [] } }), item({ origin: 'kanban_blocked', id: 't9', what_for: 'Fix CI' }), item({ origin: 'kanban_review', id: 'r1' })],
      100_000,
      { onApprove, onOpenTask }
    )

    expect(t.map(x => x.kind)).toEqual(['approval', 'blocked'])
    expect(t[0].createdAt).toBe(90_000)
    t[0].onApprove?.()
    t[1].onOpen?.()
    expect(onApprove).toHaveBeenCalled()
    expect(onOpenTask).toHaveBeenCalledWith('t9')
  })

  it('activity rows keep unknowns honest', () => {
    expect(activityRow({})).toEqual({ what: 'resolved', who: 'unknown', when: 'unknown' })
    expect(activityRow({ choice: 'once', command: 'ls', profile: 'p', resolved_at: 0 })).toEqual({ what: 'once: ls', who: 'p', when: '1970-01-01T00:00:00.000Z' })
  })

  it('office renders the toast queue and activity rows; read-only hides toasts', () => {
    const props = {
      fleet: null,
      nowS: 100,
      pending: [item({ exact_request: { command: `echo ${'x'.repeat(90)}`, pattern_keys: [] } })],
      usage: null,
      cron: null,
      inFlight: null,
      activity: [{ choice: 'deny', profile: 'pixel' }]
    }

    const { rerender } = render(<OfficeView {...props} />)
    expect(document.querySelector('.ops-toast[data-kind="approval"]')).toBeTruthy()
    expect(document.querySelector('[data-ops-activity-row] [data-ops-field="who"]')?.textContent).toBe('pixel')
    fireEvent.click(within(document.querySelector('.ops-toast') as HTMLElement).getByText('Review'))
    expect(document.activeElement?.getAttribute('data-ops-approval')).toBe('jsonrpc:a1')
    rerender(<OfficeView {...props} readOnly />)
    expect(document.querySelector('.ops-toast')).toBeNull()
  })
})
