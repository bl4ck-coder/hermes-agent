/**
 * Ops shell composition. Office, Canvas, and Board are slots, not business
 * implementations. The split host (P0.5-04) owns the pane; this shell fills it
 * with the rail, document tabs, inspector, and bottom dock. Width rules are
 * the Ops pane, not the window.
 */

import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'

import { DocumentTabs } from './document-tabs'
import { DockHost, type DockProblem } from './dock-host'
import { Inspector } from './inspector'
import { OPS_GUTTER_PX, type OpsNarrow, type OpsRailPreference, type OpsScope } from './layout-store'
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
  openPin,
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

export const OPS_PINNED_VIEWS = ['office', 'canvas', 'board'] as const

export function opsViewLabel(view: string): string {
  if (!view) {
    return 'Office'
  }

  return view.slice(0, 1).toUpperCase() + view.slice(1)
}

export interface OpsShellProps {
  paneWidth: number
  /** P0.5-04 host contract. Optional so tests can mount the shell directly. */
  scope?: OpsScope
  view?: string
  viewId?: string | null
  narrow?: OpsNarrow
  railPreference?: OpsRailPreference
  fullscreen?: boolean
  inspectorOpen?: boolean
  onToggleFullscreen?: () => void
  onRail?: (rail: OpsRailPreference) => void
  onInspector?: (open: boolean) => void
  onView?: (view: string) => void
  onCopyLink?: () => void
  onOpenChat?: () => void
  onBackToChats?: () => void
  connectionId?: string
  profile?: string
  remote?: boolean
  connectionLabel?: string
  fleet?: FleetFeed
  connections?: RailConnection[]
  profiles?: RailProfile[]
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

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest('input, textarea, select, [contenteditable="true"], [data-composer]'))
  )
}

export function OpsShell({
  connectionId: connectionIdProp,
  connectionLabel: connectionLabelProp,
  connections: connectionsProp,
  events,
  fleet: fleetProp,
  focusedRun = null,
  fullscreen = false,
  inspectorOpen: inspectorOpenProp,
  logLines = null,
  narrow: narrowProp,
  onBackToChats,
  onConnect,
  onCopyLink,
  onInspector,
  onOpenChat,
  onOpenPalette,
  onOpenRoute,
  onOpenSettings,
  onRail,
  onSelectConnection,
  onSelectProfile,
  onToggleFullscreen,
  onView,
  paneWidth,
  problems = [],
  profile: profileProp,
  profiles: profilesProp,
  railPreference,
  remote: remoteProp,
  scope: hostScope,
  view = 'office',
  viewId = null
}: OpsShellProps) {
  const [, setTick] = useState(0)

  useEffect(() => subscribeOpsNavigation(() => setTick(value => value + 1)), [])

  const connectionId = hostScope?.connectionId ?? connectionIdProp ?? 'local'
  const profile = hostScope?.profile ?? profileProp ?? 'default'
  const remote = hostScope?.remote ?? remoteProp ?? false
  const connectionLabel = hostScope?.label || connectionLabelProp || connectionId
  const fleet = fleetProp ?? { a1: 'missing' as const, a3: 'missing' as const, rows: [] }
  const connections = connectionsProp ?? [{ id: connectionId, label: connectionLabel, remote }]
  const profiles = profilesProp ?? [{ name: profile }]
  const nav = loadScope(connectionId, profile)
  const storedRail = railPreference ?? nav.rail
  const narrow = narrowProp ?? narrowFromPane(paneWidth, storedRail)
  const inspectorIsOpen = inspectorOpenProp ?? nav.inspectorOpen
  const overlay = narrow.inspector === 'overlay'
  const revision = JSON.stringify({
    selected: nav.selectedTabId,
    rail: nav.rail,
    inspector: inspectorIsOpen,
    slot: nav.inspectorSlot,
    dock: nav.dockOpen,
    dockSlot: nav.dockSlot,
    filter: nav.filter,
    tabs: nav.tabs.map(tab => tab.id),
    dots: nav.dots,
    pins: nav.pins
  })

  const leaving = (): NavSnapshot =>
    nav.snapshots[nav.selectedTabId] ?? { scrollTop: 0, focusId: null, selectionId: null, filter: nav.filter }

  const cycleStoredRail = () => {
    const next = cycleRail(storedRail)

    setRail(connectionId, profile, next)
    onRail?.(next)
  }

  const toggleInspector = () => {
    const next = !inspectorIsOpen

    setInspectorOpen(connectionId, profile, next)
    onInspector?.(next)
  }

  const onShellKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isTypingTarget(event.target)) {
      return
    }

    if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      event.preventDefault()
      goHistory(connectionId, profile, event.key === 'ArrowLeft' ? -1 : 1)

      return
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return
    }

    if (event.key === '[') {
      event.preventDefault()
      cycleStoredRail()

      return
    }

    if (event.key === ']') {
      event.preventDefault()
      toggleInspector()

      return
    }

    if (event.key === 'k' || event.key === 'K') {
      event.preventDefault()
      onOpenPalette?.()

      return
    }

    if (event.key === 'Escape' && overlay && inspectorIsOpen) {
      event.preventDefault()
      setInspectorOpen(connectionId, profile, false)
      onInspector?.(false)
    }
  }

  const inspector = (
    <Inspector
      fleet={fleet}
      focusedRun={focusedRun}
      onClose={() => {
        setInspectorOpen(connectionId, profile, false)
        onInspector?.(false)
      }}
      onSlot={(slot: InspectorSlot) => setInspectorSlot(connectionId, profile, slot)}
      overlay={overlay}
      scope={{ ...nav, inspectorOpen: inspectorIsOpen }}
    />
  )

  return (
    <div
      data-ops-fullscreen={fullscreen ? 'true' : 'false'}
      data-ops-gutter={String(OPS_GUTTER_PX)}
      data-ops-inspector={narrow.inspector}
      data-ops-inspector-open={inspectorIsOpen ? 'true' : 'false'}
      data-ops-native="route"
      data-ops-pane-width={String(paneWidth)}
      data-ops-profile={profile}
      data-ops-rail={narrow.rail}
      data-ops-remote={remote ? 'true' : 'false'}
      data-ops-revision={revision}
      data-ops-root=""
      data-ops-sash="layout-tree"
      data-ops-scope={connectionId}
      data-ops-tabs={narrow.tabs}
      onKeyDown={onShellKeyDown}
      style={{
        ['--gutter' as string]: `${OPS_GUTTER_PX}px`,
        boxSizing: 'border-box',
        containerType: 'inline-size',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        padding: OPS_GUTTER_PX,
        position: 'relative',
        width: '100%'
      }}
    >
      <div data-ops-breadcrumb="">
        <span>Ops</span>
        <span aria-hidden="true"> ▸ </span>
        <span data-ops-connection="">{connectionLabel}</span>
        {remote ? <span data-ops-readonly=""> read-only</span> : null}
        <span aria-hidden="true"> ▸ </span>
        <span>{profile}</span>
        <span aria-hidden="true"> ▸ </span>
        <span data-ops-view-name="">{opsViewLabel(view)}</span>
        {viewId ? <span data-ops-view-id=""> {viewId}</span> : null}
      </div>
      <div data-ops-toolbar="" style={{ flex: '0 0 auto', position: 'relative', zIndex: 5 }}>
        <button data-ops-back="" onClick={onBackToChats} type="button">
          ← Chats
        </button>
        <button
          aria-keyshortcuts="["
          aria-pressed={narrow.rail !== 'hidden'}
          data-ops-rail-toggle=""
          onClick={cycleStoredRail}
          type="button"
        >
          Rail
        </button>
        <button
          aria-keyshortcuts="]"
          aria-pressed={inspectorIsOpen}
          data-ops-inspector-toggle=""
          onClick={toggleInspector}
          type="button"
        >
          Inspector
        </button>
        <button data-ops-dock-toggle="" onClick={() => setDock(connectionId, profile, { dockOpen: !nav.dockOpen })} type="button">
          Dock
        </button>
        <button data-ops-copy-link="" onClick={onCopyLink} type="button">
          Copy link
        </button>
        <button
          aria-label={fullscreen ? 'Restore split' : 'Full screen Ops'}
          aria-pressed={fullscreen}
          data-ops-fullscreen-toggle=""
          onClick={onToggleFullscreen}
          type="button"
        >
          ⤢
        </button>
      </div>
      <div data-ops-body="" style={{ display: 'flex', flex: '1 1 auto', minHeight: 0, minWidth: 0, position: 'relative' }}>
        <Rail
          connectionId={connectionId}
          connectionLabel={connectionLabel}
          connections={connections}
          filter={nav.filter}
          fleet={fleet}
          onConnect={() => onConnect?.()}
          onFilter={value => setFilter(connectionId, profile, value)}
          onOpenLens={id => {
            openLens(connectionId, profile, id)
            onView?.(id)
          }}
          onOpenPalette={() => onOpenPalette?.()}
          onOpenPin={id => openPin(connectionId, profile, id)}
          onOpenSettings={() => onOpenSettings?.()}
          onOpenView={id => {
            selectTab(connectionId, profile, id, leaving())
            onView?.(id)
          }}
          onSelectConnection={id => onSelectConnection?.(id)}
          onSelectProfile={name => onSelectProfile?.(name)}
          onTogglePin={id => togglePin(connectionId, profile, id)}
          pins={nav.pins}
          profile={profile}
          profiles={profiles}
          rail={narrow.rail}
          remote={remote}
        />
        <div data-ops-main="" style={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          <DocumentTabs
            dots={nav.dots}
            narrow={narrow.tabs}
            onClose={id => closeTab(connectionId, profile, id)}
            onSelect={(id, snapshot) => {
              selectTab(connectionId, profile, id, snapshot)
              const tab = nav.tabs.find(item => item.id === id)

              if (tab && (tab.kind === 'office' || tab.kind === 'canvas' || tab.kind === 'board')) {
                onView?.(tab.kind)
              }
            }}
            onSnapshot={(id, snapshot) => captureSnapshot(connectionId, profile, id, snapshot)}
            onTogglePin={id => togglePin(connectionId, profile, id)}
            overlay={overlay && inspectorIsOpen ? inspector : null}
            pins={nav.pins}
            renderPanel={tab => panelFor(tab, onOpenRoute)}
            selectedId={nav.selectedTabId}
            snapshots={nav.snapshots}
            tabs={nav.tabs}
          />
          <button data-ops-open-chat="" onClick={onOpenChat} type="button">
            Open the existing chat
          </button>
        </div>
        {!overlay && inspectorIsOpen ? inspector : null}
      </div>
      <DockHost
        events={events}
        label={connectionLabel}
        logLines={logLines}
        onClose={() => setDock(connectionId, profile, { dockOpen: false })}
        onSlot={dockSlot => setDock(connectionId, profile, { dockSlot })}
        open={nav.dockOpen}
        problems={problems}
        slot={nav.dockSlot}
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
