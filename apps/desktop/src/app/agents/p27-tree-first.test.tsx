// P27 (judge pass 21 #6): Agents puts the delegated-work tree first. A compact one-line header (title + one line that
// repeats no count), the tree right after it, and the counters only once, in a folded Summary below the tree.
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $activeSessionId } from '@/store/session'
import { $subagentsBySession, upsertSubagent } from '@/store/subagents'

import { AgentsView } from './index'

vi.mock('@/lib/use-enter-animation', () => ({ useEnterAnimation: () => undefined }))

vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
)

beforeEach(() => {
  $activeSessionId.set('s1')
  upsertSubagent('s1', { subagent_id: 'p', goal: 'Parent work', status: 'running', tool_count: 3 })
  upsertSubagent('s1', { subagent_id: 'c1', parent_id: 'p', goal: 'Child A ok', status: 'completed', summary: 'Wrote the report' })
  upsertSubagent('s1', { subagent_id: 'c2', parent_id: 'p', goal: 'Child B fails', status: 'failed', summary: 'Tests broke' })
})

afterEach(() => {
  cleanup()
  $subagentsBySession.set({})
  $activeSessionId.set(null)
})

const FOCUSABLE = 'button, summary, a[href], input, select, textarea, [tabindex]'

const tabbable = (root: ParentNode) =>
  [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    el => !(el as HTMLButtonElement).disabled && el.tabIndex >= 0 && !el.closest('[hidden]') && !el.closest('details:not([open]) > :not(summary)')
  )

describe('P27 Agents: tree first', () => {
  it('a compact header (title + at most one line, no counters) is followed directly by the tree; the Summary comes after it', () => {
    render(<AgentsView onClose={vi.fn()} />)
    const header = document.querySelector('[data-agents-header]') as HTMLElement
    expect(header).not.toBeNull()
    // One title and at most one line; no hero stats band.
    expect(header.querySelectorAll('h1, h2, h3').length).toBe(1)
    expect(header.querySelectorAll('p').length).toBeLessThanOrEqual(1)
    expect(header.querySelector('dl, [data-hx-stat], [data-hero-stat]')).toBeNull()
    expect(document.querySelector('[data-hero-band]')).toBeNull()

    const tree = document.querySelector('[data-agents-tree]') as HTMLElement
    const summary = document.querySelector('details[data-agents-summary]') as HTMLDetailsElement
    expect(tree).not.toBeNull()
    expect(summary).not.toBeNull()
    expect(header.compareDocumentPosition(tree) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tree.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Nothing with text sits between the header and the tree.
    expect((header.nextElementSibling as HTMLElement).contains(tree)).toBe(true)
    const firstText = [...(header.nextElementSibling as HTMLElement).querySelectorAll<HTMLElement>('*')].find(el => el.childElementCount === 0 && el.textContent?.trim())
    expect(tree.contains(firstText!)).toBe(true)
    // Parent work, progress and failure are in the tree itself.
    expect(tree.textContent).toContain('Parent work')
    expect(tree.querySelector('[aria-label="Failed"]')).not.toBeNull()
    expect(tree.textContent).toContain('Tests broke')
    // The metrics are folded.
    expect(summary.open).toBe(false)
    expect(summary.querySelector('summary')?.textContent).toBe('Summary')
  })

  it('no counter is repeated between the header and the Summary', () => {
    render(<AgentsView onClose={vi.fn()} />)
    const header = document.querySelector('[data-agents-header]') as HTMLElement
    const parts = [...document.querySelectorAll('[data-agents-summary] [data-agents-summary-part]')].map(el => el.textContent ?? '')
    expect(parts).toEqual(expect.arrayContaining(['3 agents', '1 active', '1 failed', '3 tools']))
    expect(header.textContent).not.toMatch(/\d/)

    for (const part of parts) {
      expect(header.textContent).not.toContain(part)
    }

    // Each counter once in the panel's chrome.
    expect(document.querySelectorAll('[data-agents-summary-part]').length).toBe(new Set(parts).size)
  })

  it('Tab reaches the tree actions in reading order (parent, then its children) before the Summary; no positive tabindex', () => {
    render(<AgentsView onClose={vi.fn()} />)
    const order = tabbable(document.body)
    expect(order.some(el => el.tabIndex > 0)).toBe(false)
    const treeButtons = order.filter(el => el.closest('[data-agents-tree]'))
    expect(treeButtons.map(el => el.textContent?.match(/Parent work|Child A ok|Child B fails/)?.[0])).toEqual(['Parent work', 'Child A ok', 'Child B fails'])
    const summaryToggle = document.querySelector('[data-agents-summary] > summary') as HTMLElement
    expect(order.indexOf(summaryToggle)).toBeGreaterThan(order.indexOf(treeButtons.at(-1)!))
  })
})
