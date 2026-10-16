/** P25 (judge pass 19 #2): the Diagnostics header reports the PRESENT probe; the error ring is history, listed below it. */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { clearOpsErrors, recordOpsError } from '../feed/diag'

import { DiagnosticsPanel } from './diagnostics'

beforeEach(() => clearOpsErrors())
afterEach(() => {
  cleanup()
  clearOpsErrors()
})

const hero = () => document.querySelector('[data-ops-diag-hero]')!
const state = () => document.querySelector('[data-ops-diag-state]')?.textContent ?? ''
const historyGroups = () => [...document.querySelectorAll('[data-ops-diag-evidence="errors"] [data-ops-error-group]')].map(n => n.textContent ?? '')

async function probeNow() {
  await act(async () => fireEvent.click(document.querySelector('[data-ops-probe]')!))
  await waitFor(() => expect(document.querySelector('[data-ops-diag-result]')).not.toBeNull())
}

describe('P25 Diagnostics: present probe vs error history', () => {
  it('7 checks ok + 1 old error in history: the header says the checks are available; the old error stays listed as history', async () => {
    recordOpsError('GET', '/api/ops/usage/today', new Error('502: Bad Gateway'))
    render(<DiagnosticsPanel get={() => Promise.resolve({})} policySource="file" />)
    await probeNow()

    expect(document.querySelectorAll('[data-ops-diag-result] [data-ops-probe-state="ok"]')).toHaveLength(7)
    expect(hero().getAttribute('data-ops-diag-hero')).toBe('good')
    expect(state()).toBe('All capabilities available')
    expect(document.querySelector('[data-ops-diag-summary]')?.textContent).toContain('7/7')
    // History is still there, labelled as recent errors, with its latest message.
    expect(historyGroups()).toHaveLength(1)
    expect(historyGroups()[0]).toContain('502: Bad Gateway')
  })

  it('before any probe, it says so instead of inferring health (good or bad) from history', () => {
    recordOpsError('GET', '/api/plugins/kanban/board', new Error('500: boom'))
    render(<DiagnosticsPanel get={() => Promise.resolve({})} policySource="file" />)

    expect(hero().getAttribute('data-ops-diag-hero')).toBe('idle')
    expect(state()).toBe('Not probed yet')
    // The honest next step is visible in the header (not folded in Details), and frames the errors as history.
    const unprobed = document.querySelector('[data-ops-diag-unprobed]')
    expect(unprobed).not.toBeNull()
    expect(unprobed!.closest('details')).toBeNull()
    expect(unprobed!.textContent).toMatch(/earlier/i)
    expect(document.querySelector('[data-ops-diag-summary]')?.textContent).not.toMatch(/available/)
    expect(historyGroups()[0]).toContain('500: boom')
  })

  it('fail -> recover -> probe 7/7: the header shows the recovered present state, the earlier failure stays as history', async () => {
    let down = true
    // Like the real client: a failed request lands in the error ring.
    const get = (p: string) => {
      if (down && p.includes('usage')) {
        const e = new Error('503: Service Unavailable')
        recordOpsError('GET', p, e)

        return Promise.reject(e)
      }

      return Promise.resolve({})
    }

    render(<DiagnosticsPanel get={get} policySource="file" />)
    await probeNow()
    expect(hero().getAttribute('data-ops-diag-hero')).toBe('warn')
    expect(state()).toBe('Some capabilities need attention')
    expect(document.querySelectorAll('[data-ops-probe-failing] [data-ops-probe-check]')).toHaveLength(1)

    down = false
    await act(async () => fireEvent.click(document.querySelector('[data-ops-probe]')!))
    await waitFor(() => expect(document.querySelectorAll('[data-ops-diag-result] [data-ops-probe-state="ok"]')).toHaveLength(7))

    expect(hero().getAttribute('data-ops-diag-hero')).toBe('good')
    expect(state()).toBe('All capabilities available')
    expect(document.querySelector('[data-ops-probe-failing]')).toBeNull()
    expect(historyGroups()).toHaveLength(1)
    expect(historyGroups()[0]).toContain('503: Service Unavailable')
  })
})
