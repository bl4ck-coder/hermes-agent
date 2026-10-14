/** P8 B9 live pass: host fleet wiring and the Ops base stylesheet. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { edgePathFromRects, measureNodes } from './canvas/canvas'
import { fleetFeedFrom } from './feed/ops-feed'

const read = (f: string) => readFileSync(join(__dirname, f), 'utf8')

describe('B9 host fleet feed', () => {
  it('is missing until A1 answers, then maps every profile with presence and freshness', () => {
    expect(fleetFeedFrom({ fleet: null })).toEqual({ a1: 'missing', a3: 'missing', rows: [] })

    const f = fleetFeedFrom(
      {
        fleet: {
          now: 100,
          profiles: [
            { profile: 'default', presence: 'working', observed_at: 99, freshness_s: 1 },
            { profile: 'sandhi', presence: 'warp' as never, observed_at: null }
          ]
        }
      },
      100
    )

    expect(f.a1).toBe('ready')
    expect(f.a3).toBe('ready')
    expect(f.rows.map(r => r.id)).toEqual(['default', 'sandhi'])
    expect(f.rows[1]).toMatchObject({ presence: 'unknown', fresh: false })
  })

  it('the production host passes the fleet feed to the shell', () => {
    expect(read('split-host.tsx')).toContain('fleet={fleetFeedFrom(fleetState)}')
  })
})

describe('B9 Ops base stylesheet', () => {
  const css = read('ops-base.css')

  it('is imported by the shell and stays zero-specificity', () => {
    expect(read('index.tsx')).toContain("import './ops-base.css'")

    for (const rule of css.replace(/\/\*[\s\S]*?\*\//g, '').match(/^[^@{}\s][^{}]*\{/gm) ?? []) {
      expect(rule.trim().startsWith(':where('), rule).toBe(true)
    }
  })

  it('never styles [data-ops-tabs], which is also a state attribute on the shell root', () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toContain('[data-ops-tabs]')
  })
})

describe('B9 Canvas edges follow measured node boxes', () => {
  it('joins stacked nodes bottom to top and side-by-side nodes on facing edges', () => {
    expect(edgePathFromRects({ x: 0, y: 0, w: 200, h: 60 }, { x: 0, y: 100, w: 200, h: 80 })).toBe('M 100 60 C 100 80, 100 80, 100 100')
    expect(edgePathFromRects({ x: 0, y: 0, w: 200, h: 60 }, { x: 300, y: 40, w: 200, h: 40 })).toBe('M 200 30 C 250 30, 250 60, 300 60')
    expect(edgePathFromRects({ x: 300, y: 0, w: 200, h: 60 }, { x: 0, y: 0, w: 200, h: 60 })).toBe('M 300 30 C 250 30, 250 30, 200 30')
  })

  it('reports no layout in jsdom so the slot fallback stays', () => {
    const layer = document.createElement('div')
    layer.innerHTML = '<div data-ops-node="identity"></div>'
    expect(measureNodes(layer)).toBeNull()
  })
})

describe('B9 live-pass leaks', () => {
  it('snapshot markers are hidden, the rail count is labelled, Office gets the connection', () => {
    expect(read('document-tabs.tsx')).toMatch(/data-ops-restored-scroll="" hidden/)
    expect(read('rail.tsx')).toContain('copy.chrome.needsYou(arranged.needsYouLabel)')
    expect(read('live-panels.tsx')).toContain('<OfficeContainer connectionLabel={connectionId}')
  })
})