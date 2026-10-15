/** P8 B20: Canvas reads like the Outglow agent builder: glyph tiles, localized titles, ports, selection, flowing lit wires. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { NODE_GLYPH, nodeTitle } from './canvas/canvas'
import { setOpsMainLocale } from './main-i18n'

const css = readFileSync(join(__dirname, 'ops-base.css'), 'utf8')
const b20 = css.slice(css.indexOf('B20 Canvas'))

afterEach(() => setOpsMainLocale('en'))

describe('B20', () => {
  it('every node has a glyph and a localized title', () => {
    for (const id of ['schedule', 'identity', 'prompt', 'tools', 'policy', 'skills', 'channels', 'model', 'memory', 'delegation']) expect(NODE_GLYPH[id]).toBeTruthy()
    expect(nodeTitle('memory')).toBe('Memory')
    setOpsMainLocale('es')
    expect(nodeTitle('memory')).toBe('Memoria')
    expect(nodeTitle('tools')).toBe('Herramientas')
  })

  it('selection, ports and lit-wire flow are styled; the flow stops under reduced motion', () => {
    expect(b20).toMatch(/\[data-ops-node\]\[data-ops-selected\]\) \{ border-color/)
    expect(b20).toMatch(/\[data-ops-column='left'\]\)::before/)
    expect(b20).toMatch(/\[data-ops-motion='reduced'\] \[data-ops-edge-layer\] \[data-ops-edge-lit\]\) \{ animation: none/)
  })

  it('every B20 rule is zero-specificity', () => {
    for (const line of b20.split('\n').filter(l => l.includes('{') && !l.startsWith('@') && !l.startsWith('/*'))) expect(line.trim().startsWith(':where('), line).toBe(true)
  })
})