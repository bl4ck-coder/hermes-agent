import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OpsMotionReadout, OpsMotionScope, OpsStreamText, ThinkingReadout } from './primitives/presence-glyph'
import {
  EASE,
  EASE_DRAWER,
  GLOW_DECAY_MS,
  KEYFRAMES,
  MOTION_MS,
  MOTION_ROW_DESCRIPTION,
  PULSE_PERIOD_MS,
  keyframePlan,
  motionFeatureOn,
  resolveMotion
} from './motion'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'motion.css'), 'utf8')

function installMatchMedia(initial: boolean) {
  let matches = initial
  const listeners = new Set<() => void>()
  const query = {
    addEventListener: (_event: string, cb: () => void) => {
      listeners.add(cb)
    },
    removeEventListener: (_event: string, cb: () => void) => {
      listeners.delete(cb)
    },
    media: '(prefers-reduced-motion: reduce)',
    onchange: null
  }

  Object.defineProperty(query, 'matches', { get: () => matches })

  const matchMedia = vi.fn(() => query)

  vi.stubGlobal('matchMedia', matchMedia)
  window.matchMedia = matchMedia as unknown as typeof window.matchMedia

  return {
    set(next: boolean) {
      matches = next
      for (const listener of listeners) listener()
    }
  }
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('motion tokens', () => {
  it('exposes both eases and only the 140/220/320 duration tokens', () => {
    expect(MOTION_MS).toEqual({ micro: 140, panel: 220, view: 320 })
    expect(EASE).toBe('cubic-bezier(.23, 1, .32, 1)')
    expect(EASE_DRAWER).toBe('cubic-bezier(.32, .72, 0, 1)')
    expect(Object.values(MOTION_MS)).not.toContain(160)
    expect(Object.values(MOTION_MS)).not.toContain(GLOW_DECAY_MS)
    expect(css).toContain('--dur-micro: 140ms')
    expect(css).toContain('--dur-panel: 220ms')
    expect(css).toContain('--dur-view: 320ms')
    expect(css).toMatch(/--ease:\s*cubic-bezier\((?:0)?\.23,\s*1,\s*(?:0)?\.32,\s*1\)/)
    expect(css).toMatch(/--ease-drawer:\s*cubic-bezier\((?:0)?\.32,\s*(?:0)?\.72,\s*0,\s*1\)/)
    expect(css).not.toContain('--dur-glow')
  })

  it('defines rise, land, done, strike, pop, slide, grow, and add', () => {
    expect(KEYFRAMES.map(item => item.name)).toEqual(['rise', 'land', 'done', 'strike', 'pop', 'slide', 'grow', 'add'])

    for (const spec of KEYFRAMES) {
      expect(css).toContain(`@keyframes ops-${spec.name}`)
      expect(css).toContain(`.ops-kf-${spec.name}`)
    }

    expect(css).toContain('translateY(8px)')
    expect(css).toContain('translateY(-6px)')
    expect(css).toContain('scaleX(0)')
    expect(css).toContain('scale(1.08)')
    expect(keyframePlan('land', 'reduced').plays).toBe(false)
    expect(keyframePlan('pop', 'reduced').plays).toBe(false)
    expect(keyframePlan('rise', 'reduced').plays).toBe(true)
    expect(keyframePlan('rise', 'reduced').reduced).toBe('instant-visible')
  })

  it('caps the working pulse at 1Hz', () => {
    expect(PULSE_PERIOD_MS).toBe(1000)
    expect(1000 / PULSE_PERIOD_MS).toBeLessThanOrEqual(1)
    expect(css).toContain('--ops-pulse-period: 1000ms')
    expect(css).toContain('opacity: var(--ops-pulse-min, 0.72)')
  })
})

describe('motion resolution', () => {
  it('lets Full ignore the OS, Reduced force reduce, and System follow the OS', () => {
    expect(resolveMotion('full', true)).toBe('full')
    expect(resolveMotion('reduced', false)).toBe('reduced')
    expect(resolveMotion('system', false)).toBe('full')
    expect(resolveMotion('system', true)).toBe('reduced')
  })

  it('turns pulse, drift, FLIP, land, and pop off in reduced mode without hiding stream text', () => {
    for (const feature of ['pulse', 'drift', 'flip', 'land', 'pop', 'caret'] as const) {
      expect(motionFeatureOn('reduced', feature)).toBe(false)
      expect(motionFeatureOn('full', feature)).toBe(true)
    }

    expect(motionFeatureOn('reduced', 'stream')).toBe(true)
    expect(css).toContain("[data-ops-motion='reduced'] .ops-drift")
    expect(css).toContain("[data-ops-motion='reduced'] .ops-flip")
    expect(css).toContain("[data-ops-motion='reduced'] .ops-kf-land")
    expect(css).toContain("[data-ops-motion='reduced'] .ops-kf-pop")
    expect(css).toContain("[data-ops-motion='reduced'] .ops-presence-pulse")
    expect(css).toContain("[data-ops-motion='reduced'] .ops-stream")
    expect(css).toContain("[data-ops-motion='full'] .ops-drift")
    expect(css).toContain("[data-ops-motion='full'] .ops-flip")
    expect(css).toContain("[data-ops-motion='full'] .ops-stream__caret[data-blink='on']")
    expect(css).toContain("[data-ops-motion='full'] .ops-presence-pulse")
    expect(css).toContain("[data-ops-motion='reduced'] .glyph-spinner__strip")
    expect(css).toContain('animation-name: ops-drift !important')
    expect(css).toContain('animation-name: ops-flip !important')
    expect(css).toContain('animation-name: ops-caret !important')
    expect(css).toContain('animation-play-state: paused !important')
    expect(MOTION_ROW_DESCRIPTION).toBe('States still change and stay readable')
  })

  it('keeps the focus ring a rounded rect on the control, not a glyph circle', () => {
    const focus = css.slice(css.indexOf('.ops-presence:focus-visible'), css.indexOf('.ops-presence__glyph'))

    expect(focus).toContain('border-radius: 2px')
    expect(focus).toContain('outline-offset: 4px')
    expect(focus).not.toContain('50%')
    expect(css).toContain('.ops-presence__glyph:focus')
    expect(css).toContain('outline: none')
  })

  it('follows a live system preference change', () => {
    const media = installMatchMedia(false)
    const view = render(createElement(OpsMotionReadout, { preference: 'system' }))

    expect(view.container.textContent).toBe('full')

    act(() => media.set(true))
    expect(view.container.textContent).toBe('reduced')
    view.unmount()

    installMatchMedia(true)
    const forced = render(createElement(OpsMotionReadout, { preference: 'full' }))
    expect(forced.container.textContent).toBe('full')
  })

  it('pauses the reused spinner when System flips to reduce, and keeps stream text', () => {
    const media = installMatchMedia(false)
    const view = render(
      createElement(OpsMotionScope, {
        preference: 'system',
        children: [
          createElement(ThinkingReadout, { seconds: 66, tokens: null }),
          createElement(OpsStreamText, { text: 'sse delta still readable' })
        ]
      })
    )
    const spinner = () => view.container.querySelector('.glyph-spinner')

    expect(view.container.querySelector('[data-ops-motion]')?.getAttribute('data-ops-motion')).toBe('full')
    expect(spinner()?.getAttribute('data-paused')).toBeNull()
    expect(view.container.textContent).toContain('sse delta still readable')

    act(() => media.set(true))

    expect(view.container.querySelector('[data-ops-motion-preference="system"]')?.getAttribute('data-ops-motion')).toBe(
      'reduced'
    )
    expect(spinner()?.getAttribute('data-paused')).toBe('true')
    expect(view.container.querySelector('.ops-stream__text')?.textContent).toBe('sse delta still readable')
    expect(view.container.querySelector('.ops-stream__caret')?.getAttribute('data-blink')).toBe('off')
  })

  it('keeps reduced-motion streaming text readable and the caret still', () => {
    const view = render(createElement(OpsStreamText, { text: 'sse delta still readable', motion: 'reduced' }))

    expect(view.container.textContent).toContain('sse delta still readable')
    expect(view.container.querySelector('.ops-stream')?.getAttribute('data-readable')).toBe('true')
    expect(view.container.querySelector('.ops-stream__caret')?.getAttribute('data-blink')).toBe('off')
  })
})
