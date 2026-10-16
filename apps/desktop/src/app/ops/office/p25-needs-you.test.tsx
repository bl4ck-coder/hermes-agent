// P25 (judge pass 19 #5): Office decisions are compact. 'More actions' sits on the primary action's line (no second
// near-empty band); the expansion is one intent per line; each refusal stays beside its own intent, notes kept.
// P26: the refusal line reads the status meaning before the server reason ('Conflict (409): …').
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { KanbanAction } from './needs-you'
import { NeedsYouQueue } from './needs-you'

afterEach(() => cleanup())

const review = { id: 't_r', origin: 'kanban_review', actions: ['approve'], what_for: 'Ship it', why: 'Needs a second look', profile: 'builder', age_s: 60 } as never
const blocked = { id: 't_b', origin: 'kanban_blocked', actions: [], what_for: 'Stuck job', why: 'Waiting on creds', profile: 'builder', age_s: 90 } as never
const rowOf = (key: string) => document.querySelector(`[data-ops-approval="${key}"]`) as HTMLElement

describe('P25 Office compact decision row', () => {
  it('More actions is a trigger in the same actions container as the primary action; closed, no second band', () => {
    render(<NeedsYouQueue items={[review, blocked]} onKanban={vi.fn()} onOpenTask={vi.fn()} />)

    for (const [key, primary] of [
      ['kanban_review:t_r', '[data-ops-approve]'],
      ['kanban_blocked:t_b', '[data-ops-primary]']
    ] as const) {
      const row = rowOf(key)
      const actions = row.querySelector('[data-ops-row-actions]') as HTMLElement
      const trigger = actions.querySelector('button[data-ops-row-more-trigger]') as HTMLButtonElement
      expect(actions.querySelector(primary)).toBeTruthy()
      expect(trigger?.textContent).toBe('More actions')
      // No <details> "More actions" summary on its own row any more.
      expect([...row.querySelectorAll('summary')].map(s => s.textContent)).not.toContain('More actions')

      const slot = row.querySelector('[data-ops-row-more-slot]') as HTMLElement
      expect(trigger.getAttribute('aria-expanded')).toBe('false')
      expect(trigger.getAttribute('aria-controls')).toBe(slot.id)
      expect(slot.hidden).toBe(true)

      fireEvent.click(trigger)
      expect(trigger.getAttribute('aria-expanded')).toBe('true')
      expect(slot.hidden).toBe(false)
      // One intent per line inside the expansion.
      expect(slot.querySelectorAll('[data-ops-intent]').length).toBeGreaterThanOrEqual(2)
      fireEvent.click(trigger)
      expect(slot.hidden).toBe(true)
    }
  })

  it('Request changes and Comment refused separately: each keeps its note and says its own error beside it; nothing approves', async () => {
    const onKanban = vi.fn((a: KanbanAction) => Promise.reject(new Error(a.kind === 'comment' ? '403: comments are read-only' : '409: task moved')))
    const onApprove = vi.fn()
    render(<NeedsYouQueue items={[review]} onApprove={onApprove} onKanban={onKanban} onOpenTask={vi.fn()} />)
    const row = rowOf('kanban_review:t_r')
    fireEvent.click(row.querySelector('[data-ops-row-more-trigger]')!)

    const changes = row.querySelector('[data-ops-intent="request-changes"]') as HTMLElement
    const comment = row.querySelector('[data-ops-intent="comment"]') as HTMLElement
    const changesInput = changes.querySelector('input') as HTMLInputElement
    const commentInput = comment.querySelector('input') as HTMLInputElement

    fireEvent.change(changesInput, { target: { value: 'Split the commit' } })
    fireEvent.click(changes.querySelector('[data-ops-request-changes]')!)
    await waitFor(() => expect(changes.querySelector('[role="alert"]')?.textContent).toBe('Conflict (409): task moved'))

    fireEvent.change(commentInput, { target: { value: 'Ping the owner' } })
    fireEvent.click(comment.querySelector('[data-ops-comment]')!)
    await waitFor(() => expect(comment.querySelector('[role="alert"]')?.textContent).toBe('Refused (403): comments are read-only'))

    // Each error sits in its own intent, once; both notes are kept for a retry.
    expect(changes.querySelectorAll('[role="alert"]').length).toBe(1)
    expect(changes.textContent).not.toContain('403')
    expect(row.querySelectorAll('[role="alert"]').length).toBe(2)
    expect(changesInput.value).toBe('Split the commit')
    expect(commentInput.value).toBe('Ping the owner')
    // Nothing in those flows is an approval.
    expect(onKanban.mock.calls.map(([a]) => a.kind)).toEqual(['request_changes', 'comment'])
    expect(onApprove).not.toHaveBeenCalled()
    // The decision is still open: Approve stays available, its own line shows no error.
    expect((row.querySelector('[data-ops-approve]') as HTMLButtonElement).disabled).toBe(false)
    expect(row.querySelector('[data-ops-row-actions] [role="alert"]')).toBeNull()
  })

  it('a refused Approve or Deny is said beside it, in the actions line', async () => {
    const jsonrpc = { id: 'a1', origin: 'jsonrpc', actions: ['approve', 'deny'], what_for: 'Run tests', exact_request: { command: 'npm test' }, profile: 'builder', age_s: 5 } as never
    const onDeny = vi.fn().mockRejectedValue(new Error('410: expired'))
    render(<NeedsYouQueue items={[jsonrpc]} onApprove={vi.fn()} onDeny={onDeny} />)
    const actions = rowOf('jsonrpc:a1').querySelector('[data-ops-row-actions]') as HTMLElement
    expect(actions.querySelector('[data-ops-approve]')).toBeTruthy()
    fireEvent.click(actions.querySelector('[data-ops-deny]')!)
    await waitFor(() => expect(actions.querySelector('[role="alert"]')?.textContent).toBe('Gone (410): expired'))
    // A single-action row has no empty band below it.
    expect(rowOf('jsonrpc:a1').querySelector('[data-ops-row-more-slot]')).toBeNull()
  })

  it('stylesheet: a closed slot takes no space; at a 420px panel the expansion stacks and never overflows', () => {
    const css = readFileSync(join(__dirname, '../ops-base.css'), 'utf8')
    expect(css).toContain(':where([data-ops-row-more-slot][hidden]) { display: none; }')
    // The narrow container rule (40rem covers 420px) gives the slot the content column and lets each intent wrap.
    const narrow = css.slice(css.indexOf('@container ops-rows (max-width: 40rem)'))
    expect(narrow).toMatch(/:where\(\[data-ops-row-more-slot\]\) \{ grid-column: 2; grid-row: auto;/)
    expect(css).toMatch(/:where\(\[data-ops-row-more-slot\]\) > :where\(\[data-ops-disclosure-body\]\) \{ flex: 1 1 100%; min-width: 0;/)
    expect(css).toMatch(/:where\(\[data-ops-intent\]\) \{ display: flex; flex: 1 1 100%; flex-wrap: wrap;[^}]*min-width: 0;/)
  })
})
