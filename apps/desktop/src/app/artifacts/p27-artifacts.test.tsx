// @vitest-environment jsdom
// P27 (judge pass 21 #8): Artifacts with the same file name in long folders across sessions and profiles. What tells them
// apart (the distinguishing folder, then the session/profile) leads its own line in table rows, Recent cards and image
// cards, and keyboard focus unfolds it; a preview whose URL answers 400 degrades to the monogram for that item only.
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { collectArtifactsForSession } from './artifact-utils'
import { resolveThumb } from './thumb-cache'

import { artifactPathHints, artifactSources, ArtifactsView } from './index'

const getSessionMessages = vi.hoisted(() => vi.fn())

const SESSIONS = [
  { id: 's-alpha', title: 'Alpha launch checklist', profile: 'default' },
  { id: 's-beta', title: 'Beta launch checklist', profile: 'writer' }
]

vi.mock('@/hermes', async () => ({
  ...(await vi.importActual('@/hermes')),
  listAllProfileSessions: async () => ({ sessions: SESSIONS }),
  getSessionMessages
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const ROOT = '/home/u/work/clients/acme-corporation-international'
const A = `${ROOT}/alpha-release-2026/documentation/generated/reports/summary.md`
const B = `${ROOT}/beta-release-2026/documentation/generated/reports/summary.md`

const media = (sessionId: string, ...paths: string[]) => ({
  messages: [{ role: 'assistant', timestamp: 1000, content: paths.map(p => `MEDIA:${p}`).join(' ') }],
  session_id: sessionId
})

const mount = () =>
  render(
    <MemoryRouter>
      <ArtifactsView />
    </MemoryRouter>
  )

describe('P27 differentiators for same-named files', () => {
  it('long folders: the differing folder leads, the shared middle collapses, uniqueness kept', () => {
    const h = artifactPathHints([
      { id: 'a', kind: 'file', label: 'summary.md', value: A },
      { id: 'b', kind: 'file', label: 'summary.md', value: B }
    ])

    expect(h.get('a')).toBe('alpha-release-2026/\u2026/reports')
    expect(h.get('b')).toBe('beta-release-2026/\u2026/reports')

    // When the short form would collide, the whole distinguishing path stays.
    const c = artifactPathHints([
      { id: 'x', kind: 'file', label: 'f.md', value: '/A/X/c/f.md' },
      { id: 'y', kind: 'file', label: 'f.md', value: '/A/Y/c/f.md' },
      { id: 'z', kind: 'file', label: 'f.md', value: '/B/X/c/f.md' }
    ])

    expect([c.get('x'), c.get('y'), c.get('z')]).toEqual(['A/X/c', 'A/Y/c', 'B/X/c'])
  })

  it('the same path in two sessions/profiles is told apart by where it came from', () => {
    const s = artifactSources([
      { id: '1', kind: 'file', label: 'summary.md', profile: 'default', sessionId: 's-alpha', sessionTitle: 'Alpha launch checklist' },
      { id: '2', kind: 'file', label: 'summary.md', profile: 'writer', sessionId: 's-beta', sessionTitle: 'Beta launch checklist' },
      { id: '3', kind: 'file', label: 'unique.md', profile: 'default', sessionId: 's-alpha', sessionTitle: 'Alpha launch checklist' }
    ])

    expect(s.get('1')).toBe('default \u00b7 Alpha launch checklist')
    expect(s.get('2')).toBe('writer \u00b7 Beta launch checklist')
    expect(s.has('3')).toBe(false)
  })

  it('table rows, Recent and image cards each carry the differentiator on its own line, unfolded by focus', async () => {
    getSessionMessages.mockImplementation(async (sessionId: string) =>
      sessionId === 's-alpha'
        ? media('s-alpha', A, `${ROOT}/alpha-release-2026/shots/screen.png`)
        : media('s-beta', B, `${ROOT}/beta-release-2026/shots/screen.png`)
    )

    mount()

    await waitFor(() => expect(document.querySelectorAll('tbody tr').length).toBe(2))

    // Table rows: under the file name, not beside it; the row focus unfolds the line.
    const rows = [...document.querySelectorAll('tbody tr')]
    const lines = rows.map(r => r.querySelector('[data-artifact-differentiator]') as HTMLElement)
    expect(lines.map(l => l.textContent).sort()).toEqual([
      'alpha-release-2026/\u2026/reports \u00b7 default \u00b7 Alpha launch checklist',
      'beta-release-2026/\u2026/reports \u00b7 writer \u00b7 Beta launch checklist'
    ])

    for (const line of lines) {
      expect(line.className).toContain('group-focus-within/artifact:whitespace-normal')
      // The differing folder is the first thing on the line (an end-truncated line keeps it).
      expect(line.firstElementChild?.matches('[data-artifact-path-hint]')).toBe(true)
      expect(line.parentElement?.firstElementChild?.textContent).toBe('summary.md')
    }

    // Recent cards: the same line leads (before type and date); cards never squeeze under 15rem.
    const cards = document.querySelector('[data-artifact-cards]') as HTMLElement
    expect(cards.className).toContain('grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))]')
    const badges = [...cards.querySelectorAll('[data-artifact-badge]')].map(b => b.textContent ?? '')
    expect(badges.some(b => b.startsWith('alpha-release-2026/\u2026/reports \u00b7 default \u00b7 Alpha launch checklist \u00b7 MD'))).toBe(true)
    expect(badges.some(b => b.startsWith('beta-release-2026/\u2026/reports \u00b7 writer \u00b7 Beta launch checklist \u00b7 MD'))).toBe(true)

    // Image cards (screen.png twice): folder and source on their own line too.
    const imageLines = [...document.querySelectorAll('[data-tour="artifact-card"] [data-artifact-differentiator]')].map(n => n.textContent)
    expect(imageLines.sort()).toEqual([
      'alpha-release-2026/shots \u00b7 default \u00b7 Alpha launch checklist',
      'beta-release-2026/shots \u00b7 writer \u00b7 Beta launch checklist'
    ])
  })
})

describe('P27 previews that answer 400', () => {
  it('a JSON-escaped URL loses its trailing backslashes (the request that answered 400 is not made)', () => {
    const records = collectArtifactsForSession(
      { id: 's-alpha', title: 'Alpha launch checklist' } as never,
      [{ role: 'assistant', timestamp: 1000, content: 'see https://pbs.twimg.com/media/DktYF6TUYAUYKlj.jpg?name=orig\\\\ and more' }] as never
    )

    expect(records.map(r => r.value)).toEqual(['https://pbs.twimg.com/media/DktYF6TUYAUYKlj.jpg?name=orig'])
  })

  it('a thumbnail URL answering 400 resolves to nothing (the card keeps its monogram)', async () => {
    const deps = {
      fetch: vi.fn(async () => new Response('bad request', { status: 400, headers: { 'content-type': 'text/plain' } })),
      toUrl: () => 'blob:never'
    }

    expect(await resolveThumb('https://opengraph.githubassets.com/1/o/r', deps)).toBeNull()
  })

  it('an image whose preview fails becomes that item\'s compact monogram; the rest of the screen stays', async () => {
    getSessionMessages.mockImplementation(async (sessionId: string) =>
      sessionId === 's-alpha'
        ? media('s-alpha', 'https://pbs.twimg.com/media/broken.jpg', A)
        : media('s-beta', 'https://pbs.twimg.com/media/fine.jpg')
    )

    mount()

    const broken = await waitFor(() => {
      const img = document.querySelector('img[src*="broken.jpg"]')
      expect(img).toBeTruthy()

      return img as HTMLImageElement
    })

    fireEvent.error(broken)

    await waitFor(() => expect(document.querySelectorAll('[data-artifact-thumb="failed"]')).toHaveLength(1))
    const failed = document.querySelector('[data-artifact-thumb="failed"]') as HTMLElement
    expect(failed.querySelector('.size-8')?.textContent).toBe('JP')
    expect(failed.closest('[data-tour="artifact-card"]')?.textContent).toContain('broken.jpg')
    // The other image still shows its preview, and the file list is still there: one item degraded, not the screen.
    expect(document.querySelector('img[src*="fine.jpg"]')).toBeTruthy()
    expect(document.querySelectorAll('tbody tr').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-artifacts-empty]')).toBeNull()
  })
})
