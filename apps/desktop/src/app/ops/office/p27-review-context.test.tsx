// P27 (judge pass 21 #7): Office brings the review of the task next to the decision. A row with or without a recorded
// reason offers 'Review task' on its context line (a secondary link, never a second primary); a long reason is clamped to
// two lines and unfolds on focus; inspecting the task keeps the typed note; a 409 keeps reason and draft.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { KanbanAction } from './needs-you'
import { NeedsYouQueue } from './needs-you'

afterEach(() => cleanup())

const IPC = "Error invoking remote method 'hermes:api': Error: "
const LONG = 'The migration rewrites every stored session id, so check the backfill log for skipped rows and confirm the rollback script was run against the staging copy before this lands; the reviewer asked for both.'
const reviewItem = (id: string, why: string) => ({ id, origin: 'kanban_review', actions: ['approve'], what_for: `Ship ${id}`, why, profile: 'builder', age_s: 60 }) as never
const rowOf = (key: string) => document.querySelector(`[data-ops-approval="${key}"]`) as HTMLElement

describe('P27 Office: review context before approve', () => {
  it('a row without a reason offers Review task on its context line, as a secondary link; one primary', () => {
    const onOpenTask = vi.fn()
    render(<NeedsYouQueue items={[reviewItem('t_n', '')]} onKanban={vi.fn()} onOpenTask={onOpenTask} />)
    const row = rowOf('kanban_review:t_n')
    const context = row.querySelector('[data-ops-row-context]') as HTMLElement
    expect(context.querySelector('[data-ops-why-missing]')).not.toBeNull()
    const link = context.querySelector('button[data-ops-review-task]') as HTMLButtonElement
    expect(link?.textContent).toBe('Review task')
    expect(link.hasAttribute('data-ops-primary')).toBe(false)
    expect(row.querySelectorAll('[data-ops-primary]').length).toBe(1)
    expect(row.querySelector('[data-ops-primary]')?.textContent).toBe('Approve')
    // Reading order: title, context (with the review link), then Approve.
    expect(link.compareDocumentPosition(row.querySelector('[data-ops-primary]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // One path to the task: it is no longer repeated inside More actions.
    expect(row.querySelector('[data-ops-row-more-slot] [data-ops-row-link]')).toBeNull()
    fireEvent.click(link)
    expect(onOpenTask).toHaveBeenCalledWith('t_n')
  })

  it('a row with a reason keeps it and still offers Review task; jsonrpc rows have no task link', () => {
    const jsonrpc = { id: 'a1', origin: 'jsonrpc', actions: ['approve', 'deny'], what_for: 'Run tests', exact_request: { command: 'npm test' }, profile: 'builder', age_s: 5 } as never
    render(<NeedsYouQueue items={[reviewItem('t_w', 'Needs a second look'), jsonrpc]} onApprove={vi.fn()} onKanban={vi.fn()} onOpenTask={vi.fn()} />)
    const context = rowOf('kanban_review:t_w').querySelector('[data-ops-row-context]') as HTMLElement
    expect(context.querySelector('[data-ops-why]')?.textContent).toBe('Needs a second look')
    expect(context.querySelector('[data-ops-review-task]')).not.toBeNull()
    expect(rowOf('jsonrpc:a1').querySelector('[data-ops-review-task]')).toBeNull()
  })

  it('a long reason is clamped to two lines and unfolds on focus; a short one is not a tab stop', () => {
    render(<NeedsYouQueue items={[reviewItem('t_l', LONG), reviewItem('t_s', 'Short reason')]} onKanban={vi.fn()} onOpenTask={vi.fn()} />)
    const long = rowOf('kanban_review:t_l').querySelector('[data-ops-why]') as HTMLElement
    expect(long.textContent).toBe(LONG)
    expect(long.hasAttribute('data-ops-why-long')).toBe(true)
    expect(long.tabIndex).toBe(0)
    expect(long.hasAttribute('data-ops-why-expanded')).toBe(false)
    fireEvent.focus(long)
    expect(long.hasAttribute('data-ops-why-expanded')).toBe(true)
    fireEvent.blur(long)
    expect(long.hasAttribute('data-ops-why-expanded')).toBe(false)
    const short = rowOf('kanban_review:t_s').querySelector('[data-ops-why]') as HTMLElement
    expect(short.hasAttribute('data-ops-why-long')).toBe(false)
    expect(short.hasAttribute('tabindex')).toBe(false)

    const css = readFileSync(join(__dirname, '../ops-base.css'), 'utf8')
    expect(css).toMatch(/:where\(\[data-ops-why-long\]\) \{[^}]*-webkit-line-clamp: 2;[^}]*overflow: hidden;/)
    expect(css).toMatch(/:where\(\[data-ops-why-long\]\[data-ops-why-expanded\], \[data-ops-why-long\]:focus\) \{[^}]*-webkit-line-clamp: unset;/)
  })

  it('inspecting the task keeps the typed note and the open expansion, also across leaving Office and coming back', () => {
    const onOpenTask = vi.fn()
    const first = render(<NeedsYouQueue items={[reviewItem('t_k', '')]} onKanban={vi.fn()} onOpenTask={onOpenTask} />)
    let row = rowOf('kanban_review:t_k')
    fireEvent.click(row.querySelector('[data-ops-row-more-trigger]')!)
    fireEvent.change(row.querySelector('[data-ops-intent="request-changes"] input')!, { target: { value: 'Split the commit' } })
    fireEvent.click(row.querySelector('[data-ops-review-task]')!)
    expect(onOpenTask).toHaveBeenCalledWith('t_k')
    expect((row.querySelector('[data-ops-intent="request-changes"] input') as HTMLInputElement).value).toBe('Split the commit')
    expect((row.querySelector('[data-ops-row-more-slot]') as HTMLElement).hidden).toBe(false)

    // Opening the task can navigate away (Office unmounts); the draft is there when the user comes back.
    first.unmount()
    render(<NeedsYouQueue items={[reviewItem('t_k', '')]} onKanban={vi.fn()} onOpenTask={onOpenTask} />)
    row = rowOf('kanban_review:t_k')
    expect((row.querySelector('[data-ops-intent="request-changes"] input') as HTMLInputElement).value).toBe('Split the commit')
    // ...and visible: the expansion holding it is open again.
    expect((row.querySelector('[data-ops-row-more-slot]') as HTMLElement).hidden).toBe(false)
  })

  it('a 409 after inspecting the task keeps the human reason, the draft and the review link visible', async () => {
    const raw = `${IPC}409: {"detail":"Task moved to done by another agent"}`
    const onKanban = vi.fn((_a: KanbanAction) => Promise.reject(new Error(raw)))
    render(<NeedsYouQueue items={[reviewItem('t_c', '')]} onKanban={onKanban} onOpenTask={vi.fn()} />)
    const row = rowOf('kanban_review:t_c')
    fireEvent.click(row.querySelector('[data-ops-row-more-trigger]')!)
    const intent = row.querySelector('[data-ops-intent="request-changes"]') as HTMLElement
    fireEvent.change(intent.querySelector('input')!, { target: { value: 'Keep the old flag' } })
    fireEvent.click(row.querySelector('[data-ops-review-task]')!)
    fireEvent.click(intent.querySelector('[data-ops-request-changes]')!)
    await waitFor(() => expect(intent.querySelector('[role="alert"]')?.textContent).toBe('Conflict (409): Task moved to done by another agent'))
    expect((intent.querySelector('input') as HTMLInputElement).value).toBe('Keep the old flag')
    expect((row.querySelector('[data-ops-row-more-slot]') as HTMLElement).hidden).toBe(false)
    expect(row.querySelector('[data-ops-row-context] [data-ops-review-task]')).not.toBeNull()
    expect(row.querySelectorAll('[data-ops-primary]').length).toBe(1)
    // P26 helper: transport text only folded.
    expect(intent.querySelector('[data-ops-refused] details')?.hasAttribute('open')).toBe(false)

    // At a 420px panel the context line (reason + review link) wraps inside the row.
    const css = readFileSync(join(__dirname, '../ops-base.css'), 'utf8')
    expect(css).toMatch(/:where\(\[data-ops-review-context\]\) \{[^}]*flex-wrap: wrap;[^}]*min-width: 0;/)
  })
})
