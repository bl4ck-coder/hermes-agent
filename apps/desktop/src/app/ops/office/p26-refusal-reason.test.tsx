// P26 (judge pass 20 #3): an Office refusal says the human reason first, beside its intent; the transport text is only
// in a folded detail; the typed note is kept.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { KanbanAction } from './needs-you'
import { NeedsYouQueue } from './needs-you'

afterEach(() => cleanup())

const IPC = "Error invoking remote method 'hermes:api': Error: "
const review = { id: 't_r', origin: 'kanban_review', actions: ['approve'], what_for: 'Ship it', why: 'Needs a second look', profile: 'builder', age_s: 60 } as never
const blocked = { id: 't_b', origin: 'kanban_blocked', actions: [], what_for: 'Stuck job', why: 'Waiting on creds', profile: 'builder', age_s: 90 } as never
const rowOf = (key: string) => document.querySelector(`[data-ops-approval="${key}"]`) as HTMLElement

describe('P26 Office refusal: human reason first', () => {
  it('409 through IPC on Request changes: one short line with meaning + reason; raw only in a closed disclosure; note kept', async () => {
    const raw = `${IPC}409: {"detail":"Task moved to done by another agent"}`
    const onKanban = vi.fn((_a: KanbanAction) => Promise.reject(new Error(raw)))
    render(<NeedsYouQueue items={[review]} onKanban={onKanban} onOpenTask={vi.fn()} />)
    const row = rowOf('kanban_review:t_r')
    fireEvent.click(row.querySelector('[data-ops-row-more-trigger]')!)
    const intent = row.querySelector('[data-ops-intent="request-changes"]') as HTMLElement
    const input = intent.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Split the commit' } })
    fireEvent.click(intent.querySelector('[data-ops-request-changes]')!)

    await waitFor(() => expect(intent.querySelector('[role="alert"]')).not.toBeNull())
    const refused = intent.querySelector('[data-ops-refused]') as HTMLElement
    const alert = refused.querySelector('[role="alert"]') as HTMLElement
    expect(alert.textContent).toBe('Conflict (409): Task moved to done by another agent')
    expect(alert.textContent).not.toMatch(/invoking|hermes:api|\{"detail"/)

    // The raw text is available, folded, after the reason, and never as a native tooltip.
    const details = refused.querySelector('details') as HTMLDetailsElement
    expect(details).not.toBeNull()
    expect(details.open).toBe(false)
    expect(details.querySelector('[data-ops-refused-raw]')?.textContent).toBe(raw)
    expect(alert.compareDocumentPosition(details) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(refused.querySelector('[title]')).toBeNull()
    // The reason sits beside its own intent, and the note survives for a retry.
    expect(input.value).toBe('Split the commit')
    expect(row.querySelectorAll('[data-ops-refused]').length).toBe(1)
  })

  it('422 through IPC on Unblock: field + message lead; the JSON body is only in the detail', async () => {
    const raw = `${IPC}422: {"detail":[{"type":"missing","loc":["body","note"],"msg":"Field required","input":null}]}`
    render(<NeedsYouQueue items={[blocked]} onKanban={vi.fn().mockRejectedValue(new Error(raw))} onOpenTask={vi.fn()} />)
    const row = rowOf('kanban_blocked:t_b')
    fireEvent.click(row.querySelector('[data-ops-row-more-trigger]')!)
    const intent = row.querySelector('[data-ops-intent="unblock"]') as HTMLElement
    fireEvent.change(intent.querySelector('input')!, { target: { value: 'creds added' } })
    fireEvent.click(intent.querySelector('[data-ops-unblock]')!)

    await waitFor(() => expect(intent.querySelector('[role="alert"]')?.textContent).toBe('Invalid (422): note: Field required'))
    expect(intent.querySelector('[data-ops-refused-raw]')?.textContent).toBe(raw)
    expect((intent.querySelector('input') as HTMLInputElement).value).toBe('creds added')
  })

  it('a refusal with nothing beyond status and reason gets no empty detail', async () => {
    const jsonrpc = { id: 'a1', origin: 'jsonrpc', actions: ['approve', 'deny'], what_for: 'Run tests', exact_request: { command: 'npm test' }, profile: 'builder', age_s: 5 } as never
    render(<NeedsYouQueue items={[jsonrpc]} onApprove={vi.fn()} onDeny={vi.fn().mockRejectedValue(new Error('410: expired'))} />)
    const actions = rowOf('jsonrpc:a1').querySelector('[data-ops-row-actions]') as HTMLElement
    fireEvent.click(actions.querySelector('[data-ops-deny]')!)
    await waitFor(() => expect(actions.querySelector('[role="alert"]')?.textContent).toBe('Gone (410): expired'))
    expect(actions.querySelector('[data-ops-refused] details')).toBeNull()
  })

  it('stylesheet: at a 420px panel the refusal line and its raw detail wrap inside the row (no overflow)', () => {
    const css = readFileSync(join(__dirname, '../ops-base.css'), 'utf8')
    expect(css).toMatch(/:where\(\[data-ops-refused\]\) \{[^}]*flex-wrap: wrap;[^}]*max-width: 100%;[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/)
    expect(css).toMatch(/:where\(\[data-ops-refused-raw\]\) \{[^}]*white-space: pre-wrap;[^}]*overflow-wrap: anywhere;/)
  })
})
