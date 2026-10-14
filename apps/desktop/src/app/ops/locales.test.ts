import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { BUNDLED_LOCALES, TRANSLATIONS } from '@/i18n'
import { en } from '@/i18n/en'

import { OPS_LOCALE_IDS, OPS_LOCALES, OPS_STATES_LOCALES, type OpsLocaleId, opsNavLabel, opsPresenceLabel } from './locales'

type Leaf = { path: string; value: unknown }

function leaves(value: unknown, path = ''): Leaf[] {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key))
  }

  return [{ path, value }]
}

const render = (value: unknown): string => (typeof value === 'function' ? String(value('X1', 'Y2')) : String(value))

const catalog = (locale: OpsLocaleId) => ({ ops: OPS_LOCALES[locale], opsStates: OPS_STATES_LOCALES[locale] })

// The product name and cognates that are correct as-is in a given language.
const BRAND = new Set(['ops.brand', 'ops.palette.group', 'ops.rail.label', 'ops.rail.sectionOps'])

const COGNATES: Partial<Record<OpsLocaleId, string[]>> = {
  de: [
    'ops.chrome.dock',
    'ops.nav.board',
    'ops.presence.offline',
    'ops.rail.online',
    'ops.rail.palette',
    'ops.shortcuts.actions.goBoard',
    'ops.toolbar.back',
    'ops.toolbar.dock'
  ],
  es: ['ops.chrome.tokens', 'ops.inspector.label', 'ops.toolbar.back', 'ops.toolbar.inspector'],
  fr: [
    'ops.chrome.dock',
    'ops.nav.agents',
    'ops.nav.conversations',
    'ops.node.port',
    'ops.rail.palette',
    'ops.shapes.triangle',
    'ops.toolbar.dock',
    'ops.toolbar.rail'
  ]
}

describe('Ops locale catalog', () => {
  it('covers exactly the bundled Desktop locales', () => {
    expect([...OPS_LOCALE_IDS].sort()).toEqual([...BUNDLED_LOCALES].sort())
  })

  it.each([...OPS_LOCALE_IDS])('%s is registered through the Desktop catalog (t.ops / t.opsStates)', locale => {
    const registered = leaves({ ops: TRANSLATIONS[locale].ops, opsStates: TRANSLATIONS[locale].opsStates })
    const expected = leaves(catalog(locale))

    expect(registered.map(leaf => [leaf.path, render(leaf.value)])).toEqual(
      expected.map(leaf => [leaf.path, render(leaf.value)])
    )
  })

  it.each([...OPS_LOCALE_IDS])('%s has the full key set with non-empty copy and no raw keys', locale => {
    const english = leaves(catalog('en')).map(leaf => leaf.path)
    const local = leaves(catalog(locale))

    expect(local.map(leaf => leaf.path)).toEqual(english)

    for (const leaf of local) {
      const text = render(leaf.value)
      expect(text.trim(), leaf.path).not.toBe('')
      expect(text, leaf.path).not.toMatch(/\{\d\}|undefined|null|\bops\.[a-z]|opsStates\./)

      if (typeof leaf.value === 'function') {
        expect(text, leaf.path).toContain('X1')
      }
    }
  })

  it.each(OPS_LOCALE_IDS.filter(locale => locale !== 'en'))('%s is translated, not an English fallback', locale => {
    const english = new Map(leaves(catalog('en')).map(leaf => [leaf.path, render(leaf.value)]))
    const allowed = new Set([...BRAND, ...(COGNATES[locale] ?? [])])

    const identical = leaves(catalog(locale))
      .filter(leaf => english.get(leaf.path) === render(leaf.value))
      .map(leaf => leaf.path)

    // B11: inspector field tables hold real cognates (Prompt, Skills, ok...); b11.test.ts guards them.
    expect(identical.filter(path => !allowed.has(path) && !path.startsWith('ops.inspector.fields.'))).toEqual([])
  })

  it('keeps English identical to the strings the shell shipped with', () => {
    expect(en.ops.chrome.working(3)).toBe('3 working')
    expect(en.ops.rail.online(2)).toBe('2 online')
    expect(en.ops.toast.moreNeedsYou(1)).toBe('+1 more → Needs-you')
    expect(en.opsStates.auth.title).toBe('Authentication failed')
  })

  it('resolves store-owned nav ids and presence states to catalog labels', () => {
    const ja = OPS_LOCALES.ja
    expect(opsNavLabel(ja, 'lens:runs', 'Runs')).toBe(ja.nav.runs)
    expect(opsNavLabel(ja, 'office', 'Office')).toBe(ja.nav.office)
    expect(opsNavLabel(ja, 'run:42', 'run 42')).toBe('run 42')
    expect(opsPresenceLabel(ja, 'needs-you')).toBe(ja.presence.needs_you)
    expect(opsPresenceLabel(ja, 'mystery')).toBe('mystery')
  })
})

// Static guard: Ops shell sources render text only through `t.ops` / `t.opsStates`.
const SHELL_SOURCES = [
  'chrome.tsx',
  'document-tabs.tsx',
  'index.tsx',
  'inspector.tsx',
  'node-state.tsx',
  'palette.tsx',
  'rail.tsx',
  'section-state.tsx',
  'shortcut-sheet.tsx',
  'primitives/data-table.tsx',
  'primitives/dock.tsx',
  'primitives/node-card.tsx',
  'primitives/presence-glyph.tsx',
  'primitives/tab-strip.tsx',
  'primitives/toast-queue.tsx',
  'primitives/why-footer.tsx'
]

describe('Ops shell sources', () => {
  it.each(SHELL_SOURCES)('%s has no hard-coded user-facing English', file => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), file), 'utf8')

    const offenders = [
      ...source.matchAll(/(?:aria-label|placeholder|title|heading|label)=["'][A-Za-z][^"']*["']/g),
      ...source.matchAll(/>\s*[A-Z][a-z]+(?: [A-Za-z]+)+[.]?\s*</g)
    ].map(match => match[0])

    expect(offenders).toEqual([])
  })
})
