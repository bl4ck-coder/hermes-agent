import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type * as ArtifactUtils from './artifact-utils'
import { artifactPathHints, ArtifactsView } from './index'

const getSessionMessages = vi.hoisted(() => vi.fn())

vi.mock('@/hermes', async () => ({
  ...(await vi.importActual('@/hermes')),
  listAllProfileSessions: async () => ({ sessions: [{ id: 'artifact-session', title: 'Fixture', profile: 'default' }] }),
  getSessionMessages
}))

// Every thumbnail fails to resolve (the 404 case from the judge's capture).
vi.mock('./artifact-utils', async () => ({
  ...(await vi.importActual<typeof ArtifactUtils>('./artifact-utils')),
  artifactImageSrc: () => Promise.reject(new Error('404'))
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const withMedia = (...paths: string[]) =>
  getSessionMessages.mockResolvedValue({
    messages: [{ role: 'assistant', timestamp: 1000, content: paths.map(p => `MEDIA:${p}`).join(' ') }],
    session_id: 'artifact-session'
  })

const mount = (entry = '/') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ArtifactsView />
    </MemoryRouter>
  )

const hints = () => [...document.querySelectorAll('[data-artifact-path-hint]')].map(n => n.textContent?.replace(/ · $/, ''))

describe('P24c artifactPathHints', () => {
  it('names the fewest parent folders that tell same-named files apart', () => {
    const h = artifactPathHints([
      { id: 'a', kind: 'file', label: 'report.md', value: '/w/proj-a/docs/report.md' },
      { id: 'b', kind: 'file', label: 'report.md', value: '/w/proj-b/docs/report.md' },
      { id: 'c', kind: 'file', label: 'notes.md', value: '/w/proj-a/notes.md' },
      { id: 'd', kind: 'file', label: 'plan.md', value: 'C:\\work\\x\\plan.md' },
      { id: 'e', kind: 'file', label: 'plan.md', value: 'C:\\work\\y\\plan.md' },
      { id: 'f', kind: 'file', label: 'same.txt', value: '/s/same.txt' },
      { id: 'g', kind: 'file', label: 'same.txt', value: '/s/same.txt' },
      { id: 'h', kind: 'link', label: 'report.md', value: 'https://example.com/report.md' }
    ])

    expect(h.get('a')).toBe('proj-a/docs')
    expect(h.get('b')).toBe('proj-b/docs')
    expect(h.get('d')).toBe('x')
    expect(h.get('e')).toBe('y')
    // A unique name, the same file twice, and links get no hint.
    expect(h.has('c')).toBe(false)
    expect(h.has('f')).toBe(false)
    expect(h.has('h')).toBe(false)
  })
})

describe('P24c Artifacts view', () => {
  it('two report.md files show distinguishing paths; a failed thumbnail is a compact 32px mark', async () => {
    withMedia('/w/proj-a/docs/report.md', '/w/proj-b/docs/report.md', '/w/shots/pic.png')
    mount()
    await waitFor(() => expect(hints()).toEqual(expect.arrayContaining(['proj-a/docs', 'proj-b/docs'])))

    const failed = await waitFor(() => {
      const f = document.querySelector('[data-artifact-thumb="failed"]')
      expect(f).toBeTruthy()

      return f as HTMLElement
    })

    expect(failed.querySelector('.size-8')).toBeTruthy()
    expect(failed.textContent).toContain('Preview unavailable')
    // No large empty image box remains for the failed preview.
    expect(document.querySelector('[data-tour="artifact-card"] .h-40')).toBeNull()
  })

  it('a search with no hits is not an empty library: it offers Clear search, which brings the files back', async () => {
    withMedia('/w/proj-a/docs/report.md', '/w/proj-b/docs/report.md')
    mount()
    await screen.findAllByRole('button', { name: /report\.md/ })
    const before = screen.getAllByRole('button', { name: /report\.md/ }).length

    fireEvent.change(document.querySelector('input') as HTMLInputElement, { target: { value: 'zzz-nothing' } })

    const reset = await waitFor(() => {
      expect(document.querySelector('[data-artifacts-empty="filtered"]')).toBeTruthy()

      return document.querySelector('[data-artifacts-empty-reset]') as HTMLButtonElement
    })

    expect(document.querySelector('[data-artifacts-empty-action]')).toBeNull()
    expect(reset.textContent).toBe('Clear search')

    fireEvent.click(reset)
    await waitFor(() => expect(screen.getAllByRole('button', { name: /report\.md/ }).length).toBe(before))
  })

  it('an empty tab offers Show all, not New session', async () => {
    withMedia('/w/proj-a/docs/report.md')
    mount('/?tab=link')

    const reset = await waitFor(() => {
      expect(document.querySelector('[data-artifacts-empty="filtered"]')).toBeTruthy()

      return document.querySelector('[data-artifacts-empty-reset]') as HTMLButtonElement
    })

    expect(reset.textContent).toBe('Show all')
  })

  it('an empty library still offers New session', async () => {
    getSessionMessages.mockResolvedValue({ messages: [{ role: 'assistant', timestamp: 1000, content: 'nothing here' }], session_id: 'artifact-session' })
    mount()
    await waitFor(() => expect(document.querySelector('[data-artifacts-empty="library"]')).toBeTruthy())
    expect(document.querySelector('[data-artifacts-empty-action]')).toBeTruthy()
    expect(document.querySelector('[data-artifacts-empty-reset]')).toBeNull()
  })
})
