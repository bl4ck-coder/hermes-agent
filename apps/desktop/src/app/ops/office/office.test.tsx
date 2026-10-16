import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ApprovalItem, FleetProfile, FleetResponse } from '../feed/ops-client'

import { OfficeView } from './office'
import { OfficeContainer } from './office-container'
import { layoutOrrery, ORRERY_CAP, ORRERY_CENTRE, ringOf } from './orrery'

afterEach(() => cleanup())

const NOW = 1000

const prof = (profile: string, presence: string, observed = NOW): FleetProfile => ({
  profile,
  presence: presence as never,
  observed_at: observed,
  active_runs: []
})

const fleetOf = (...p: FleetProfile[]): FleetResponse => ({ profiles: p, now: NOW })

const approval = (id: string, origin = 'jsonrpc'): ApprovalItem => ({
  origin, id, profile: 'sandhi', session_id: 's1', run_id: null, tenant: null,
  exact_request: origin === 'jsonrpc' ? { command: `rm ${id}`, pattern_keys: [] } : null,
  why: 'dangerous', what_for: 'cleanup', status: 'pending', expires_at: null, age_s: null,
  actions: origin === 'jsonrpc' ? ['approve', 'deny'] : ['review']
})

const base = {
  nowS: NOW, pending: [] as ApprovalItem[], usage: null, cron: null, inFlight: null, activity: null
}

describe('orrery (D6)', () => {
  it('puts sandhi at the centre, caps 8 orbs by priority, overflows the rest', () => {
    const profiles = [prof('sandhi', 'idle'), ...Array.from({ length: 12 }, (_, i) =>
      prof(`p${String(i).padStart(2, '0')}`, i < 2 ? 'needs_you' : i < 4 ? 'working' : i < 8 ? 'idle' : 'offline'))]

    const l = layoutOrrery(profiles, p => p.presence)
    expect(l.centre).toMatchObject({ profile: ORRERY_CENTRE, presence: 'idle', ring: 0, x: 0, y: 0 })
    expect(l.orbs).toHaveLength(ORRERY_CAP)
    expect(l.orbs.some(o => o.profile === 'sandhi')).toBe(false)
    expect(l.overflow).toEqual(['p08', 'p09', 'p10', 'p11'])
    expect(new Set(l.orbs.map(o => o.ring))).toEqual(new Set([1, 2]))
    expect([ringOf('working'), ringOf('idle'), ringOf('stale'), ringOf('offline')]).toEqual([1, 2, 3, 3])
  })

  it('shows sandhi as unknown at the centre when absent (never invented idle)', () => {
    expect(layoutOrrery([prof('a', 'working')], p => p.presence).centre.presence).toBe('unknown')
  })
})

describe('Office view', () => {
  it('renders strips, centre, overflow switch to table, and stale for old observations', () => {
    const many = [prof('sandhi', 'working'), ...Array.from({ length: 10 }, (_, i) => prof(`x${i}`, 'idle', NOW - 30))]
    render(<OfficeView {...base} fleet={fleetOf(...many)} />)
    expect(document.querySelector('[data-ops-orrery-centre="sandhi"] [data-ops-presence="working"]')).not.toBeNull()
    expect(document.querySelectorAll('[data-ops-orb]').length).toBe(1 + ORRERY_CAP)
    expect(document.querySelector('[data-ops-orb="x0"]')?.getAttribute('data-ops-presence')).toBe('stale')
    expect(screen.getByText('Stale 10')).toBeTruthy()
    fireEvent.click(screen.getByText(/\+2 more/))
    expect(document.querySelectorAll('[data-ops-fleet-row]').length).toBe(11)
  })

  it('renders unknowns, never zeros', () => {
    render(<OfficeView {...base} fleet={null} pending={null} usage={{ input_tokens: null, output_tokens: 1234 }} />)
    expect(screen.getByText('Input tokens unknown')).toBeTruthy()
    expect(screen.getByText('Output tokens 1,234')).toBeTruthy()
    expect(screen.getByText('Cron unknown')).toBeTruthy()
    expect(document.querySelector('[data-ops-section="needs-you"]')?.getAttribute('data-ops-state')).toBe('loading')
    expect(document.body.textContent).not.toMatch(/\b0 (profiles|failing)\b/)
  })

  it('approves in one click with no confirm, and only routable items get a button', async () => {
    const onApprove = vi.fn().mockResolvedValue({ resolved: true })
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<OfficeView {...base} fleet={fleetOf()} onApprove={onApprove} pending={[approval('a1'), approval('k1', 'kanban_blocked')]} />)
    fireEvent.click(document.querySelector('[data-ops-approve="jsonrpc:a1"]') as HTMLElement)
    await waitFor(() => expect(screen.getByText('Approved')).toBeTruthy())
    expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }))
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(document.querySelector('[data-ops-approve="kanban_blocked:k1"]')).toBeNull()
    // P6: blocked tasks are actionable through a noted Unblock, never a one-click approve.
    expect(document.querySelector('[data-ops-unblock="kanban_blocked:k1"]')).not.toBeNull()
  })

  it('read-only hides approve and dispatch', () => {
    render(<OfficeView {...base} fleet={fleetOf()} pending={[approval('a1')]} readOnly />)
    expect(document.querySelector('[data-ops-approve]')).toBeNull()
    expect(document.querySelector('[data-ops-dispatch]')).toBeNull()
  })

  it('updates never steal focus', () => {
    const { rerender } = render(
      <div>
        <input data-testid="outside" />
        <OfficeView {...base} fleet={fleetOf(prof('sandhi', 'idle'))} pending={[]} />
      </div>
    )

    const outside = screen.getByTestId('outside')
    outside.focus()
    rerender(
      <div>
        <input data-testid="outside" />
        <OfficeView {...base} fleet={fleetOf(prof('sandhi', 'needs_you'), prof('b', 'working'))} pending={[approval('n1')]} />
      </div>
    )
    expect(document.activeElement).toBe(outside)
  })
})

describe('Office container (integration with the client)', () => {
  it('loads every section, resumes a pending approval in one click, and dispatches with @assignee', async () => {
    let pending = [approval('a1')]

    const client = {
      fleet: vi.fn().mockResolvedValue(fleetOf(prof('sandhi', 'needs_you', Date.now() / 1000))),
      pendingApprovals: vi.fn().mockImplementation(async () => ({ items: pending, observed_at: { jsonrpc: 1 } })),
      approve: vi.fn().mockImplementation(async () => {
        pending = []

        return { resolved: true, outcome: 'resolved', choice: 'once' }
      }),
      usageToday: vi.fn().mockResolvedValue({ input_tokens: 10, output_tokens: null }),
      cronJobs: vi.fn().mockResolvedValue([{ id: 'c1', name: 'nightly', failure_streak: 2 }]),
      board: vi.fn().mockResolvedValue({ columns: [{ name: 'running', tasks: [{ id: 't1', title: 'build', status: 'running', assignee: 'builder' }] }] }),
      resolvedApprovals: vi.fn().mockResolvedValue({ items: [{ outcome: 'resolved', profile: 'sandhi' }] }),
      dispatch: vi.fn().mockResolvedValue({ id: 't2' })
    }

    render(<OfficeContainer client={client as never} />)
    await waitFor(() => expect(document.querySelector('[data-ops-approve="jsonrpc:a1"]')).not.toBeNull())
    expect(screen.getByText('nightly (2)')).toBeTruthy()
    expect(document.querySelector('[data-ops-in-flight-task="t1"]')?.textContent).toMatch(/build\s*@builder/)
    expect(screen.getByText('Input tokens 10')).toBeTruthy()
    await act(async () => {
      fireEvent.click(document.querySelector('[data-ops-approve="jsonrpc:a1"]') as HTMLElement)
    })
    expect(client.approve).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1', session_id: 's1' }), 'once')
    await waitFor(() => expect(document.querySelector('[data-ops-approval="jsonrpc:a1"]')).toBeNull())
    fireEvent.change(screen.getByLabelText(/Dispatch a task/), { target: { value: '@builder ship it' } })
    await act(async () => {
      fireEvent.submit(document.querySelector('[data-ops-dispatch]') as HTMLElement)
    })
    expect(client.dispatch).toHaveBeenCalledWith('ship it', 'builder', null, null)
  })
})
