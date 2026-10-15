/** P24 (judge pass 18 must-fix): Diagnostics shows the latest error per endpoint and puts the next step before the evidence. */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clearOpsErrors, opsErrors, recordOpsError } from '../feed/diag'

import { DiagnosticsPanel, groupOpsErrors } from './diagnostics'

beforeEach(() => clearOpsErrors())
afterEach(() => {
  cleanup()
  clearOpsErrors()
})

describe('P24 Diagnostics error grouping', () => {
  it('keeps the most recent message when the ring lists newest first (NEW@2, OLD@1)', () => {
    const g = groupOpsErrors([
      { at: 2, message: 'NEW', method: 'GET', path: '/board' },
      { at: 1, message: 'OLD', method: 'GET', path: '/board' }
    ])

    expect(g).toEqual([{ count: 2, key: 'GET /board', message: 'NEW' }])
  })

  it('the real ring (prepends) renders the latest message beside the repeat count', () => {
    const now = Date.now
    let t = 1000
    Date.now = () => t

    try {
      recordOpsError('GET', '/api/plugins/kanban/board', new Error('500: first failure'))
      t = 2000
      recordOpsError('GET', '/api/plugins/kanban/board', new Error('502: latest failure'))
    } finally {
      Date.now = now
    }

    expect(opsErrors()[0].message).toBe('502: latest failure')
    render(<DiagnosticsPanel get={() => Promise.resolve({})} policySource="file" />)
    const row = document.querySelector('[data-ops-error-group]')!
    expect(row.textContent).toContain('502: latest failure')
    expect(row.textContent).not.toContain('first failure')
    expect(row.querySelector('[data-ops-error-repeat]')?.textContent).toContain('2')
  })
})

describe('P24 Diagnostics reading order', () => {
  it('actions, then the finished probe result (pass/fail per check), then error evidence; the raw log is folded last', async () => {
    recordOpsError('GET', '/api/ops/usage/today', new Error('404: Not Found'))
    const get = (p: string) => (p.includes('usage') ? Promise.reject(new Error('404: Not Found')) : Promise.resolve({}))
    render(<DiagnosticsPanel get={get} policySource="file" />)
    await act(async () => fireEvent.click(document.querySelector('[data-ops-probe]')!))
    await waitFor(() => expect(document.querySelector('[data-ops-diag-state]')?.textContent).not.toBe('Not probed yet'))

    const root = document.querySelector('[data-ops-diagnostics]')!
    const at = (sel: string) => {
      const el = root.querySelector(sel)
      expect(el, sel).not.toBeNull()

      return [...root.querySelectorAll('*')].indexOf(el!)
    }

    // Finished result, per check, visible (not inside a closed <details>).
    const results = root.querySelector('[data-ops-diag-result]')!
    expect(results.closest('details')).toBeNull()
    const rows = [...results.querySelectorAll('[data-ops-probe-check]')]
    expect(rows).toHaveLength(7)
    expect(rows.filter(r => r.getAttribute('data-ops-probe-state') === 'ok')).toHaveLength(6)
    expect(results.querySelector('[data-ops-probe-check="A4"]')?.getAttribute('data-ops-probe-state')).toBe('missing')

    expect(at('[data-ops-diag-next]')).toBeLessThan(at('[data-ops-diag-result]'))
    expect(at('[data-ops-diag-result]')).toBeLessThan(at('[data-ops-diag-evidence="errors"]'))
    // The raw log is the last thing in the panel and starts folded.
    const log = root.querySelector('[data-ops-errors-log]') as HTMLDetailsElement
    expect(log.open).toBe(false)
    const foldedOrSections = [...root.querySelectorAll('details, section')]
    expect(foldedOrSections[foldedOrSections.length - 1]).toBe(log)
  })
})
