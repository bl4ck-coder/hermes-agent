import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as HermesApi from '@/hermes'
import type { SessionInfo } from '@/hermes'
import { $sessions } from '@/store/session'

import { CommandCenterView } from './index'

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<typeof HermesApi>()),
  getActionStatus: vi.fn(() => Promise.resolve({ running: false })),
  getLogs: vi.fn(() => Promise.resolve({ lines: [] })),
  getStatus: vi.fn(() => Promise.resolve({})),
  getUsageAnalytics: vi.fn(() => Promise.resolve({})),
  restartGateway: vi.fn(),
  updateHermes: vi.fn()
}))
vi.mock('@/lib/session-export', () => ({ exportSession: vi.fn() }))
vi.mock('./maintenance', () => ({ MaintenancePanel: () => null }))

const LONG = 'Refactor the onboarding flow so that every profile keeps its own model, skills and memory after an import from a remote gateway'

const row = (id: string, title: string, last: number) =>
  ({
    ended_at: null,
    id,
    input_tokens: 0,
    is_active: false,
    last_active: last,
    message_count: 3,
    model: null,
    output_tokens: 0,
    preview: `About ${title.toLowerCase()} and what still needs doing before release`,
    started_at: last - 100,
    title
  }) as SessionInfo

const SESSIONS = [row('s1', LONG, 1_756_600_000), row('s2', 'Fix cron delivery', 1_756_590_000), row('s3', 'Weekly review', 1_756_580_000), row('s4', 'Docs pass', 1_756_570_000)]

afterEach(() => {
  cleanup()
  $sessions.set([])
})

beforeEach(() => $sessions.set(SESSIONS))

const mount = () =>
  render(
    <MemoryRouter>
      <CommandCenterView initialSection="sessions" onClose={() => {}} onDeleteSession={() => Promise.resolve()} onOpenSession={() => {}} />
    </MemoryRouter>
  )

const rowTitles = () => [...document.querySelectorAll('[data-session-row] [data-session-title]')].map(n => n.textContent)

describe('P24b Sessions: long titles recoverable by keyboard; Clear search restores the rows', () => {
  it('title and context clamp to two lines at rest and unclamp when the row holds focus (no single-line truncate)', async () => {
    mount()
    const title = (await screen.findByText(LONG)) as HTMLElement
    expect(title.className).toContain('line-clamp-2')
    expect(title.className).toContain('group-focus-within:line-clamp-none')
    expect(title.className).not.toMatch(/\btruncate\b/)
    expect(title.getAttribute('title')).toBe(LONG)
    // The row container is the focus-within group, and the open button carries the full title as its name.
    const li = title.closest('[data-session-row]') as HTMLElement
    expect(li.className).toMatch(/\bgroup\b/)
    expect(title.closest('button')?.textContent).toContain(LONG)
    const ctx = li.querySelector('[data-session-context]') as HTMLElement
    expect(ctx.className).toContain('group-focus-within:line-clamp-none')
    expect(ctx.className).not.toMatch(/\btruncate\b/)
  })

  it('a search with no hits offers Clear search, which brings back the same four rows', async () => {
    mount()
    await screen.findByText(LONG)
    const before = rowTitles()
    expect(before).toHaveLength(4)

    const input = document.querySelector('[data-sessions-search] input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'zzz-no-such-session' } })

    const clear = await waitFor(() => {
      const b = document.querySelector('[data-sessions-empty-action]')
      expect(b?.textContent).toBe('Clear search')

      return b as HTMLButtonElement
    })

    expect(rowTitles()).toHaveLength(0)

    fireEvent.click(clear)
    await waitFor(() => expect(rowTitles()).toEqual(before))
  })
})
