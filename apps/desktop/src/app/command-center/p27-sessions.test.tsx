// @vitest-environment jsdom
// P27 (judge pass 21 #8): Sessions rows separate the human context from technical provenance and keep the date next to
// the title, so sessions close in time compare at a glance; titles that read alike stay distinguishable at 420px.
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as HermesApi from '@/hermes'
import type { SessionInfo } from '@/hermes'
import { $sessions } from '@/store/session'

import { CommandCenterView, sessionProvenance, sessionTitleTwins } from './index'

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

const row = (id: string, title: string, last: number, extra: Partial<SessionInfo> = {}) =>
  ({
    ended_at: null,
    id,
    input_tokens: 0,
    is_active: false,
    last_active: last,
    message_count: 3,
    model: null,
    output_tokens: 0,
    preview: null,
    started_at: last - 100,
    title,
    ...extra
  }) as SessionInfo

const STAGING = 'Fix the login redirect loop in the mobile app for the staging gateway after the OAuth change'
const PROD = 'Fix the login redirect loop in the mobile app for the production gateway after the OAuth change'

const SESSIONS = [
  row('20261015_101500_aaa111', STAGING, 1_760_530_000, {
    cwd: '/home/u/work/mobile-app',
    git_branch: 'fix/staging-redirect',
    preview: 'Staging keeps bouncing between /login and /callback'
  }),
  row('20261015_100500_bbb222', PROD, 1_760_529_400, {
    cwd: '/home/u/work/mobile-app',
    git_branch: 'fix/prod-redirect',
    preview: 'Production users stuck after the token refresh'
  }),
  row('20261015_090000_ccc333', 'Weekly review', 1_760_525_000, { cwd: '/home/u/notes', preview: 'What shipped this week' }),
  row('20261008_090000_ddd444', 'Weekly review', 1_759_920_000, { cwd: '/home/u/notes', preview: 'What shipped this week' }),
  row('20261001_090000_eee555', 'Docs pass', 1_759_310_000, { preview: 'Tighten the install guide' })
]

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

const rowFor = (id: string) =>
  [...document.querySelectorAll<HTMLElement>('[data-session-row]')].find(li =>
    li.querySelector('[data-session-provenance]')?.textContent?.includes(id.slice(-6)) ||
    li.querySelector('[data-session-title]')?.textContent === SESSIONS.find(s => s.id === id)?.title
  )!

describe('P27 sessionTitleTwins', () => {
  it('marks equal titles exact and long shared openings near; distinct titles are not twins', () => {
    const twins = sessionTitleTwins(SESSIONS)
    expect(twins.get('20261015_101500_aaa111')).toBe('near')
    expect(twins.get('20261015_100500_bbb222')).toBe('near')
    expect(twins.get('20261015_090000_ccc333')).toBe('exact')
    expect(twins.get('20261008_090000_ddd444')).toBe('exact')
    expect(twins.has('20261001_090000_eee555')).toBe(false)
    // A short shared opening is not "reads the same" ("Fix a" vs "Fix b").
    expect(sessionTitleTwins([row('a', 'Fix a', 1), row('b', 'Fix b', 2)]).size).toBe(0)
  })

  it('provenance is folder · branch, plus the short id only for an exact twin', () => {
    expect(sessionProvenance(SESSIONS[0], false)).toBe('mobile-app \u00b7 fix/staging-redirect')
    expect(sessionProvenance(SESSIONS[2], true)).toBe('notes \u00b7 #ccc333')
    expect(sessionProvenance(SESSIONS[4], false)).toBe('')
  })
})

describe('P27 Sessions rows', () => {
  it('first line: title then its date; then the human context; provenance on its own muted mono line', async () => {
    mount()
    await screen.findByText(STAGING)
    const li = rowFor('20261015_101500_aaa111')
    const main = li.querySelector('.hx-row-main') as HTMLElement
    const head = main.firstElementChild as HTMLElement
    expect(head.matches('[data-session-head]')).toBe(true)
    expect(head.children[0].matches('[data-session-title]')).toBe(true)
    const date = head.children[1] as HTMLElement
    expect(date.matches('[data-session-date]')).toBe(true)
    expect(date.textContent?.trim()).not.toBe('')
    // Legible: meta size at full muted colour, tabular (no faded caption at the far edge any more).
    expect(date.className).toMatch(/text-\(length:--type-meta\)/)
    expect(date.className).toContain('tabular-nums')
    expect(date.className).not.toMatch(/muted-foreground\/\d+/)
    expect(li.querySelector('.hx-row-trailing')).toBeNull()

    const context = main.querySelector('[data-session-context]') as HTMLElement
    const provenance = main.querySelector('[data-session-provenance]') as HTMLElement
    expect(context.textContent).toBe('Staging keeps bouncing between /login and /callback')
    // The conversation line carries no folder or branch; those sit on the next line.
    expect(context.textContent).not.toMatch(/mobile-app|fix\//)
    expect(provenance.textContent).toBe('mobile-app \u00b7 fix/staging-redirect')
    expect(context.compareDocumentPosition(provenance) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(provenance.className).toContain('font-mono')
    expect(provenance.className).toContain('text-muted-foreground')
  })

  it('near-identical titles are never clamped, so the differing words show at 420px; exact twins differ by id', async () => {
    mount()
    await screen.findByText(STAGING)
    const staging = rowFor('20261015_101500_aaa111').querySelector('[data-session-title]') as HTMLElement
    const prod = rowFor('20261015_100500_bbb222').querySelector('[data-session-title]') as HTMLElement

    for (const title of [staging, prod]) {
      expect(title.className).toContain('line-clamp-none')
      expect(title.className).not.toContain('line-clamp-2')
      expect(title.closest('[data-session-row]')?.getAttribute('data-session-twin')).toBe('near')
    }

    expect(staging.textContent).toContain('staging')
    expect(prod.textContent).toContain('production')

    const weekly = [...document.querySelectorAll<HTMLElement>('[data-session-row][data-session-twin="exact"]')]
    expect(weekly).toHaveLength(2)
    const ids = weekly.map(li => li.querySelector('[data-session-provenance]')?.textContent)
    expect(ids).toEqual(['notes \u00b7 #ccc333', 'notes \u00b7 #ddd444'])
    // Their dates differ too and sit beside the title.
    const dates = weekly.map(li => li.querySelector('[data-session-head] [data-session-date]')?.textContent)
    expect(new Set(dates).size).toBe(2)

    // A distinct title keeps the two-line clamp (unclamped on focus).
    const docs = screen.getByText('Docs pass')
    expect(docs.className).toContain('line-clamp-2')
    expect(docs.className).toContain('group-focus-within:line-clamp-none')
    expect(docs.closest('[data-session-row]')?.querySelector('[data-session-provenance]')).toBeNull()
  })
})
