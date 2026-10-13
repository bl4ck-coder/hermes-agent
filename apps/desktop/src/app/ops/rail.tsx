/**
 * Ops rail. Three states (full / icons / hidden) are a preference.
 * Under 1024px on the Ops pane the full preference draws as icons (R53).
 * Fleet rows come from the caller. Missing A1/A3 never become a fake total.
 */

import { useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

import { PresenceGlyph } from './primitives/presence-glyph'
import { Sigil } from './primitives/sigil'
import { resolvePresence, type PresenceState } from './motion'

import {
  type FleetFeed,
  type RailState,
  FLEET_ROW_PX,
  FLEET_VIEW_PX,
  LENS_CATALOG,
  PINNED_VIEWS,
  arrangeFleet,
  flattenFleet,
  fleetWindow,
  lensById
} from './navigation-store'

export interface RailConnection {
  id: string
  label: string
  remote: boolean
}

export interface RailProfile {
  name: string
}

export interface RailProps {
  rail: RailState
  remote: boolean
  connectionId: string
  connectionLabel: string
  profile: string
  connections: RailConnection[]
  profiles: RailProfile[]
  filter: string
  pins: string[]
  fleet: FleetFeed
  onFilter: (value: string) => void
  onSelectConnection: (id: string) => void
  onSelectProfile: (name: string) => void
  onOpenView: (id: string) => void
  onOpenPin: (id: string) => void
  onOpenLens: (id: string) => void
  onTogglePin: (id: string) => void
  onConnect: () => void
  onOpenSettings: () => void
  onOpenPalette: () => void
}

function presencePaint(presence: PresenceState) {
  const now = 1_000_000
  const base = { now, observedAt: now, eventAt: now, gatewayUp: true as const }

  if (presence === 'unknown') {
    return resolvePresence({ ...base, observedAt: null })
  }

  if (presence === 'offline') {
    return resolvePresence({ ...base, unreachable: true })
  }

  if (presence === 'stale') {
    return resolvePresence({ ...base, observedAt: now - 120_000, snapshotStale: true })
  }

  if (presence === 'needs_you') {
    return resolvePresence({ ...base, needsYou: true })
  }

  if (presence === 'blocked') {
    return resolvePresence({ ...base, blocked: true })
  }

  if (presence === 'working') {
    return resolvePresence({ ...base, working: true })
  }

  return resolvePresence({ ...base, gatewayUp: true, noWork: true })
}

function matches(label: string, filter: string) {
  const query = filter.trim().toLowerCase()

  if (!query) {
    return true
  }

  return label.toLowerCase().includes(query)
}

export function FleetList({
  compact = false,
  feed,
  filter
}: {
  compact?: boolean
  feed: FleetFeed
  filter: string
}) {
  const [scrollTop, setScrollTop] = useState(0)
  const [idleExpanded, setIdleExpanded] = useState(false)
  const arranged = arrangeFleet(feed)
  const filteredGroups = arranged.groups
    .map(group => ({
      ...group,
      rows: group.rows.filter(row => matches(row.label, filter))
    }))
    .filter(group => group.rows.length > 0 || !filter.trim())
  const flat = flattenFleet(filteredGroups.filter(group => group.rows.length > 0), idleExpanded)
  const windowed = fleetWindow(flat, scrollTop)

  return (
    <div data-ops-fleet="" data-ops-needs-you={arranged.needsYouLabel} data-ops-online={arranged.onlineLabel}>
      <div data-ops-fleet-count="">
        FLEET · {arranged.onlineLabel === 'unavailable' ? 'unavailable' : `${arranged.onlineLabel} online`}
      </div>
      <div data-ops-needs-you-count="">{arranged.needsYouLabel}</div>
      <div
        data-ops-fleet-window=""
        data-rendered={String(windowed.slice.length)}
        data-total={String(windowed.total)}
        data-virtualized="true"
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
        style={{ height: FLEET_VIEW_PX, overflow: 'auto' }}
      >
        <div style={{ height: windowed.paddingTop }} />
        {windowed.slice.map(row => {
          if (row.kind === 'header') {
            return (
              <div data-ops-fleet-group={row.label} key={row.id} style={{ height: FLEET_ROW_PX }}>
                {row.label}
              </div>
            )
          }

          if (row.kind === 'folded') {
            return (
              <button
                data-ops-fleet-folded={row.count}
                key={row.id}
                onClick={() => setIdleExpanded(true)}
                style={{ boxSizing: 'border-box', height: FLEET_ROW_PX, maxWidth: '100%', minWidth: 0, overflow: 'hidden', width: '100%' }}
                type="button"
              >
                {compact ? '▸' : `${row.label} ▸`}
              </button>
            )
          }

          const painted = presencePaint(row.member.presence ?? 'unknown')

          return (
            <div data-ops-fleet-row={row.member.id} data-presence={painted.state} key={row.id} style={{ height: FLEET_ROW_PX }}>
              <PresenceGlyph
                copyColor={painted.copyColor}
                glyphColor={painted.glyphColor}
                label={painted.label}
                state={painted.state}
              />
              <span data-ops-fleet-name="" style={compact ? { display: 'none' } : { maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
                {row.member.label}
              </span>
            </div>
          )
        })}
        <div style={{ height: windowed.paddingBottom }} />
      </div>
    </div>
  )
}

export function Rail({
  connectionId,
  connectionLabel,
  connections,
  filter,
  fleet,
  onConnect,
  onFilter,
  onOpenLens,
  onOpenPalette,
  onOpenPin,
  onOpenSettings,
  onOpenView,
  onSelectConnection,
  onSelectProfile,
  onTogglePin,
  pins,
  profile,
  profiles,
  rail,
  remote
}: RailProps) {
  const [moreOpen, setMoreOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const switcherRef = useRef<HTMLButtonElement>(null)
  const filterRef = useRef<HTMLButtonElement>(null)
  const icons = rail === 'icons'
  const primary = LENS_CATALOG.filter(lens => !lens.more)
  const more = LENS_CATALOG.filter(lens => lens.more)
  const visiblePrimary = primary.filter(lens => matches(lens.label, filter))
  const visibleMore = more.filter(lens => matches(lens.label, filter))

  if (rail === 'hidden') {
    return null
  }

  const railWidth = icons ? 72 : 240
  const fit: CSSProperties | undefined = icons
    ? { boxSizing: 'border-box', display: 'block', maxWidth: '100%', minWidth: 0, overflow: 'hidden', width: '100%' }
    : undefined
  const rowStyle: CSSProperties = icons
    ? { alignItems: 'stretch', display: 'flex', flexDirection: 'column', maxWidth: '100%', minWidth: 0, width: '100%' }
    : { alignItems: 'center', display: 'flex', maxWidth: '100%' }
  const menuStyle = (anchor: HTMLElement | null): CSSProperties => {
    const rect = anchor?.getBoundingClientRect()

    return {
      background: 'var(--surface, #161616)',
      boxSizing: 'border-box',
      left: rect ? rect.right + 8 : 80,
      padding: 8,
      position: 'fixed',
      top: rect ? rect.top : 40,
      width: 220,
      zIndex: 30
    }
  }

  return (
    <nav
      aria-label="Ops"
      data-ops-rail={rail}
      data-ops-rail-list=""
      data-ops-rail-width={String(railWidth)}
      style={{
        boxSizing: 'border-box',
        flex: `0 0 ${railWidth}px`,
        maxWidth: railWidth,
        minWidth: railWidth,
        overflow: 'hidden',
        position: 'relative',
        width: railWidth
      }}
    >
      <div data-ops-switcher="">
        {icons ? (
          <button
            aria-expanded={switcherOpen}
            aria-label="Connection and profile"
            data-ops-switcher-toggle=""
            onClick={() => setSwitcherOpen(open => !open)}
            ref={switcherRef}
            style={fit}
            type="button"
          >
            <Sigil name={profile} />
            {remote ? <span aria-label="read-only" data-ops-readonly="" /> : null}
          </button>
        ) : (
          <>
            <label>
              Connection
              <select
                aria-label="Connection"
                onChange={event => onSelectConnection(event.target.value)}
                value={connectionId}
              >
                {connections.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <span data-ops-connection="">{connectionLabel || connectionId}</span>
            {remote ? <span aria-label="read-only" data-ops-readonly="" /> : null}
            <label>
              Profile
              <select aria-label="Profile" onChange={event => onSelectProfile(event.target.value)} value={profile}>
                {profiles.map(item => (
                  <option key={item.name} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <Sigil name={profile} />
          </>
        )}
      </div>
      {icons && switcherOpen && typeof document !== 'undefined'
        ? createPortal(
            <div data-ops-switcher-menu="" data-ops-overlay="" style={menuStyle(switcherRef.current)}>
              <label>
                Connection
                <select
                  aria-label="Connection"
                  onChange={event => onSelectConnection(event.target.value)}
                  value={connectionId}
                >
                  {connections.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Profile
                <select aria-label="Profile" onChange={event => onSelectProfile(event.target.value)} value={profile}>
                  {profiles.map(item => (
                    <option key={item.name} value={item.name}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>,
            document.body
          )
        : null}

      <div data-ops-filter-row="">
        {icons ? (
          <>
            <button
              aria-expanded={filterOpen}
              aria-label="Show filter"
              data-ops-filter-toggle=""
              onClick={() => setFilterOpen(open => !open)}
              ref={filterRef}
              style={fit}
              type="button"
            >
              {filter ? '×' : '⌕'}
            </button>
            <input
              aria-label="Filter fleet and lenses"
              data-ops-filter=""
              onChange={event => onFilter(event.target.value)}
              style={{
                boxSizing: 'border-box',
                height: 1,
                maxWidth: '100%',
                minWidth: 0,
                opacity: 0,
                overflow: 'hidden',
                padding: 0,
                position: 'absolute',
                width: 1
              }}
              value={filter}
            />
          </>
        ) : (
          <>
            <input
              aria-label="Filter fleet and lenses"
              data-ops-filter=""
              onChange={event => onFilter(event.target.value)}
              placeholder="Filter"
              style={{ boxSizing: 'border-box', maxWidth: '100%', minWidth: 0, width: '100%' }}
              value={filter}
            />
            <button aria-label="Clear filter" data-ops-filter-clear="" onClick={() => onFilter('')} type="button">
              ×
            </button>
            <button aria-keyshortcuts="K" data-ops-palette="" onClick={onOpenPalette} type="button">
              Palette
              <kbd>K</kbd>
            </button>
          </>
        )}
        {icons ? (
          <button aria-keyshortcuts="K" aria-label="Palette" data-ops-palette="" onClick={onOpenPalette} style={fit} type="button">
            K
          </button>
        ) : null}
      </div>
      {icons && filterOpen && typeof document !== 'undefined'
        ? createPortal(
            <div data-ops-filter-overlay="" data-ops-overlay="" style={menuStyle(filterRef.current)}>
              <input
                aria-label="Filter fleet and lenses"
                data-ops-filter=""
                onChange={event => onFilter(event.target.value)}
                placeholder="Filter"
                value={filter}
              />
              <button aria-label="Clear filter" data-ops-filter-clear="" onClick={() => onFilter('')} type="button">
                ×
              </button>
            </div>,
            document.body
          )
        : null}

      <div data-ops-section="ops">OPS</div>
      {PINNED_VIEWS.filter(view => matches(view.label, filter)).map(view => (
        <button
          aria-label={view.label}
          data-ops-rail-item={view.id}
          key={view.id}
          onClick={() => onOpenView(view.id)}
          style={fit}
          type="button"
        >
          {icons ? view.label.slice(0, 1) : view.label}
          {icons ? null : <kbd data-kbd={view.hint}>{view.hint}</kbd>}
        </button>
      ))}

      <div data-ops-section="pinned">Pinned</div>
      {pins.length === 0 ? <div data-ops-pins-empty="">No pins</div> : null}
      {pins.filter(id => matches(id, filter)).map(id => (
        <div data-ops-pin-row={id} key={id} style={rowStyle}>
          <button data-ops-pin={id} onClick={() => onOpenPin(id)} style={fit} type="button">
            {icons ? '★' : pinLabel(id)}
          </button>
          <button aria-label={`Unpin ${pinLabel(id)}`} data-ops-unpin={id} onClick={() => onTogglePin(id)} style={fit} type="button">
            ×
          </button>
        </div>
      ))}

      <div data-ops-section="lenses">LENSES</div>
      {visiblePrimary.map(lens => (
        <div key={lens.id} style={rowStyle}>
          <button
            aria-label={lens.label}
            data-ops-lens={lens.id}
            data-route={lens.route}
            data-unavailable={lens.unavailable ? 'true' : 'false'}
            onClick={() => onOpenLens(lens.id)}
            style={fit}
            type="button"
          >
            {icons ? lens.label.slice(0, 1) : lens.label}
            {icons || !lens.hint ? null : <kbd>{lens.hint}</kbd>}
          </button>
          <button
            aria-label={pins.includes(`lens:${lens.id}`) ? `Unpin ${lens.label}` : `Pin ${lens.label}`}
            data-ops-pin-toggle={`lens:${lens.id}`}
            onClick={() => onTogglePin(`lens:${lens.id}`)}
            style={fit}
            type="button"
          >
            {icons ? '★' : pins.includes(`lens:${lens.id}`) ? 'Unpin' : 'Pin'}
          </button>
        </div>
      ))}
      <button aria-expanded={moreOpen} data-ops-more="" onClick={() => setMoreOpen(open => !open)} style={fit} type="button">
        {icons ? '…' : 'More'}
      </button>
      {moreOpen || filter.trim()
        ? visibleMore.map(lens => (
            <button
              aria-label={lens.label}
              data-ops-lens={lens.id}
              data-ops-more-item=""
              data-route={lens.route}
              key={lens.id}
              onClick={() => onOpenLens(lens.id)}
              style={fit}
              type="button"
            >
              {icons ? lens.label.slice(0, 1) : lens.label}
            </button>
          ))
        : null}

      <button
        data-ops-g85=""
        data-ops-needs-you-entry=""
        data-ops-needs-you-state={fleet.a3 === 'missing' || fleet.a1 === 'missing' ? 'unavailable' : 'ready'}
        onClick={() => {
          if (fleet.a3 === 'missing' || fleet.a1 === 'missing') {
            return
          }
        }}
        style={fit}
        type="button"
      >
        {icons ? '◉' : 'Needs-you'}
        {icons ? null : (
          <span data-ops-g85-count="">
            {fleet.a3 === 'missing' || fleet.a1 === 'missing' ? 'unavailable' : arrangeFleet(fleet).needsYouLabel}
          </span>
        )}
        {icons ? (
          <span data-ops-g85-count="" style={{ display: 'none' }}>
            {fleet.a3 === 'missing' || fleet.a1 === 'missing' ? 'unavailable' : arrangeFleet(fleet).needsYouLabel}
          </span>
        ) : null}
      </button>

      <FleetList compact={icons} feed={fleet} filter={filter} />

      <button data-ops-connect="" onClick={onConnect} style={fit} type="button">
        {icons ? '+' : '+ Connect'}
      </button>
      <button aria-keyshortcuts="Control+," data-ops-settings="" onClick={onOpenSettings} style={fit} type="button">
        {icons ? '⚙' : 'Settings'}
        {icons ? null : <kbd>Ctrl+,</kbd>}
      </button>
    </nav>
  )
}

export function pinLabel(pinId: string): string {
  if (pinId.startsWith('lens:')) {
    return lensById(pinId.slice(5))?.label ?? pinId
  }

  return pinId
}
