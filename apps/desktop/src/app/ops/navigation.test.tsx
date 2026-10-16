import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AGENTS_ROUTE,
  CAPABILITIES_ROUTE,
  COMMAND_CENTER_ROUTE,
  CRON_ROUTE,
  MESSAGING_ROUTE,
  PROFILES_ROUTE,
  STARMAP_ROUTE,
  WEBHOOKS_ROUTE
} from '@/app/routes'
import { I18nProvider } from '@/i18n'

import { setCanvasDirty } from './canvas/dirty-store'
import { DocumentTabs } from './document-tabs'
import { $opsInspectorOpen, $opsOpen, $opsRail, $opsScope, $opsView, $opsViewId, $opsWidthPx } from './layout-store'
import {
  arrangeFleet,
  closeTab,
  type FleetFeed,
  fleetWindow,
  loadScope,
  narrowFromPane,
  openLens,
  OPS_NAV_STORAGE_KEY,
  resetOpsNavigationForTests,
  runFooter,
  saveScope,
  setInspectorOpen,
  setRail
} from './navigation-store'
import { OpsPane } from './split-host'

import { OpsShell, publishBackgroundDot } from './index'

const emptyFleet: FleetFeed = { a1: 'ready', a3: 'ready', rows: [] }

const connections = [
  { id: 'local', label: 'ignacio-local', remote: false },
  { id: 'homelab', label: 'homelab', remote: true }
]

const profiles = [{ name: 'mirror' }, { name: 'judge' }]

function shell(overrides: Partial<Parameters<typeof OpsShell>[0]> = {}) {
  return render(
    <I18nProvider configClient={null}>
      <OpsShell
        connectionId="local"
        connections={connections}
        fleet={emptyFleet}
        paneWidth={1440}
        profile="mirror"
        profiles={profiles}
        remote={false}
        {...overrides}
      />
    </I18nProvider>
  )
}

describe('ops navigation shell', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetOpsNavigationForTests()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('collapses the inspector, rail, and tabs from the pane width, not the window', () => {
    expect(narrowFromPane(1280).inspector).toBe('docked')
    expect(narrowFromPane(1279).inspector).toBe('overlay')
    expect(narrowFromPane(1024).rail).toBe('full')
    expect(narrowFromPane(1023).rail).toBe('icons')
    expect(narrowFromPane(800).tabs).toBe('strip')
    expect(narrowFromPane(799).tabs).toBe('dropdown')
    expect(narrowFromPane(900, 'hidden').rail).toBe('hidden')

    const wide = shell({ paneWidth: 1280 })
    expect(wide.container.querySelector('[data-ops-inspector]')?.getAttribute('data-ops-inspector')).toBe('docked')
    expect(wide.container.querySelector('[data-ops-rail-list]')?.getAttribute('data-ops-rail')).toBe('full')
    expect(wide.container.querySelector('[data-ops-tabs]')?.getAttribute('data-ops-tabs')).toBe('strip')
    wide.unmount()

    const narrow = shell({ paneWidth: 799 })
    expect(narrow.container.querySelector('[data-ops-inspector]')?.getAttribute('data-ops-inspector')).toBe('overlay')
    expect(narrow.container.querySelector('[data-ops-rail-list]')?.getAttribute('data-ops-rail')).toBe('icons')
    expect(narrow.container.querySelector('[data-ops-tab-dropdown]')).not.toBeNull()
    // P24: icon rail items are real glyphs with an accessible name, not a column of initials.
    const office = narrow.container.querySelector('[data-ops-rail-item="office"]')!
    expect(office.querySelector('[data-ops-rail-glyph="office"]')).not.toBeNull()
    expect(office.getAttribute('aria-label')).toBeTruthy()
    expect(office.textContent?.trim()).toBe('')
  })

  it('keeps full, icons, and hidden as a persisted preference and shows the remote badge', () => {
    const view = shell({ remote: true, connectionLabel: 'homelab', connectionId: 'homelab', profile: 'judge' })
    expect(view.container.querySelector('[data-ops-readonly]')?.textContent).toContain('read-only')
    expect(view.getByRole('button', { name: 'Office' })).toBeTruthy()
    expect(view.container.querySelector('[data-kbd="G O"]')?.textContent).toBe('G O')
    expect(view.container.querySelector('[data-ops-settings] kbd')?.textContent).toBe('Ctrl+,')
    expect(view.container.querySelector('[data-ops-connect]')?.textContent).toContain('Connect')
    expect(view.container.querySelector('[data-ops-section="pinned"]')?.textContent).toBe('Pinned')
    expect(view.container.querySelector('[data-ops-more]')?.textContent).toBe('More')

    fireEvent.click(view.getByRole('button', { name: 'Rail' }))
    expect(view.container.querySelector('[data-ops-rail-list]')?.getAttribute('data-ops-rail')).toBe('icons')
    expect(loadScope('homelab', 'judge').rail).toBe('icons')

    fireEvent.click(view.getByRole('button', { name: 'Rail' }))
    expect(view.container.querySelector('[data-ops-rail-list]')).toBeNull()
    expect(loadScope('homelab', 'judge').rail).toBe('hidden')

    fireEvent.click(view.getByRole('button', { name: 'Rail' }))
    expect(loadScope('homelab', 'judge').rail).toBe('full')
    expect(loadScope('local', 'mirror').rail).toBe('full')
  })

  it('filters fleet and lenses and clears without touching the other connection', () => {
    const fleet: FleetFeed = {
      a1: 'ready',
      a3: 'ready',
      rows: [
        { id: 'judge', label: 'judge', presence: 'working', fresh: true },
        { id: 'builder', label: 'builder', presence: 'idle', fresh: true }
      ]
    }

    const view = shell({ fleet })
    fireEvent.change(view.getByLabelText('Filter fleet and lenses'), { target: { value: 'ski' } })
    expect(view.container.querySelector('[data-ops-rail-list] [data-ops-lens="skills"]')).not.toBeNull()
    expect(view.container.querySelector('[data-ops-rail-list] [data-ops-lens="runs"]')).toBeNull()
    expect(view.container.querySelector('[data-ops-rail-list] [data-ops-fleet-row="judge"]')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: 'Clear filter' }))
    expect(view.container.querySelector('[data-ops-lens="runs"]')).not.toBeNull()
    expect(loadScope('local', 'mirror').filter).toBe('')
  })

  it('renders ordered folded fleet from authoritative data and refuses fake totals', () => {
    const rows = [
      { id: 'off', label: 'off', presence: 'offline' as const, fresh: true },
      { id: 'work', label: 'work', presence: 'working' as const, fresh: true },
      { id: 'need', label: 'need', presence: 'needs_you' as const, fresh: true },
      { id: 'block', label: 'block', presence: 'blocked' as const, fresh: true },
      ...Array.from({ length: 28 }, (_, index) => ({
        id: `idle-${index}`,
        label: `idle-${index}`,
        presence: 'idle' as const,
        fresh: true
      }))
    ]

    const virtualRows = [
      ...rows,
      ...Array.from({ length: 40 }, (_, index) => ({
        id: `extra-${index}`,
        label: `extra-${index}`,
        presence: 'working' as const,
        fresh: true
      }))
    ]

    const missing = arrangeFleet({ a1: 'missing', a3: 'missing', rows: virtualRows })
    expect(missing.onlineLabel).toBe('unavailable')
    expect(missing.needsYouLabel).toBe('unavailable')
    expect(missing.onlineLabel).not.toBe('0')
    expect(missing.needsYouLabel).not.toBe(String(rows.filter(row => row.presence === 'needs_you').length))

    const ready = arrangeFleet({ a1: 'ready', a3: 'ready', rows: virtualRows })
    expect(ready.groups.map(group => group.id)).toEqual(['needs_you', 'working', 'blocked', 'idle', 'offline'])
    expect(ready.onlineLabel).toBe(String(virtualRows.filter(row => row.fresh && row.presence !== 'offline').length))

    const folded = shell({ fleet: { a1: 'missing', a3: 'missing', rows } })
    expect(folded.container.querySelector('[data-ops-rail-list] [data-ops-online]')?.getAttribute('data-ops-online')).toBe('unavailable')
    expect(folded.container.querySelector('[data-ops-rail-list] [data-ops-needs-you]')?.getAttribute('data-ops-needs-you')).toBe('unavailable')
    expect(folded.container.querySelector('[data-ops-rail-list] [data-ops-fleet-folded="28"]')?.textContent).toContain('28 idle')
    expect(folded.container.querySelectorAll('[data-ops-rail-list] [data-ops-fleet-row^="idle-"]')).toHaveLength(0)

    const groups = [...folded.container.querySelectorAll('[data-ops-rail-list] [data-ops-fleet-group]')].map(node =>
      node.getAttribute('data-ops-fleet-group')
    )

    expect(groups.indexOf('needs-you')).toBeLessThan(groups.indexOf('working'))
    expect(groups.indexOf('working')).toBeLessThan(groups.indexOf('blocked'))
    expect(groups.indexOf('blocked')).toBeLessThan(groups.indexOf('idle'))
    folded.unmount()

    const virtual = shell({ fleet: { a1: 'ready', a3: 'ready', rows: virtualRows } })
    const rendered = Number(virtual.container.querySelector('[data-ops-rail-list] [data-ops-fleet-window]')?.getAttribute('data-rendered'))
    const total = Number(virtual.container.querySelector('[data-ops-rail-list] [data-ops-fleet-window]')?.getAttribute('data-total'))
    expect(virtual.container.querySelector('[data-virtualized="true"]')).not.toBeNull()
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(total)
    expect(fleetWindow(virtualRows, 0).slice.length).toBeLessThan(virtualRows.length)
  })

  it('keeps pins, dots, selection, and chrome per connection and follows rename and delete', async () => {
    setRail('local', 'webdesign_bhp', 'icons')
    setRail('remote-1', 'webdesign_bhp', 'hidden')
    saveScope('local', 'webdesign_bhp', {
      ...loadScope('local', 'webdesign_bhp'),
      selectedTabId: 'canvas',
      dots: { board: 'unread' },
      pins: ['lens:skills'],
      dockOpen: true,
      inspectorOpen: false
    })

    const { migrateTilesForProfile, dropTilesForProfile } = await import('@/store/session-states')
    migrateTilesForProfile('webdesign_bhp', 'hutnik-projectmanager')

    expect(loadScope('local', 'webdesign_bhp').pins).toEqual([])
    expect(loadScope('local', 'hutnik-projectmanager').rail).toBe('icons')
    expect(loadScope('local', 'hutnik-projectmanager').selectedTabId).toBe('canvas')
    expect(loadScope('local', 'hutnik-projectmanager').dots.board).toBe('unread')
    expect(loadScope('local', 'hutnik-projectmanager').pins).toEqual(['lens:skills'])
    expect(loadScope('local', 'hutnik-projectmanager').dockOpen).toBe(true)
    expect(loadScope('local', 'hutnik-projectmanager').inspectorOpen).toBe(false)
    expect(loadScope('remote-1', 'webdesign_bhp').rail).toBe('hidden')

    dropTilesForProfile('hutnik-projectmanager')
    expect(loadScope('local', 'hutnik-projectmanager').selectedTabId).toBe('office')
    expect(loadScope('remote-1', 'webdesign_bhp').rail).toBe('hidden')
    expect(window.localStorage.getItem(OPS_NAV_STORAGE_KEY)).toContain('remote-1')
  })

  it('refuses to close pinned Office, Canvas, and Board and overflows closable real routes', () => {
    const view = shell()
    expect(view.container.querySelector('[data-ops-tab="office"]')?.getAttribute('data-pinned')).toBe('true')
    expect(view.container.querySelector('[data-ops-tab-close="office"]')).toBeNull()
    expect(view.container.querySelector('[data-ops-tab-close="canvas"]')).toBeNull()
    expect(view.container.querySelector('[data-ops-tab-close="board"]')).toBeNull()
    closeTab('local', 'mirror', 'office')
    expect(loadScope('local', 'mirror').tabs.some(tab => tab.id === 'office')).toBe(true)

    act(() => {
      for (const id of ['skills', 'channels', 'triggers', 'schedule', 'memory', 'profiles', 'agents', 'activity']) {
        openLens('local', 'mirror', id)
      }
    })

    const skills = loadScope('local', 'mirror').tabs.find(tab => tab.id === 'lens:skills')
    expect(skills?.route).toBe(CAPABILITIES_ROUTE)
    expect(loadScope('local', 'mirror').tabs.find(tab => tab.id === 'lens:channels')?.route).toBe(MESSAGING_ROUTE)
    expect(loadScope('local', 'mirror').tabs.find(tab => tab.id === 'lens:triggers')?.route).toBe(WEBHOOKS_ROUTE)
    expect(loadScope('local', 'mirror').tabs.find(tab => tab.id === 'lens:schedule')?.route).toBe(CRON_ROUTE)
    expect(loadScope('local', 'mirror').tabs.find(tab => tab.id === 'lens:memory')?.route).toBe(STARMAP_ROUTE)
    expect(loadScope('local', 'mirror').tabs.find(tab => tab.id === 'lens:profiles')?.route).toBe(PROFILES_ROUTE)
    expect(loadScope('local', 'mirror').tabs.find(tab => tab.id === 'lens:agents')?.route).toBe(AGENTS_ROUTE)
    expect(loadScope('local', 'mirror').tabs.find(tab => tab.id === 'lens:activity')?.route).toBe(COMMAND_CENTER_ROUTE)
    expect(loadScope('local', 'mirror').tabs.find(tab => tab.id === 'lens:runs')?.route ?? '/command-center').toBe(COMMAND_CENTER_ROUTE)
    expect(view.container.querySelector('[data-ops-tab-overflow]')).not.toBeNull()

    const closable = view.container.querySelector('[data-ops-tab-close="lens:skills"]')
    expect(closable).not.toBeNull()
    fireEvent.click(closable!)
    expect(loadScope('local', 'mirror').tabs.some(tab => tab.id === 'lens:skills')).toBe(false)
    expect(view.container.querySelector('[data-ops-open-route]')?.getAttribute('data-ops-open-route')).toBeTruthy()
  })

  it('restores tab navigation state and ignores background focus and scroll resets', () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus')
    const view = shell()
    const office = view.container.querySelector('[data-ops-panel="office"]') as HTMLDivElement
    office.scrollTop = 80
    fireEvent.scroll(office)
    expect(loadScope('local', 'mirror').snapshots.office.scrollTop).toBe(80)

    fireEvent.click(view.getByRole('tab', { name: 'Canvas' }))
    fireEvent.click(view.getByRole('tab', { name: 'Office' }))
    expect(view.container.querySelector('[data-ops-panel="office"]')?.getAttribute('data-scroll')).toBe('80')
    expect((view.container.querySelector('[data-ops-panel="office"]') as HTMLDivElement).scrollTop).toBe(80)

    const before = (view.container.querySelector('[data-ops-panel="office"]') as HTMLDivElement).scrollTop
    act(() => {
      publishBackgroundDot('local', 'mirror', 'canvas', 'unread')
    })
    expect(loadScope('local', 'mirror').selectedTabId).toBe('office')
    expect(loadScope('local', 'mirror').dots.canvas).toBe('unread')
    expect((view.container.querySelector('[data-ops-panel="office"]') as HTMLDivElement).scrollTop).toBe(before)
    expect(focus).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-ops-tab="canvas"] [data-ops-dot="unread"]')).not.toBeNull()
  })

  it('O47: an unsaved Canvas draft puts the gold dot on the Canvas tab and clears with the draft', () => {
    const view = shell()
    act(() => setCanvasDirty('mirror', 'model', true))
    expect(view.container.querySelector('[data-ops-tab="canvas"] [data-ops-dot="unsaved"]')).not.toBeNull()
    act(() => setCanvasDirty('mirror', 'model', false))
    expect(view.container.querySelector('[data-ops-tab="canvas"] [data-ops-dot="unsaved"]')).toBeNull()
  })

  it('switches inspector slots, hides the run footer, and keeps unknown tokens unknown', () => {
    expect(runFooter(null)).toBeNull()
    expect(runFooter({ id: '1866', elapsed: null, tokens: null })?.tokens).toBe('unknown')
    expect(runFooter({ id: '1866', elapsed: null, tokens: null })?.tokens).not.toBe('0')

    const hidden = shell()
    expect(hidden.container.querySelector('[data-ops-run-footer]')).toBeNull()
    hidden.unmount()

    const shown = shell({ focusedRun: { id: '1866', elapsed: null, tokens: null } })
    expect(shown.container.querySelector('[data-ops-run-id]')?.textContent).toBe('1866')
    expect(shown.container.querySelector('[data-ops-tokens]')?.textContent).toBe('unknown')
    fireEvent.click(shown.getByRole('tab', { name: 'Context' }))
    expect(shown.container.querySelector('[data-ops-inspector-slot]')?.getAttribute('data-ops-inspector-slot')).toBe('context')

    saveScope('local', 'mirror', { ...loadScope('local', 'mirror'), selectedTabId: 'canvas', inspectorSlot: 'fleet' })
    shown.rerender(
      <I18nProvider configClient={null}>
        <OpsShell
          connectionId="local"
          connections={connections}
          fleet={emptyFleet}
          focusedRun={{ id: '1866', elapsed: '2m', tokens: null }}
          paneWidth={1440}
          profile="mirror"
          profiles={profiles}
          remote={false}
        />
      </I18nProvider>
    )
    expect(shown.container.querySelector('[data-ops-inspector-slot]')?.getAttribute('data-ops-inspector-slot')).toBe('unknown')
    expect(shown.container.querySelector('[data-ops-unknown-slot]')?.textContent).toBe('unknown')
  })

  it('keeps the inspector toggle hittable, compacts the rail, and anchors the dock to the bottom', () => {
    const view = shell({ paneWidth: 640 })
    const root = view.container.querySelector('[data-ops-root]') as HTMLElement
    const rail = view.container.querySelector('[data-ops-rail-list]') as HTMLElement
    const toggle = view.container.querySelector('[data-ops-inspector-toggle]') as HTMLElement

    expect(root.getAttribute('data-ops-inspector')).toBe('overlay')
    expect(rail.getAttribute('data-ops-rail')).toBe('icons')
    expect(rail.style.width).toBe('72px')
    expect(rail.style.maxWidth).toBe('72px')
    expect(view.container.querySelector('[data-ops-view-slot] [data-ops-inspector="overlay"]')).not.toBeNull()
    expect(view.container.querySelector('[data-ops-toolbar] [data-ops-inspector="overlay"]')).toBeNull()
    expect(view.container.querySelector('[data-ops-rail-list] [data-ops-inspector="overlay"]')).toBeNull()
    const aside = view.container.querySelector('[data-ops-view-slot] aside') as HTMLElement
    expect(toggle.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(view.getByRole('button', { name: 'Dock' }))
    const dock = view.container.querySelector('[data-ops-dock]') as HTMLElement
    expect(dock.getAttribute('data-ops-dock-anchor')).toBe('bottom')
    expect(dock.style.width).toBe('100%')
    expect(root.compareDocumentPosition(dock) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(view.container.querySelector('[data-ops-body] [data-ops-dock]')).toBeNull()
  })

  it('toggles the rail from [ without stealing a composer or filter key', () => {
    const view = shell()
    const toggle = view.getByRole('button', { name: 'Rail' })

    fireEvent.keyDown(toggle, { key: '[' })
    expect(loadScope('local', 'mirror').rail).toBe('icons')

    fireEvent.change(view.getByLabelText('Filter fleet and lenses'), { target: { value: 'runs' } })
    fireEvent.keyDown(view.getByLabelText('Filter fleet and lenses'), { key: '[' })
    expect(loadScope('local', 'mirror').rail).toBe('icons')
    expect(loadScope('local', 'mirror').filter).toBe('runs')

    const composer = document.createElement('textarea')
    composer.setAttribute('data-composer', '')
    document.body.append(composer)
    composer.focus()
    fireEvent.keyDown(composer, { key: '[' })
    expect(loadScope('local', 'mirror').rail).toBe('icons')
    expect(document.activeElement).toBe(composer)
    composer.remove()
  })

  it('navigates from a pin and unpins only from the explicit control', () => {
    const view = shell()

    fireEvent.click(view.container.querySelector('[data-ops-pin-toggle="lens:runs"]')!)
    expect(loadScope('local', 'mirror').pins).toEqual(['lens:runs'])
    expect(loadScope('local', 'mirror').selectedTabId).not.toBe('lens:runs')

    fireEvent.click(view.container.querySelector('[data-ops-pin="lens:runs"]')!)
    expect(loadScope('local', 'mirror').selectedTabId).toBe('lens:runs')
    expect(loadScope('local', 'mirror').pins).toEqual(['lens:runs'])

    fireEvent.click(view.container.querySelector('[data-ops-unpin="lens:runs"]')!)
    expect(loadScope('local', 'mirror').pins).toEqual([])
    expect(loadScope('local', 'mirror').selectedTabId).toBe('lens:runs')
  })

  it('shows Needs-you unavailable when A1 or A3 is missing and a real count when both are ready', () => {
    const missing = shell({ fleet: { a1: 'missing', a3: 'missing', rows: [{ id: 'need', label: 'need', presence: 'needs_you', fresh: true }] } })
    expect(missing.container.querySelector('[data-ops-g85]')?.getAttribute('data-ops-needs-you-state')).toBe('unavailable')
    expect(missing.container.querySelector('[data-ops-g85-count]')?.textContent).toBe('unavailable')
    missing.unmount()

    const ready = shell({ fleet: { a1: 'ready', a3: 'ready', rows: [{ id: 'need', label: 'need', presence: 'needs_you', fresh: true }] } })
    expect(ready.container.querySelector('[data-ops-g85-count]')?.textContent).toBe('1')
    expect(ready.container.querySelector('[data-ops-g85-count]')?.textContent).not.toBe('0')
  })

  it('rewrites every profile-keyed reference and restores scroll and filter after rename', async () => {
    saveScope('local', 'rename-before', {
      ...loadScope('local', 'rename-before'),
      selectedTabId: 'profile:rename-before',
      rail: 'icons',
      inspectorOpen: false,
      dockOpen: true,
      filter: 'abc',
      pins: ['profile:rename-before', 'lens:skills'],
      tabs: [
        ...loadScope('local', 'rename-before').tabs,
        {
          id: 'profile:rename-before',
          kind: 'profile',
          label: 'rename-before',
          route: '/profiles?profile=rename-before',
          pinned: false,
          closable: true
        }
      ],
      history: [{ tabId: 'profile:rename-before', snapshot: { scrollTop: 88, focusId: 'row-1', selectionId: 'sel-1', filter: 'abc' } }],
      historyIndex: 0,
      dots: { 'profile:rename-before': 'unread' },
      lastSeen: { 'profile:rename-before': 9 },
      snapshots: {
        ...loadScope('local', 'rename-before').snapshots,
        'profile:rename-before': { scrollTop: 88, focusId: 'row-1', selectionId: 'sel-1', filter: 'abc' }
      }
    })
    saveScope('remote-1', 'rename-before', {
      ...loadScope('remote-1', 'rename-before'),
      pins: ['profile:rename-before']
    })

    const { migrateTilesForProfile } = await import('@/store/session-states')
    migrateTilesForProfile('rename-before', 'rename-after')

    const moved = loadScope('local', 'rename-after')
    const dumped = JSON.stringify(moved)

    expect(dumped).not.toContain('profile:rename-before')
    expect(dumped).not.toContain('rename-before')
    expect(moved.selectedTabId).toBe('profile:rename-after')
    expect(moved.snapshots['profile:rename-after']?.scrollTop).toBe(88)
    expect(moved.snapshots['profile:rename-after']?.filter).toBe('abc')
    expect(moved.filter).toBe('abc')
    expect(moved.dots['profile:rename-after']).toBe('unread')
    expect(moved.lastSeen['profile:rename-after']).toBe(9)
    expect(moved.history.map(entry => entry.tabId)).toContain('profile:rename-after')
    expect(moved.pins).toContain('profile:rename-after')
    expect(moved.rail).toBe('icons')
    expect(moved.dockOpen).toBe(true)
    expect(moved.inspectorOpen).toBe(false)
    expect(loadScope('remote-1', 'rename-before').pins).toEqual(['profile:rename-before'])
    expect(loadScope('local', 'rename-before').pins).toEqual([])
  })
})

describe('ops host scope r3', () => {
  const local = { connectionId: 'local', profile: 'mirror', remote: false, label: 'local' }
  const remote = { connectionId: 'remote-1', profile: 'judge', remote: true, label: 'bench' }

  beforeEach(() => {
    window.localStorage.clear()
    window.location.hash = ''
    resetOpsNavigationForTests()
    $opsScope.set(local)
    $opsView.set('office')
    $opsViewId.set(null)
    $opsWidthPx.set(1440)
    $opsOpen.set(true)
    $opsRail.set('full')
    $opsInspectorOpen.set(true)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('draws scoped rail and inspector, not the host atoms, and rehydrates on scope switch', () => {
    setRail('local', 'mirror', 'hidden')
    setInspectorOpen('local', 'mirror', false)
    setRail('remote-1', 'judge', 'icons')
    setInspectorOpen('remote-1', 'judge', true)
    $opsRail.set('full')
    $opsInspectorOpen.set(true)

    const view = render(<OpsPane />)
    const root = view.container.querySelector('[data-ops-root]')

    expect(root?.getAttribute('data-ops-rail')).toBe('hidden')
    expect(root?.getAttribute('data-ops-inspector-open')).toBe('false')
    expect(loadScope('local', 'mirror').rail).toBe('hidden')

    fireEvent.click(view.getByRole('button', { name: 'Rail' }))
    expect(loadScope('local', 'mirror').rail).toBe('full')
    expect(view.container.querySelector('[data-ops-root]')?.getAttribute('data-ops-rail')).toBe('full')
    expect($opsRail.get()).toBe('full')

    fireEvent.click(view.getByRole('button', { name: 'Inspector' }))
    expect(loadScope('local', 'mirror').inspectorOpen).toBe(true)
    expect(view.container.querySelector('[data-ops-root]')?.getAttribute('data-ops-inspector-open')).toBe('true')

    act(() => {
      $opsScope.set(remote)
    })

    expect(view.container.querySelector('[data-ops-root]')?.getAttribute('data-ops-rail')).toBe('icons')
    expect(view.container.querySelector('[data-ops-root]')?.getAttribute('data-ops-inspector-open')).toBe('true')
    expect(loadScope('remote-1', 'judge').rail).toBe('icons')
    expect(loadScope('local', 'mirror').rail).toBe('full')
  })

  it('renders the Canvas panel and breadcrumb when the host view is canvas', () => {
    $opsView.set('canvas')

    const view = render(<OpsPane />)
    const canvas = view.container.querySelector('[data-ops-panel="canvas"]')
    const office = view.container.querySelector('[data-ops-panel="office"]')

    expect(view.container.querySelector('[data-ops-view-name]')?.textContent).toBe('Canvas')
    expect(view.container.querySelector('[data-ops-active-panel]')?.getAttribute('data-ops-active-panel')).toBe('canvas')
    expect(canvas?.hasAttribute('hidden')).toBe(false)
    expect(office?.hasAttribute('hidden')).toBe(true)
    expect(loadScope('local', 'mirror').selectedTabId).toBe('canvas')
  })

  it('fires switcher, connect, settings, palette, and route handlers from the hosted rail', async () => {
    const connections = await import('@/store/connections')
    const profiles = await import('@/store/profile')
    const palette = await import('@/store/command-palette')
    const registry = await import('@/store/connection-registry-state')
    const selectConnection = vi.spyOn(connections, 'selectConnection').mockResolvedValue(undefined)
    const selectProfile = vi.spyOn(profiles, 'selectProfile').mockImplementation(() => undefined)
    const openPalette = vi.spyOn(palette, 'openCommandPalettePage').mockImplementation(() => undefined)

    registry.$connectionsRegistry.set({
      version: 1,
      primary: 'local',
      secureTokenStorage: false,
      connections: [
        { id: 'local', kind: 'local', label: 'local', tokenSet: false, tokenPreview: null },
        { id: 'homelab', kind: 'remote', label: 'homelab', tokenSet: false, tokenPreview: null }
      ]
    })
    profiles.$profiles.set([
      { name: 'mirror', display_name: 'mirror' },
      { name: 'judge', display_name: 'judge' }
    ] as never)

    const view = render(<OpsPane />)

    fireEvent.change(view.getByLabelText('Connection'), { target: { value: 'homelab' } })
    fireEvent.change(view.getByLabelText('Profile'), { target: { value: 'judge' } })
    fireEvent.click(view.container.querySelector('[data-ops-palette]')!)
    fireEvent.click(view.container.querySelector('[data-ops-settings]')!)
    expect(window.location.hash).toBe('#/settings')
    fireEvent.click(view.container.querySelector('[data-ops-connect]')!)
    expect(window.location.hash).toBe('#/settings?tab=gateway')

    await waitFor(() => {
      expect(selectConnection).toHaveBeenCalledWith('homelab')
      expect(selectProfile).toHaveBeenCalledWith('judge')
      expect(openPalette).toHaveBeenCalledWith('ops')
    })

    fireEvent.click(view.getByRole('button', { name: 'Runs' }))
    fireEvent.click(view.container.querySelector('[data-ops-open-route]')!)
    expect(window.location.hash).toBe('#/command-center')
  })

  it('keeps an edited draft on the same node across a tab switch', () => {
    function Harness() {
      const [selected, setSelected] = useState('office')
      const tabs = loadScope('local', 'mirror').tabs

      return (
        <DocumentTabs
          dots={{}}
          narrow="strip"
          onClose={() => undefined}
          onSelect={id => setSelected(id)}
          onSnapshot={() => undefined}
          onTogglePin={() => undefined}
          pins={[]}
          renderPanel={tab => <input data-ops-draft={tab.id} defaultValue="seed" />}
          selectedId={selected}
          snapshots={{}}
          tabs={tabs}
        />
      )
    }

    const view = render(<Harness />)
    const input = view.container.querySelector('[data-ops-draft="office"]') as HTMLInputElement

    input.value = 'edited'
    fireEvent.click(view.getByRole('tab', { name: 'Canvas' }))

    const parked = view.container.querySelector('[data-ops-draft="office"]') as HTMLInputElement

    expect(parked).toBe(input)
    expect(parked.isConnected).toBe(true)
    expect(parked.value).toBe('edited')
    expect(view.container.querySelector('[data-ops-panel="office"]')?.hasAttribute('hidden')).toBe(true)

    fireEvent.click(view.getByRole('tab', { name: 'Office' }))
    expect(view.container.querySelector('[data-ops-draft="office"]')).toBe(input)
    expect(input.value).toBe('edited')
  })

  it('does not mount wide switcher or filter controls inside the icons rail', () => {
    const view = shell({ paneWidth: 640 })
    const rail = view.container.querySelector('[data-ops-rail-list]')

    expect(rail?.getAttribute('data-ops-rail')).toBe('icons')
    expect(rail?.querySelector('select')).toBeNull()
    expect(rail?.querySelector('[data-ops-switcher-toggle]')).not.toBeNull()
    expect(rail?.querySelector('[data-ops-filter-toggle]')).not.toBeNull()
    const filter = rail?.querySelector('[data-ops-filter]') as HTMLInputElement | null

    expect(filter?.style.width).toBe('1px')
    expect(filter?.style.height).toBe('1px')

    fireEvent.click(rail!.querySelector('[data-ops-filter-toggle]')!)
    expect(rail?.querySelector('select')).toBeNull()
    expect(document.querySelector('[data-ops-filter-overlay] input')).not.toBeNull()
  })

  it('pins Connect and Settings in a compact-rail footer and scrolls the fleet list', () => {
    const view = shell({ paneWidth: 640 })
    const rail = view.container.querySelector('[data-ops-rail-list]')
    const scroll = rail?.querySelector('[data-ops-rail-scroll]')
    const footer = rail?.querySelector('[data-ops-rail-footer]')

    expect(rail?.getAttribute('data-ops-rail')).toBe('icons')
    expect(scroll?.getAttribute('data-ops-rail-scroll')).toBe('true')
    expect((scroll as HTMLElement | null)?.style.overflowY).toBe('auto')
    expect(scroll?.querySelector('[data-ops-fleet]')).not.toBeNull()
    expect(scroll?.querySelector('[data-ops-connect]')).toBeNull()
    expect(scroll?.querySelector('[data-ops-settings]')).toBeNull()
    expect(footer?.querySelector('[data-ops-connect]')).not.toBeNull()
    expect(footer?.querySelector('[data-ops-settings]')).not.toBeNull()
    expect((rail as HTMLElement | null)?.style.overflow).not.toBe('hidden')
    expect(scroll?.querySelector('[data-ops-fleet-window]')?.getAttribute('style')).toContain('overflow: auto')
  })

  it('keeps host, panel, crumb, and copy-link on the tab that remains after closing Runs', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    act(() => {
      openLens('local', 'mirror', 'runs')
      $opsView.set('runs')
      $opsViewId.set('stale-run')
    })

    const view = render(<OpsPane />)
    const close = view.container.querySelector('[data-ops-tab-close="lens:runs"]')

    expect(close).not.toBeNull()
    fireEvent.click(close!)

    const scope = loadScope('local', 'mirror')

    expect(scope.selectedTabId).toBe('office')
    expect(scope.history[scope.historyIndex]?.tabId).toBe('office')
    expect($opsView.get()).toBe('office')
    expect($opsViewId.get()).toBeNull()
    expect(view.container.querySelector('[data-ops-view-name]')?.textContent).toBe('Office')
    expect(view.container.querySelector('[data-ops-view-id]')).toBeNull()
    expect(view.container.querySelector('[data-ops-active-panel]')?.getAttribute('data-ops-active-panel')).toBe('office')
    expect(view.container.querySelector('[data-ops-panel="office"]')?.hasAttribute('hidden')).toBe(false)
    expect(view.container.querySelector('[data-ops-panel="lens:runs"]')).toBeNull()

    fireEvent.click(view.container.querySelector('[data-ops-copy-link]')!)
    expect(writeText).toHaveBeenCalledWith('/ops/office')
  })

  it('recomputes host identity when back/forward moves the selected tab', () => {
    act(() => {
      openLens('local', 'mirror', 'runs')
      $opsView.set('runs')
      $opsViewId.set(null)
    })

    const view = render(<OpsPane />)
    const root = view.container.querySelector('[data-ops-root]') as HTMLElement

    fireEvent.keyDown(root, { key: 'ArrowLeft', code: 'ArrowLeft', altKey: true })

    const scope = loadScope('local', 'mirror')

    expect(scope.selectedTabId).toBe('office')
    expect(scope.history[scope.historyIndex]?.tabId).toBe('office')
    expect($opsView.get()).toBe('office')
    expect($opsViewId.get()).toBeNull()
    expect(view.container.querySelector('[data-ops-active-panel]')?.getAttribute('data-ops-active-panel')).toBe('office')
    expect(view.container.querySelector('[data-ops-view-name]')?.textContent).toBe('Office')
  })
})

