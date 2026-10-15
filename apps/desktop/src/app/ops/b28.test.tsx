/** P8 B28: Office dispatch row, orbit legibility, settings rows top-aligned, node editor and dispatch copy localized. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { MAIN_TRANSLATIONS } from './main-i18n-table'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')
const b28 = read('ops-base.css').slice(read('ops-base.css').indexOf('B28: Office dispatch'))

describe('B28', () => {
  it('node editor heading, badge and dispatch status go through T', () => {
    expect(read('canvas/node-editor-view.tsx').match(/T\(LABEL\[node\]\)/g)?.length).toBe(3)
    expect(read('office/office.tsx')).toContain("T('Dispatch failed: {why}')")
    for (const l of Object.keys(MAIN_TRANSLATIONS)) expect(MAIN_TRANSLATIONS[l]['Dispatch failed: {why}']).toContain('{why}')
  })

  it('dispatch input grows and the submit is the primary action', () => {
    expect(b28).toMatch(/\[data-ops-dispatch\] > input\) \{ flex: 1 1 320px/)
    expect(b28).toMatch(/\[data-ops-dispatch\] > button\[type='submit'\]\) \{ background: color-mix/)
  })

  it('settings rows align to the top so a tall control does not float its label', () => {
    expect(b28).toMatch(/\[data-ops-settings-group\] > dl\) \{ align-items: start/)
  })

  it('every B28 rule is zero-specificity', () => {
    for (const line of b28.split('\n').filter(l => l.includes('{') && !l.startsWith('@') && !l.startsWith('/*'))) expect(line.trim().startsWith(':where('), line).toBe(true)
  })
})