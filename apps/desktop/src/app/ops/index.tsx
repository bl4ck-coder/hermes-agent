/**
 * Ops shell composition. Office, Canvas, and Board are slots, not business
 * implementations. Lens tabs keep the existing Desktop route and do not
 * rebuild that surface. Width rules are the Ops pane, not the window.
 */

import { useEffect, useState, type ReactNode } from 'react'

import { DocumentTabs } from './document-tabs'
import { DockHost, type DockProblem } from './dock-host'
import { Inspector } from './inspector'
import {
  type FleetFeed,
  type FocusedRun,
  type InspectorSlot,
  type NavSnapshot,
  type OpsTab,
  type RailState,
  captureSnapshot,
  closeTab,
  cycleRail,
  goHistory,
  loadScope,
  narrowFromPane,
  noteBackgroundEvent,
  openLens,
  openProfileTab,
  openRunTab,
  openTaskTab,
  selectTab,
  setDock,
  setFilter,
  setInspectorOpen,
  setInspectorSlot,
  setRail,
  subscribeOpsNavigation,
  togglePin
} from './navigation-store'
import { Rail, type RailConnection, type RailProfile } from './rail'

export interface OpsShellProps {
  connectionId: string
  profile: string
  remote: boolean
  connectionLabel?: string
  paneWidth: number
  fleet: FleetFeed
  connections: RailConnection[]
  profiles: RailProfile[]
  focusedRun?: FocusedRun | null
  logLines?: string[] | null
  problems?: DockProblem[]
  events?: ReactNode
  onConnect?: () => void
  onOpenSettings?: () => void
  onOpenPalette?: () => void
  onSelectConnection?: (id: string) => void
  onSelectProfile?: (name: string) => void
  onOpenRoute?: (route: string) => void
}

function panelFor(tab: OpsTab, onOpenRoute?: (route: string) => void) {
  if (tab.kind === 'office' || tab.kind === 'canvas' || tab.kind === 'board') {
    return (
      <p data-ops-unavailable="">
        {tab.label} is not available yet. This shell does not invent fleet, tokens, runs, or approvals.
      </p>
    )
  }

  if (!tab.route) {
    return <p data-ops-unavailable="">No Desktop route for {tab.label}.</p>
  }

  return (
    <button data-ops-open-route={tab.route} onClick={() => onOpenRoute?.(tab.route)} type="button">
      Open existing {tab.route}
    </button>
  )
}

export function OpsShell({
  connectionId,
  connectionLabel,
  connections,
  events,
  fleet,
  focusedRun = null,
  logLines = null,
  onConnect,
  onOpenPalette,
  onOpenRoute,
  onOpenSettings,
  onSelectConnection,
  onSelectProfile,
  paneWidth,
  problems = [],
  profile,
  profiles,
  remote
}: OpsShellProps) {
  const [, setTick] = useState(0)

  useEffect(() => subscribeOpsNavigation(() => setTick(value => value + 1)), [])

  const scope = loadScope(connectionId, profile)
  const narrow = narrowFromPane(paneWidth, scope.rail)
  const revision = JSON.stringify({
    selected: scope.selectedTabId,
    rail: scope.rail,
    inspector: scope.inspectorOpen,
    slot: scope.inspectorSlot,
    dock: scope.dockOpen,
    dockSlot: scope.dockSlot,
    filter: scope.filter,
    tabs: scope.tabs.map(tab => tab.id),
    dots: scope.dots,
    pins: scope.pins
  })

  const leaving = (): NavSnapshot => scope.snapshots[scope.selectedTabId] ?? { scrollTop: 0, focusId: null, selectionId: null, filter: scope.filter }

  return (
    <div
      data-ops-pane-width={String(paneWidth)}
      data-ops-profile={profile}
      data-ops-remote={remote ? 'true' : 'false'}
      data-ops-revision={revision}
      data-ops-root=""
      data-ops-scope={connectionId}
      onKeyDown={event => {
        if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
          return
        }

        const target = event.target

        if (target instanceof HTMLElement && target.closest('input, textarea, select')) {
          return
        }

        event.preventDefault()
        goHistory(connectionId, profile, event.key === 'ArrowLeft' ? -1 : 1)
      }}
      style={{ containerType: 'inline-size', display: 'flex', minWidth: 0, position: 'relative' }}
    >
      <style>{`@container (max-width: 1279px) { [data-ops-root] [data-ops-inspector="docked"] { position: absolute; } }`}</style>
      <div data-ops-toolbar="">
        <button
          aria-keyshortcuts="["
          aria-pressed={narrow.rail !== 'hidden'}
          data-ops-rail-toggle=""
          onClick={() => setRail(connectionId, profile, cycleRail(scope.rail))}
          type="button"
        >
          Rail
        </button>
        <button
          aria-keyshortcuts="]"
          aria-pressed={scope.inspectorOpen}
          data-ops-inspector-toggle=""
          onClick={() => setInspectorOpen(connectionId, profile, !scope.inspectorOpen)}
          type="button"
        >
          Inspector
        </button>
        <button data-ops-dock-toggle="" onClick={() => setDock(connectionId, profile, { dockOpen: !scope.dockOpen })} type="button">
          Dock
        </button>
      </div>
      <Rail
        connectionId={connectionId}
        connectionLabel={connectionLabel || connectionId}
        connections={connections}
        filter={scope.filter}
        fleet={fleet}
        onConnect={() => onConnect?.()}
        onFilter={value => setFilter(connectionId, profile, value)}
        onOpenLens={id => openLens(connectionId, profile, id)}
        onOpenPalette={() => onOpenPalette?.()}
        onOpenSettings={() => onOpenSettings?.()}
        onOpenView={id => selectTab(connectionId, profile, id, leaving())}
        onSelectConnection={id => onSelectConnection?.(id)}
        onSelectProfile={name => onSelectProfile?.(name)}
        onTogglePin={id => togglePin(connectionId, profile, id)}
        pins={scope.pins}
        profile={profile}
        profiles={profiles}
        rail={narrow.rail}
        remote={remote}
      />
      <div data-ops-main="" style={{ flex: 1, minWidth: 0 }}>
        <DocumentTabs
          dots={scope.dots}
          narrow={narrow.tabs}
          onClose={id => closeTab(connectionId, profile, id)}
          onSelect={(id, snapshot) => selectTab(connectionId, profile, id, snapshot)}
          onSnapshot={(id, snapshot) => captureSnapshot(connectionId, profile, id, snapshot)}
          renderPanel={tab => panelFor(tab, onOpenRoute)}
          selectedId={scope.selectedTabId}
          snapshots={scope.snapshots}
          tabs={scope.tabs}
        />
      </div>
      <Inspector
        fleet={fleet}
        focusedRun={focusedRun}
        onSlot={(slot: InspectorSlot) => setInspectorSlot(connectionId, profile, slot)}
        overlay={narrow.inspector === 'overlay'}
        scope={scope}
      />
      <DockHost
        events={events}
        label={connectionLabel}
        logLines={logLines}
        onClose={() => setDock(connectionId, profile, { dockOpen: false })}
        onSlot={dockSlot => setDock(connectionId, profile, { dockSlot })}
        open={scope.dockOpen}
        problems={problems}
        slot={scope.dockSlot}
      />
    </div>
  )
}

export function publishBackgroundDot(
  connectionId: string,
  profile: string,
  tabId: string,
  dot: 'unsaved' | 'unread'
): void {
  noteBackgroundEvent(connectionId, profile, tabId, dot)
}

export function openShellTask(connectionId: string, profile: string, taskId: string, label: string) {
  return openTaskTab(connectionId, profile, taskId, label)
}

export function openShellRun(connectionId: string, profile: string, runId: string) {
  return openRunTab(connectionId, profile, runId)
}

export function openShellProfile(connectionId: string, profile: string, name: string) {
  return openProfileTab(connectionId, profile, name)
}

export function shellRail(connectionId: string, profile: string, rail: RailState) {
  return setRail(connectionId, profile, rail)
}
