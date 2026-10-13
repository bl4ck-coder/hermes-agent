import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '@/i18n'
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

import { OpsShell, publishBackgroundDot } from './index'
import {
  type FleetFeed,
  OPS_NAV_STORAGE_KEY,
  arrangeFleet,
  closeTab,
  fleetWindow,
  loadScope,
  narrowFromPane,
  openLens,
  resetOpsNavigationForTests,
  runFooter,
  saveScope,
  setRail
} from './navigation-store'

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
    expect(view.container.querySelector('[data-ops-unavailable]')?.textContent).toContain('not available yet')
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
})

