import { cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { hasOpsBridge, opsLivePanel } from './live-panels'
import type { OpsTab } from './navigation-store'
import { listOrNull } from './office/office-container'

afterEach(() => {
  cleanup()
  delete (window as unknown as { hermesDesktop?: unknown }).hermesDesktop
})

const tab = (kind: string) => ({ id: kind, kind, label: kind }) as unknown as OpsTab

describe('ops live panels (P3 wiring)', () => {
  it('keeps the honest placeholder when no Desktop bridge is present', () => {
    expect(hasOpsBridge()).toBe(false)
    expect(opsLivePanel(tab('office'), 'default')).toBeNull()
  })

  it('mounts Office and read-only Canvas (not Board) when the bridge exists', () => {
    ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = { api: () => Promise.resolve(null) }
    expect(hasOpsBridge()).toBe(true)
    expect(opsLivePanel(tab('office'), 'default')).not.toBeNull()
    expect(opsLivePanel(tab('canvas'), 'sandhi')).not.toBeNull()
    expect(opsLivePanel(tab('board'), 'default')).toBeNull()
    expect(opsLivePanel({ ...tab('task'), id: 'task:t1' }, 'default')).not.toBeNull()
    expect(opsLivePanel({ ...tab('run'), id: 'run:42' }, 'default')).not.toBeNull()
    expect(opsLivePanel({ ...tab('profile'), id: 'profile:sandhi' }, 'default')).not.toBeNull()
    expect(opsLivePanel(tab('lens'), 'default')).toBeNull()
  })

  it('treats malformed lists as unknown, never as empty', () => {
    expect(listOrNull(undefined)).toBeNull()
    expect(listOrNull(null)).toBeNull()
    expect(listOrNull('x' as unknown as string[])).toBeNull()
    expect(listOrNull([1])).toEqual([1])
  })
})