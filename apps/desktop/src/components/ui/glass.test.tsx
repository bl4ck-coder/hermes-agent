import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GlassButton, GlassPanel, GlassPill, Glow } from './glass'

const css = readFileSync(join(__dirname, '../../styles/glass/glass.css'), 'utf8')

describe('glass primitives', () => {
  it('render plain elements tagged for the glass layer', () => {
    render(
      <GlassPanel aria-label="panel" blur elevation="high">
        <GlassPill tone="gold">3 open</GlassPill>
        <GlassButton onClick={() => {}}>Go</GlassButton>
        <Glow />
      </GlassPanel>
    )
    const panel = screen.getByLabelText('panel')
    expect(panel.getAttribute('data-glass')).toBe('panel')
    expect(panel.hasAttribute('data-glass-blur')).toBe(true)
    expect(screen.getByText('3 open').getAttribute('data-glass-tone')).toBe('gold')
    expect(screen.getByRole('button', { name: 'Go' }).getAttribute('type')).toBe('button')
    expect(document.querySelector('[data-glass="glow"]')?.getAttribute('aria-hidden')).toBe('true')
  })
  it('ships reduced-transparency, contrast and motion fallbacks', () => {
    expect(css).toMatch(/prefers-reduced-transparency: reduce/)
    expect(css).toMatch(/prefers-contrast: more/)
    expect(css).toMatch(/prefers-reduced-motion: reduce/)
  })
  it('keeps blur off menus, tooltips, sidebars and the Ops lenses', () => {
    const blurred = css
      .split('}')
      .filter(r => /backdrop-filter:/.test(r))
      .map(r => r.slice(0, r.indexOf('{')))
    for (const sel of blurred)
      expect(sel).not.toMatch(/menu|popover|tooltip|sidebar|select|ops-settings|ops-strip|ops-board/)
  })
})
