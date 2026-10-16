/** P26 (judge pass 20 #3): the verdict says when the present probe ran; history leads with reason, endpoint, last time. */
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { clearOpsErrors, recordOpsError } from '../feed/diag'

import { DiagnosticsPanel } from './diagnostics'

const IPC = "Error invoking remote method 'hermes:api': Error: "

beforeEach(() => clearOpsErrors())
afterEach(() => {
  cleanup()
  clearOpsErrors()
  vi.useRealTimers()
})

describe('P26 Diagnostics: probe time and human-first history', () => {
  it('no probe, no time; after a probe the header says when it ran, and the relative time keeps updating', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<DiagnosticsPanel get={() => Promise.resolve({})} policySource="file" />)
    expect(document.querySelector('[data-ops-diag-checked-at]')).toBeNull()

    await act(async () => fireEvent.click(document.querySelector('[data-ops-probe]')!))
    await waitFor(() => expect(document.querySelector('[data-ops-diag-result]')).not.toBeNull())

    const at = () => document.querySelector('[data-ops-diag-hero] [data-ops-diag-checked-at]') as HTMLElement
    expect(at()).not.toBeNull()
    const time = at().querySelector('time')!
    expect(Number.isNaN(Date.parse(time.getAttribute('datetime') ?? ''))).toBe(false)
    expect(at().textContent).toBe('Checked now')
    // Beside the verdict: right after the state line, inside the header.
    const state = document.querySelector('[data-ops-diag-state]')!
    expect(state.compareDocumentPosition(at()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(125_000)
    })
    expect(at().textContent).toBe('Checked 2 minutes ago')
  })

  it('history row: human reason, then endpoint, then last occurrence; the IPC wrapper only in the folded full log', () => {
    recordOpsError('PATCH', '/api/plugins/kanban/tasks/t1', new Error(`${IPC}409: {"detail":"Task moved to done by another agent"}`))
    render(<DiagnosticsPanel get={() => Promise.resolve({})} policySource="file" />)

    const row = document.querySelector('[data-ops-diag-evidence="errors"] [data-ops-error-group]') as HTMLElement
    const reason = row.querySelector('[data-ops-error-reason]') as HTMLElement
    const endpoint = row.querySelector('[data-ops-error-endpoint]') as HTMLElement
    const last = row.querySelector('[data-ops-error-last]') as HTMLElement
    expect(reason.textContent).toBe('Conflict (409): Task moved to done by another agent')
    expect(endpoint.textContent).toBe('PATCH /api/plugins/kanban/tasks/t1')
    expect(last.tagName).toBe('TIME')
    expect(last.textContent).toBe('now')
    const after = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(after(reason, endpoint) && after(endpoint, last)).toBe(true)
    expect(row.textContent).not.toMatch(/invoking|hermes:api|\{"detail"/)

    const log = document.querySelector('[data-ops-errors-log]') as HTMLDetailsElement
    expect(log.open).toBe(false)
    expect(log.querySelector('[data-ops-errors]')?.textContent).toContain(`${IPC}409:`)
  })

  it('a failing probe check reads its human reason, not the transport wrapper', async () => {
    const get = (p: string) => (p.includes('usage') ? Promise.reject(new Error(`${IPC}503: {"detail":"usage store is restarting"}`)) : Promise.resolve({}))
    render(<DiagnosticsPanel get={get} policySource="file" />)
    await act(async () => fireEvent.click(document.querySelector('[data-ops-probe]')!))
    await waitFor(() => expect(document.querySelector('[data-ops-probe-failing]')).not.toBeNull())

    const fail = document.querySelector('[data-ops-probe-failing] [data-ops-probe-check]') as HTMLElement
    expect(fail.textContent).toContain('Unavailable (503): usage store is restarting')
    expect(fail.textContent).not.toMatch(/invoking/)
  })
})
