// @vitest-environment jsdom
// P27 (judge pass 21 #8): narrow reading with identifiable context. In a narrow Capabilities panel (Ops open, <40rem)
// the stacked list folds to one line naming the selection (shown once, the document keeps the height), unfolds on
// demand and folds again on a new choice; a long skill document with a table and code scrolls inside those blocks.
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as HermesApi from '@/hermes'
import { queryClient } from '@/lib/query-client'

const getSkills = vi.fn()
const getSkillContent = vi.fn()

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<typeof HermesApi>()),
  getSkills: () => getSkills(),
  getToolsets: () => Promise.resolve([]),
  getUsageAnalytics: () => Promise.resolve({ tools: [] }),
  getProfiles: () => Promise.resolve({ profiles: [{ name: 'default', is_default: true }] }),
  getSkillContent: (name: string) => getSkillContent(name),
  getOfficialSkills: () => Promise.resolve({ skills: [] }),
  getLearningNode: (name: string) => Promise.resolve({ name, content: '' })
}))

vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))

const { CapabilitiesView } = await import('./index')

const LONG_DOC = [
  '## Usage',
  '',
  ...Array.from({ length: 30 }, (_, i) => [`Paragraph ${i}: find sources, read them whole and verify every claim before it lands.`, '']).flat(),
  '| Source | Verified by | Last checked | Notes about the source and why it is trusted for this kind of research |',
  '| --- | --- | --- | --- |',
  '| docs.example.com/very/long/path/to/the/reference/page | two independent reviewers | 2026-10-15 | primary |',
  '',
  '```bash',
  'research --deep --sources docs.example.com,archive.example.org,papers.example.net --format markdown --out ./notes/2026-10-15-release-notes.md',
  '```'
].join('\n')

const skill = (name: string) => ({
  name,
  description: `What ${name} does`,
  category: 'research',
  enabled: true,
  usage: 0,
  provenance: 'agent'
})

async function renderSkills() {
  await act(async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/capabilities?tab=skills']}>
          <CapabilitiesView />
        </MemoryRouter>
      </QueryClientProvider>
    )
  })
}

beforeEach(() => {
  getSkills.mockResolvedValue([skill('alpha'), skill('beta'), skill('gamma')])
  getSkillContent.mockImplementation((name: string) =>
    Promise.resolve({ name, path: `/skills/${name}/SKILL.md`, content: LONG_DOC })
  )
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  queryClient.clear()
})

const tokens = (el: Element | null) => (el?.getAttribute('class') ?? '').split(/\s+/)

describe('P27 Capabilities narrow: selection shown once, list folds, document keeps the height', { timeout: 60_000 }, () => {
  it('narrow panel: one line names the selection and the list body is folded; wide panel keeps the rail', async () => {
    await renderSkills()
    await screen.findByRole('heading', { level: 3, name: 'alpha' })

    const aside = document.querySelector('[data-master-detail="wide"] [data-list-column]') as HTMLElement
    const switcher = aside.querySelector('[data-list-switcher]') as HTMLButtonElement
    const body = aside.querySelector('[data-list-body]') as HTMLElement

    // The fold line exists only below the container breakpoint and names the selection once.
    expect(tokens(switcher)).toContain('@min-[40rem]/md:hidden')
    expect(switcher.getAttribute('aria-expanded')).toBe('false')
    expect(switcher.getAttribute('aria-controls')).toBe(body.id)
    expect(switcher.querySelector('[data-list-current]')?.textContent).toBe('alpha')
    expect(switcher.textContent).toContain('Show list')
    // Folded below 40rem (display none), always a flex rail at 40rem and up.
    expect(tokens(body)).toEqual(expect.arrayContaining(['hidden', '@min-[40rem]/md:flex']))
    // The only text of the selection outside the hidden body is the fold line (and the document's own heading).
    const outsideBody = [...aside.querySelectorAll('*')].filter(e => !body.contains(e) && e.childElementCount === 0)
    expect(outsideBody.filter(e => e.textContent === 'alpha')).toHaveLength(1)
    // The fold line is a 40px target and the stacked row stays capped (fit-content(14rem)) so the document keeps the rest.
    expect(tokens(switcher)).toContain('min-h-10')
    expect(tokens(aside.parentElement)).toContain('grid-rows-[fit-content(14rem)_minmax(0,1fr)]')
  })

  it('unfolds on demand and folds again when another item is chosen (selection kept, never lost)', async () => {
    await renderSkills()
    await screen.findByRole('heading', { level: 3, name: 'alpha' })
    const switcher = document.querySelector('[data-list-switcher]') as HTMLButtonElement
    const body = document.querySelector('[data-list-body]') as HTMLElement

    fireEvent.click(switcher)
    expect(switcher.getAttribute('aria-expanded')).toBe('true')
    expect(switcher.textContent).toContain('Hide list')
    expect(tokens(body)).toContain('flex')
    expect(tokens(body)).not.toContain('hidden')
    // The selected row is the highlighted one in the open list.
    expect(screen.getByRole('switch', { name: 'alpha' }).closest('div')?.className).toMatch(/ui-row-active-background/)

    fireEvent.click(screen.getByText('beta').closest('button')!)
    await screen.findByRole('heading', { level: 3, name: 'beta' })
    await waitFor(() => expect(getSkillContent).toHaveBeenCalledWith('beta'))
    const after = document.querySelector('[data-list-switcher]') as HTMLButtonElement
    expect(after.getAttribute('aria-expanded')).toBe('false')
    expect(after.querySelector('[data-list-current]')?.textContent).toBe('beta')
    expect(tokens(document.querySelector('[data-list-body]'))).toContain('hidden')
  })

  it('a long document with a table and code: each scrolls inside its own block, never the page', async () => {
    await renderSkills()
    const heading = await screen.findByRole('heading', { level: 2, name: 'Usage' })
    const doc = heading.closest('[data-preview-markdown]') as HTMLElement
    expect(doc.querySelectorAll('p').length).toBeGreaterThanOrEqual(30)

    const table = doc.querySelector('table') as HTMLTableElement
    expect(table).toBeTruthy()
    // The table's own wrapper scrolls sideways and takes the column width.
    expect(tokens(table.parentElement)).toEqual(expect.arrayContaining(['overflow-x-auto', 'w-full']))

    const code = [...doc.querySelectorAll('pre')].find(p => p.textContent?.includes('research --deep'))!
    expect(code).toBeTruthy()
    const outer = code.parentElement?.closest('pre') ?? code
    // The code frame clips and the code inside it scrolls sideways.
    expect(tokens(outer)).toEqual(expect.arrayContaining(['overflow-hidden', '[&_pre]:overflow-x-auto']))
    // The document column itself never widens past the reading width.
    expect(tokens(doc)).toContain('max-w-(--width-reading)')
    expect(tokens(doc.closest('[data-skill-column]'))).toContain('max-w-(--width-reading)')
  })
})
