// P26 (judge pass 20 #7, reading before inventory): Skills rows pay less height (one meta line, Details beside Open skill,
// a long description clamped until focus or expansion); Channels puts configured connections first and folds the catalog
// behind Browse catalog; partial "N+" totals keep their accessible description under filters.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { type B4Client, ChannelsLens, SkillsLens } from './b4-lenses'

afterEach(() => cleanup())

const css = readFileSync(join(__dirname, '../ops-base.css'), 'utf8')
const p26 = css.slice(css.indexOf('/* P26 (judge pass 20 #7, Skills)'))

const base = (o: Partial<B4Client> = {}): B4Client => ({
  profiles: vi.fn().mockResolvedValue([{ name: 'default' }, { name: 'pixel' }]),
  tasks: vi.fn().mockResolvedValue([]),
  workers: vi.fn().mockResolvedValue([]),
  skills: vi.fn().mockResolvedValue([]),
  official: vi.fn().mockResolvedValue([]),
  install: vi.fn(),
  channels: vi.fn().mockResolvedValue({ catalog: [], servers: [], platforms: [], providers: [] }),
  ...o
})

const LONG = 'Plan research across many sources, '.repeat(12).trim()

describe('P26 Skills rows: name, what it does, one meta line; details beside Open skill', () => {
  const lens = () =>
    render(
      <SkillsLens
        client={base({
          skills: vi.fn().mockResolvedValue([
            { name: 'deep-research', category: 'research', description: LONG, enabled: true },
            { name: 'figma', category: 'design', description: 'Read Figma files', enabled: true }
          ])
        })}
        onOpenRoute={vi.fn()}
        profile="default"
      />
    )

  it('keeps category and state on one meta line and puts the Details trigger on the action line', async () => {
    lens()
    await waitFor(() => expect(document.querySelector('[data-ops-skill-open="deep-research"]')).toBeTruthy())
    const row = document.querySelector('li[data-ops-skill="deep-research"]') as HTMLElement
    const meta = row.querySelector('[data-ops-row-meta]') as HTMLElement
    expect([...meta.children].map(c => c.textContent)).toEqual(['research', 'Enabled'])
    expect(row.querySelectorAll('[data-ops-row-meta]')).toHaveLength(1)
    const actions = row.querySelector('[data-ops-row-actions]') as HTMLElement
    const trigger = actions.querySelector('[data-ops-row-more-trigger]') as HTMLButtonElement
    expect(actions.querySelector('[data-ops-skill-open="deep-research"]')).toBeTruthy()
    expect(trigger.textContent).toBe('Details')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    // Closed: no native disclosure band, the slot is hidden and the row is not marked open.
    expect(row.querySelector('details')).toBeNull()
    const slot = document.getElementById(trigger.getAttribute('aria-controls')!) as HTMLElement
    expect(slot.hidden).toBe(true)
    expect(row.hasAttribute('data-ops-row-open')).toBe(false)
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(slot.hidden).toBe(false)
    expect(row.hasAttribute('data-ops-row-open')).toBe(true)
    expect(slot.querySelector('[data-ops-skill-agents]')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'pixel' })).toBeTruthy()
  })

  it('clamps a long description to two lines until the row has focus or its details are open; the text stays whole in the DOM', async () => {
    lens()
    await waitFor(() => expect(document.querySelector('[data-ops-skill-desc]')).toBeTruthy())
    expect(document.querySelector('li[data-ops-skill="deep-research"] [data-ops-skill-desc]')?.textContent).toBe(LONG)
    expect(p26).toContain(
      ':where([data-ops-skill]) :where([data-ops-skill-desc]) { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }'
    )
    expect(p26).toContain(
      ':where([data-ops-skill]:focus-within, [data-ops-skill][data-ops-row-open]) :where([data-ops-skill-desc]) { display: block; -webkit-line-clamp: unset; overflow: visible; }'
    )
  })

  it('stylesheet: compact wrapper, body type untouched, meta never wraps, all rules zero-specificity', () => {
    expect(p26).toMatch(/:where\(li\[data-ops-row\]\[data-ops-skill\]\) \{ min-height: var\(--row2-min,64px\); padding: var\(--space-2,8px\) var\(--space-4,16px\); \}/)
    expect(p26).toMatch(/:where\(\[data-ops-skill\]\) :where\(\[data-ops-row-meta\]\) \{ flex-wrap: nowrap;[^}]*white-space: nowrap; \}/)
    expect(p26).not.toMatch(/font-size|!important|:has\(/)
    const rules = p26.split('\n').filter(l => /\{/.test(l) && !l.trim().startsWith('/*') && !/^@(media|container)/.test(l.trim()))

    for (const r of rules) {
      expect(r.trim().startsWith(':where(')).toBe(true)
    }
  })
})

describe('P26 Channels: configured first, catalog behind Browse catalog, partial totals survive filters', () => {
  const full = {
    catalog: [
      { name: 'github', description: 'Repos and PRs', installed: false },
      { name: 'sentry', description: 'Errors', installed: false }
    ],
    servers: [{ name: 'linear', enabled: true }],
    platforms: [
      { id: 'telegram', name: 'Telegram', description: 'Bot', configured: true, enabled: true, gateway_running: true },
      { id: 'slack', name: 'Slack', description: 'Workspace bot', configured: false, enabled: false }
    ],
    providers: [{ id: 'anthropic', name: 'Claude', flow: 'pkce', status: { logged_in: true } }]
  }

  it('lists configured connections before the catalog, and the catalog is folded while configured items exist', async () => {
    render(<ChannelsLens client={base({ channels: vi.fn().mockResolvedValue(full) })} profile="p" />)
    await screen.findByText('Telegram')
    const lens = document.querySelector('[data-ops-lens="channels"]') as HTMLElement
    const configured = lens.querySelector('[data-ops-app-section="connected"], [data-ops-app-section="warn"]') as HTMLElement
    const catalog = lens.querySelector('[data-ops-app-catalog]') as HTMLElement
    expect(configured.compareDocumentPosition(catalog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const toggle = catalog.querySelector('[data-ops-app-catalog-toggle]') as HTMLButtonElement
    expect(toggle.closest('h3')).toBeTruthy()
    expect(toggle.textContent).toMatch(/^Browse catalog \d+$/)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    const body = document.getElementById(toggle.getAttribute('aria-controls')!) as HTMLElement
    expect(body.hidden).toBe(true)
    expect(body.textContent).toContain('github')
    expect(catalog.hasAttribute('data-ops-app-catalog-folded')).toBe(true)
    expect(screen.queryByRole('heading', { name: 'Add connections' })).toBeNull()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(body.hidden).toBe(false)
    expect(catalog.hasAttribute('data-ops-app-catalog-folded')).toBe(false)
  })

  it('a search shows matching catalog apps without the fold; with nothing configured the catalog is the list', async () => {
    render(<ChannelsLens client={base({ channels: vi.fn().mockResolvedValue(full) })} profile="p" />)
    await screen.findByText('Telegram')
    fireEvent.change(screen.getByLabelText('search integrations'), { target: { value: 'git' } })
    // Only github matches; nothing configured is on screen, so the catalog is simply the list.
    expect(document.querySelector('[data-ops-app-catalog-toggle]')).toBeNull()
    expect((document.querySelector('[data-ops-app-catalog-body]') as HTMLElement).hidden).toBe(false)
    expect(document.querySelector('[data-ops-app-catalog-body]')?.textContent).toContain('github')
    fireEvent.change(screen.getByLabelText('search integrations'), { target: { value: 'e' } })
    // Telegram (configured) and Sentry (catalog) both match: the search is a request to see matches, no fold.
    expect(screen.getByText('Telegram')).toBeTruthy()
    expect(document.querySelector('[data-ops-app-catalog-toggle]')).toBeNull()
    expect((document.querySelector('[data-ops-app-catalog-body]') as HTMLElement).hidden).toBe(false)
    cleanup()
    render(
      <ChannelsLens
        client={base({ channels: vi.fn().mockResolvedValue({ ...full, servers: [], platforms: [full.platforms[1]], providers: [] }) })}
        profile="p"
      />
    )
    await screen.findByText('github')
    expect(document.querySelector('[data-ops-app-catalog-toggle]')).toBeNull()
    expect((document.querySelector('[data-ops-app-catalog-body]') as HTMLElement).hidden).toBe(false)
  })

  it('keeps N+ and its accessible description while the Connected filter, a category and a search are applied', async () => {
    render(<ChannelsLens client={base({ channels: vi.fn().mockResolvedValue({ ...full, providers: null }) })} profile="p" />)
    await screen.findByText(/Couldn't load/)

    const check = () => {
      const notice = document.querySelector('[data-ops-partial]') as HTMLElement
      expect(notice).toBeTruthy()

      for (const f of ['all', 'connected']) {
        const tab = document.querySelector(`[data-ops-app-filter="${f}"]`) as HTMLElement
        expect(tab.textContent).toMatch(/\d\+$/)
        expect(tab.getAttribute('aria-describedby')).toBe(notice.id)
        expect(tab.hasAttribute('data-ops-count-partial')).toBe(true)
      }
    }

    check()
    fireEvent.click(document.querySelector('[data-ops-app-filter="connected"]')!)
    check()
    fireEvent.click(document.querySelector('[data-ops-app-cat="Messaging"]')!)
    check()
    fireEvent.change(screen.getByLabelText('search integrations'), { target: { value: 'zzz' } })
    check()
    expect(document.querySelector('[data-ops-empty="apps"]')).toBeTruthy()
    // At a 420px panel the tab total never splits from its "+" (tabs do not wrap inside).
    expect(css).toContain(':where([data-ops-app-filter]) { white-space: nowrap; }')
  })
})
