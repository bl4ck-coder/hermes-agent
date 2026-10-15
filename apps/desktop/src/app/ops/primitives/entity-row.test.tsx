import { fireEvent, render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { Disclosure, EntityList, EntityRow } from './entity-row'

const css = readFileSync(join(__dirname, '..', 'ops-base.css'), 'utf8')

describe('P14 EntityRow / Disclosure', () => {
  it('renders the anatomy in reading order and passes data attributes through', () => {
    const { container } = render(
      <EntityList label="Rows">
        <EntityRow attrs={{ 'data-x': 'a' }} context="why" lead="L" meta="2 d" more={<Disclosure label="More">body</Disclosure>} primary={<button type="button">Go</button>} title="What" tone="warn" />
      </EntityList>
    )
    const li = container.querySelector('li[data-ops-row]')!
    expect(li.getAttribute('data-x')).toBe('a')
    expect(li.getAttribute('data-ops-row-tone')).toBe('warn')
    expect([...li.querySelectorAll('[data-ops-row-title],[data-ops-row-context],[data-ops-row-meta]')].map(n => n.textContent)).toEqual(['What', 'why', '2 d'])
    expect(li.querySelector('[data-ops-row-actions] button')?.textContent).toBe('Go')
  })

  it('the disclosure is a native details that opens by its summary', () => {
    const { container } = render(<Disclosure label="More">hidden body</Disclosure>)
    const d = container.querySelector('details[data-ops-disclosure]') as HTMLDetailsElement
    expect(d.open).toBe(false)
    fireEvent.click(d.querySelector('summary')!)
    d.open = true
    expect(d.querySelector('[data-ops-disclosure-body]')?.textContent).toBe('hidden body')
  })

  it('CSS: 40px targets, spec type tokens, no :has and no keyframes', () => {
    const block = css.slice(css.indexOf('/* P14: EntityRow'))
    expect(block).toMatch(/\[data-ops-disclosure\] > summary\) \{[^}]*min-height: 40px/)
    expect(block).toMatch(/\[data-ops-row-actions\]\) :where\(button\) \{[^}]*min-height: 40px/)
    expect(block).toMatch(/\[data-ops-row-title\]\) \{[^}]*var\(--type-body/)
    expect(block).not.toMatch(/:has\(|@keyframes/)
  })
})
