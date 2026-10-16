/** P8 b3: Office to 9: profile switch drops the old scope; Stuck/Overdue thresholds are named settings. */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { myQueue, stuckItems } from './control-room'
import { BOARD, NOW } from './control-room.fixtures'
import { OfficeView } from './office'
import { OfficeContainer } from './office-container'
import { DEFAULT_THRESHOLDS, loadThresholds, resetThresholds, saveThresholds, ThresholdSettings } from './thresholds'

beforeEach(() => (localStorage.clear(), resetThresholds()))
afterEach(() => cleanup())

const client = () => ({
  fleet: vi.fn().mockResolvedValue({ now: NOW, profiles: [] }),
  pendingApprovals: vi.fn().mockResolvedValue({ items: [], observed_at: {} }),
  usageToday: vi.fn().mockResolvedValue({ input_tokens: 1, output_tokens: 1 }),
  cronJobs: vi.fn().mockResolvedValue([]),
  board: vi.fn().mockResolvedValue({ columns: [] }),
  resolvedApprovals: vi.fn().mockResolvedValue({ items: [] }),
  policy: vi.fn((p: string) => (p === 'alpha' ? Promise.resolve({ violations: [{ field: 'model', provider: 'x', model: 'bad', reason: 'not allowed' }] }) : new Promise(() => undefined))),
  dispatch: vi.fn()
})

describe('Office profile switch (F5 to 9)', () => {
  it("switching profile drops the previous profile's answers at once and never shows them as current", async () => {
    const actions = {
      blueprints: vi.fn((p: string) => (p === 'alpha' ? Promise.resolve({ blueprints: [{ key: 'ka', title: 'Alpha digest' }] }) : new Promise(() => undefined))),
      projects: vi.fn().mockResolvedValue({ projects: [] }),
      attachments: vi.fn()
    }

    const c = client()
    const { rerender } = render(<OfficeContainer actions={actions as never} client={c as never} profile="alpha" />)
    await screen.findByText('Alpha digest')
    await waitFor(() => expect(document.querySelector('[data-ops-policy-fix="alpha"]')).toBeTruthy())
    rerender(<OfficeContainer actions={actions as never} client={c as never} profile="beta" />)
    // same render: no alpha chip, no alpha policy row, queue retitled
    expect(screen.queryByText('Alpha digest')).toBeNull()
    expect(document.querySelector('[data-ops-policy-fix="alpha"]')).toBeNull()
    expect(document.querySelector('[data-ops-section="queue"]')?.getAttribute('aria-label')).toBe('My queue · beta')
    await waitFor(() => expect(actions.blueprints).toHaveBeenLastCalledWith('beta'))
    await waitFor(() => expect(c.policy).toHaveBeenLastCalledWith('beta'))
    expect(screen.queryByText('Alpha digest')).toBeNull()
  })
})

describe('Office thresholds are named settings', () => {
  it('defaults are the named constants; out-of-range values fall back', () => {
    expect(loadThresholds()).toEqual(DEFAULT_THRESHOLDS)
    expect(saveThresholds({ staleHeartbeatS: 5 }).staleHeartbeatS).toBe(DEFAULT_THRESHOLDS.staleHeartbeatS)
    localStorage.setItem('hermes.ops.officeThresholds', '{bad json')
    resetThresholds()
    localStorage.setItem('hermes.ops.officeThresholds', '{bad json')
    expect(loadThresholds()).toEqual(DEFAULT_THRESHOLDS)
  })

  it('a longer stale window un-sticks a 20-min heartbeat; a shorter review window makes a review overdue', () => {
    expect(stuckItems(BOARD, [], NOW)!.some(s => s.id === 'run-stale')).toBe(true)
    expect(stuckItems(BOARD, [], NOW, { ...DEFAULT_THRESHOLDS, staleHeartbeatS: 1800 })!.some(s => s.id === 'run-stale')).toBe(false)
    expect(myQueue(BOARD, 'builder', NOW, { staleHeartbeatS: 600, reviewOverdueS: 3600 })!.overdue.map(r => r.task.id)).toContain('rev-old')
  })

  it('the settings control changes what the Office shows, live', () => {
    render(
      <>
        <ThresholdSettings />
        <OfficeView activity={[]} cron={[]} fleet={null} inFlight={[]} nowS={NOW} pending={[]} profile="builder" tasks={BOARD} usage={null} />
      </>
    )
    expect(document.querySelector('[data-ops-stuck-item="task:run-stale"]')).toBeTruthy()
    act(() => {
      fireEvent.change(screen.getByLabelText('stale heartbeat minutes'), { target: { value: '30' } })
    })
    expect(loadThresholds().staleHeartbeatS).toBe(1800)
    expect(document.querySelector('[data-ops-stuck-item="task:run-stale"]')).toBeNull()
    fireEvent.click(screen.getByText(/Reset to defaults/))
    expect(document.querySelector('[data-ops-stuck-item="task:run-stale"]')).toBeTruthy()
  })
})
