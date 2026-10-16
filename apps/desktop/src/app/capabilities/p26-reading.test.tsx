// @vitest-environment jsdom
// P26 (judge pass 20 #7, reading before inventory): the Capabilities skill body is read as a document (Markdown rendered by
// the file-preview renderer, sanitized, selectable), metadata after it, Edit still opens the raw SKILL.md; the side list is
// the spec's 17.5rem rail on the panel's own width (container query) and stacks capped above the document when narrow.
import { QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as HermesApi from '@/hermes'
import { queryClient } from '@/lib/query-client'

const getSkills = vi.fn()
const getSkillContent = vi.fn()
const getLearningNode = vi.fn()

vi.mock('@/hermes', async importOriginal => ({
  ...(await importOriginal<typeof HermesApi>()),
  getSkills: () => getSkills(),
  getToolsets: () => Promise.resolve([]),
  getUsageAnalytics: () => Promise.resolve({ tools: [] }),
  getProfiles: () => Promise.resolve({ profiles: [{ name: 'default', is_default: true }] }),
  getSkillContent: (name: string) => getSkillContent(name),
  getOfficialSkills: () => Promise.resolve({ skills: [] }),
  getLearningNode: (name: string) => getLearningNode(name)
}))

vi.mock('@/store/notifications', () => ({ notify: vi.fn(), notifyError: vi.fn() }))

// The editor is CodeMirror; a textarea with the same initial value is enough to see which text Edit hands it.
vi.mock('@/components/chat/code-editor', () => ({
  CodeEditor: ({ initialValue }: { initialValue: string }) => (
    <textarea data-testid="skill-editor" readOnly value={initialValue} />
  )
}))

const { CapabilitiesView } = await import('./index')

const RAW = [
  '---',
  'name: web-research',
  'version: 1.2.0',
  '---',
  '',
  '# web-research',
  '',
  'Find sources and *verify* them.',
  '',
  '## Usage',
  '',
  '- Search first',
  '- Read the [docs](https://example.com/docs)',
  '',
  '```bash',
  'research --deep',
  '```',
  '',
  '<script>window.__p26 = 1</script><img src="x" onerror="window.__p26 = 2">'
].join('\n')

const skill = (name: string, o: Record<string, unknown> = {}) => ({
  name,
  description: `What ${name} does`,
  category: 'research',
  enabled: true,
  usage: 0,
  provenance: 'agent',
  ...o
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
  getSkills.mockResolvedValue([skill('web-research')])
  getSkillContent.mockImplementation((name: string) =>
    Promise.resolve({ name, path: `/skills/${name}/SKILL.md`, content: RAW.replace('web-research', name) })
  )
  getLearningNode.mockImplementation((name: string) => Promise.resolve({ name, content: RAW }))
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  queryClient.clear()
  delete (window as { __p26?: number }).__p26
})

describe('P26 Capabilities skill document', { timeout: 60_000 }, () => {
  it('renders the body as Markdown (heading, list, link, code, emphasis), selectable, without a pre around the body', async () => {
    await renderSkills()
    const heading = await screen.findByRole('heading', { level: 2, name: 'Usage' })
    const column = heading.closest('[data-skill-column]') as HTMLElement
    const doc = heading.closest('[data-preview-markdown]') as HTMLElement
    expect(doc.getAttribute('data-selectable-text')).toBe('true')
    expect(doc.querySelectorAll('ul > li')).toHaveLength(2)
    expect(doc.querySelector('em')?.textContent).toBe('verify')
    expect(screen.getByRole('link', { name: 'docs' }).getAttribute('href')).toBe('https://example.com/docs')
    expect(doc.textContent).toContain('research --deep')
    expect([...doc.querySelectorAll('code')].some(c => c.textContent?.includes('research --deep'))).toBe(true)

    // The only pre left is the fenced code block, never a wrapper holding the prose.
    for (const pre of column.querySelectorAll('pre')) {
      expect(pre.textContent).not.toContain('Usage')
    }

    expect(doc.textContent).not.toMatch(/^#|## Usage|- Search first/m)
    // Raw HTML in a skill does not execute: no script node, no inline handler.
    expect(doc.querySelector('script')).toBeNull()
    expect(doc.querySelector('[onerror]')).toBeNull()
    expect((window as { __p26?: number }).__p26).toBeUndefined()
    // The repeated "# web-research" heading is still dropped and metadata still follows the document (P25).
    expect(doc.querySelector('h1')).toBeNull()
    expect(
      doc.compareDocumentPosition(column.querySelector('[data-skill-meta]')!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy()
    // Reading scale: body 16/26 within the reading width.
    expect(doc.className).toMatch(/text-\(length:--type-body\)/)
    expect(doc.className).toMatch(/leading-\(--type-reading-lh\)/)
    expect(doc.className).toMatch(/max-w-\(--width-reading\)/)
    expect(doc.className).not.toMatch(/\btext-sm\b|\bmax-w-3xl\b/)
  })

  it('Edit still opens the raw SKILL.md text, not the rendered document', async () => {
    await renderSkills()
    await screen.findByRole('heading', { level: 2, name: 'Usage' })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    })
    const editor = (await screen.findByTestId('skill-editor')) as HTMLTextAreaElement
    expect(editor.value).toBe(RAW)
    expect(editor.value).toContain('## Usage\n\n- Search first')
  })

  it('the side list is the spec rail on the panel width (container query), stacked and capped when narrow; selection holds', async () => {
    getSkills.mockResolvedValue([skill('alpha'), skill('beta')])
    await renderSkills()
    await screen.findByRole('heading', { level: 3, name: 'alpha' })
    const root = document.querySelector('[data-master-detail="wide"]') as HTMLElement
    expect(root.className.split(/\s+/)).toContain('@container/md')
    const grid = root.firstElementChild as HTMLElement
    const cls = grid.className.split(/\s+/)
    // Wide panel: a 17.5rem list (drag override kept) and the document gets the rest.
    expect(cls).toContain('@min-[40rem]/md:grid-cols-[minmax(0,var(--md-split,var(--width-list,17.5rem)))_minmax(0,1fr)]')
    // Narrow panel: one column, the list capped to its content up to 14rem, the document takes the remaining height.
    expect(cls).toContain('grid-cols-1')
    expect(cls).toContain('grid-rows-[fit-content(14rem)_minmax(0,1fr)]')
    // No viewport breakpoint decides this layout any more.
    expect(cls.some(c => c.startsWith('sm:'))).toBe(false)
    fireEvent.click(screen.getByText('beta').closest('button')!)
    await screen.findByRole('heading', { level: 3, name: 'beta' })
    await waitFor(() => expect(getSkillContent).toHaveBeenCalledWith('beta'))
    expect(screen.getByRole('switch', { name: 'beta' }).closest('div')?.className).toMatch(/ui-row-active-background/)
  })
})
