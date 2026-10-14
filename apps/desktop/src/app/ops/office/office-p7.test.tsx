import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createOpsClient } from '../feed/ops-client'

import { OfficeView, routingLine, todayCounts } from './office'

afterEach(() => cleanup())

const base = { fleet: null, nowS: 1_000_000, pending: null, usage: null, cron: null, inFlight: null, activity: null }

describe('Office P7 F5 (R1, R61, O58, G1, O4)', () => {
  it('today counts: cron in next 24 h, running, overdue = stale heartbeat; unknown stays unknown', () => {
    expect(todayCounts(null, null, 0)).toEqual({ next24: null, overdue: null, running: null })

    const c = todayCounts(
      [
        { id: 'a', next_run_at: 1_000_100 },
        { id: 'b', next_run_at: 1_200_000 },
        { id: 'c', next_run_at: 1_000_200, enabled: false }
      ],
      [{ id: 't', title: 'x', status: 'running', last_heartbeat_at: 1_000_000 - 900 } as never, { id: 'u', title: 'y', status: 'running' } as never],
      1_000_000
    )

    expect(c).toEqual({ next24: 1, overdue: 1, running: 2 })
  })

  it('header shows date and connection, no greeting', () => {
    render(<OfficeView {...base} connectionLabel="Local" />)
    const h = document.querySelector('[data-ops-office-header]')!
    expect(h.textContent).toContain('1970-01-12')
    expect(h.textContent).toContain('Local')
    expect(h.textContent).not.toMatch(/good (morning|afternoon|evening)/i)
    expect(document.querySelector('[data-ops-count="cron-24h"]')?.textContent).toContain('unknown')
  })

  it('routing line is honest and the empty composer explains itself; Dispatch disabled until text', () => {
    expect(routingLine('@Pixel fix it')).toBe('Assigned to pixel')
    expect(routingLine('fix it')).toBe('Unassigned → triage')
    render(<OfficeView {...base} />)
    expect(document.querySelector('[data-ops-routing]')?.textContent).toMatch(/Start with @profile/)
    expect((screen.getByText('Dispatch', { selector: 'button' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('blueprint chips open Schedule with the blueprint', () => {
    const open = vi.fn()
    render(<OfficeView {...base} blueprints={[{ key: 'digest', title: 'Daily digest' }]} onOpenRoute={open} />)
    fireEvent.click(screen.getByText('Daily digest'))
    expect(open).toHaveBeenCalledWith('/cron?blueprint=digest')
  })

  it('dispatch without @assignee asks kanban triage', async () => {
    const api = vi.fn().mockResolvedValue({})
    await createOpsClient(api as never).dispatch('t', null)
    expect(api.mock.calls[0][0].body).toMatchObject({ assignee: null, triage: true })
    await createOpsClient(api as never).dispatch('t', 'pixel')
    expect(api.mock.calls[1][0].body).toMatchObject({ assignee: 'pixel', triage: false })
  })
})
