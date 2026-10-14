/**
 * Ops rail. Three states (full / icons / hidden) are a preference.
 * Under 1024px on the Ops pane the full preference draws as icons (R53).
 * Fleet rows come from the caller. Missing A1/A3 never become a fake total.
 */

import { type CSSProperties, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { useI18n } from '@/i18n'

import { useOpsEscapeLayer } from './keymap'
import { opsNavLabel, opsPresenceLabel } from './locales'
import { type PresenceState, resolvePresence } from './motion'
import {
  arrangeFleet,
  flattenFleet,
  FLEET_ROW_PX,
  FLEET_VIEW_PX,
  type FleetFeed,
  fleetWindow,
  LENS_CATALOG,
  lensById,
  PINNED_VIEWS,
  type RailState
} from './navigation-store'
import { PresenceGlyph } from './primitives/presence-glyph'
import { Sigil } from './primitives/sigil'

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
  const copy = useI18n().t.ops
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
        {copy.rail.fleet} · {arranged.onlineLabel === 'unavailable' ? copy.unavailable : copy.rail.online(arranged.onlineLabel)}
      </div>
      <div data-ops-needs-you-count="">{arranged.needsYouLabel === 'unavailable' ? copy.unavailable : copy.chrome.needsYou(arranged.needsYouLabel)}</div>
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
                {opsPresenceLabel(copy, row.label)}
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
                {compact ? '▸' : `${copy.rail.idleCount(row.count)} ▸`}
              </button>
            )
          }

          const painted = presencePaint(row.member.presence ?? 'unknown')

          return (
            <div data-ops-fleet-row={row.member.id} data-presence={painted.state} key={row.id} style={{ height: FLEET_ROW_PX }} tabIndex={-1}>
              <PresenceGlyph
                copyColor={painted.copyColor}
                glyphColor={painted.glyphColor}
                label={opsPresenceLabel(copy, painted.label)}
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
  const copy = useI18n().t.ops
  const nav = (id: string, fallback: string) => opsNavLabel(copy, id, fallback)
  const pinText = (id: string) => nav(id, pinLabel(id))
  const filterRef = useRef<HTMLButtonElement>(null)
  useOpsEscapeLayer(filterOpen && rail === 'icons', () => { setFilterOpen(false); filterRef.current?.focus() })
  useOpsEscapeLayer(switcherOpen && rail === 'icons', () => { setSwitcherOpen(false); switcherRef.current?.focus() })
  const icons = rail === 'icons'
  const primary = LENS_CATALOG.filter(lens => !lens.more)
  const more = LENS_CATALOG.filter(lens => lens.more)
  const visiblePrimary = primary.filter(lens => matches(nav(lens.id, lens.label), filter))
  const visibleMore = more.filter(lens => matches(nav(lens.id, lens.label), filter))

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
      aria-label={copy.rail.label}
      data-ops-rail={rail}
      data-ops-rail-list=""
      data-ops-rail-width={String(railWidth)}
      style={
        icons
          ? {
              boxSizing: 'border-box',
              display: 'flex',
              flex: `0 0 ${railWidth}px`,
              flexDirection: 'column',
              height: '100%',
              maxHeight: '100%',
              maxWidth: railWidth,
              minHeight: 0,
              minWidth: railWidth,
              position: 'relative',
              width: railWidth
            }
          : {
              boxSizing: 'border-box',
              flex: `0 0 ${railWidth}px`,
              maxWidth: railWidth,
              minWidth: railWidth,
              overflow: 'hidden',
              position: 'relative',
              width: railWidth
            }
      }
    >
      <div
        data-ops-rail-scroll={icons ? 'true' : undefined}
        style={
          icons
            ? { flex: '1 1 auto', minHeight: 0, overflowX: 'hidden', overflowY: 'auto' }
            : { display: 'contents' }
        }
      >
      <div data-ops-switcher="">
        {icons ? (
          <button
            aria-expanded={switcherOpen}
            aria-label={copy.rail.switcher}
            data-ops-switcher-toggle=""
            onClick={() => setSwitcherOpen(open => !open)}
            ref={switcherRef}
            style={fit}
            type="button"
          >
            <Sigil name={profile} />
            {remote ? <span aria-label={copy.readOnly} data-ops-readonly="" /> : null}
          </button>
        ) : (
          <>
            <label>
              {copy.rail.connection}
              <select
                aria-label={copy.rail.connection}
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
            {remote ? <span aria-label={copy.readOnly} data-ops-readonly="" /> : null}
            <label>
              {copy.rail.profile}
              <select aria-label={copy.rail.profile} onChange={event => onSelectProfile(event.target.value)} value={profile}>
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
            <div data-ops-overlay="" data-ops-switcher-menu="" style={menuStyle(switcherRef.current)}>
              <label>
                {copy.rail.connection}
                <select
                  aria-label={copy.rail.connection}
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
                {copy.rail.profile}
                <select aria-label={copy.rail.profile} onChange={event => onSelectProfile(event.target.value)} value={profile}>
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
              aria-label={copy.rail.showFilter}
              data-ops-filter-toggle=""
              onClick={() => setFilterOpen(open => !open)}
              ref={filterRef}
              style={fit}
              type="button"
            >
              {filter ? '×' : '⌕'}
            </button>
            <input
              aria-label={copy.rail.filter}
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
              aria-label={copy.rail.filter}
              data-ops-filter=""
              onChange={event => onFilter(event.target.value)}
              placeholder={copy.rail.filterPlaceholder}
              style={{ boxSizing: 'border-box', maxWidth: '100%', minWidth: 0, width: '100%' }}
              value={filter}
            />
            <button aria-label={copy.rail.clearFilter} data-ops-filter-clear="" onClick={() => onFilter('')} type="button">
              ×
            </button>
            <button aria-keyshortcuts="Control+K" data-ops-palette="" onClick={onOpenPalette} type="button">
              {copy.rail.palette}
              <kbd>Ctrl+K</kbd>
            </button>
          </>
        )}
        {icons ? (
          <button aria-keyshortcuts="Control+K" aria-label={copy.rail.palette} data-ops-palette="" onClick={onOpenPalette} style={fit} type="button">
            K
          </button>
        ) : null}
      </div>
      {icons && filterOpen && typeof document !== 'undefined'
        ? createPortal(
            <div data-ops-filter-overlay="" data-ops-overlay="" style={menuStyle(filterRef.current)}>
              <input
                aria-label={copy.rail.filter}
                data-ops-filter=""
                onChange={event => onFilter(event.target.value)}
                placeholder={copy.rail.filterPlaceholder}
                value={filter}
              />
              <button aria-label={copy.rail.clearFilter} data-ops-filter-clear="" onClick={() => onFilter('')} type="button">
                ×
              </button>
            </div>,
            document.body
          )
        : null}

      <div data-ops-section="ops">{copy.rail.sectionOps}</div>
      {PINNED_VIEWS.filter(view => matches(nav(view.id, view.label), filter)).map(view => (
        <button
          aria-label={nav(view.id, view.label)}
          data-ops-rail-item={view.id}
          key={view.id}
          onClick={() => onOpenView(view.id)}
          style={fit}
          type="button"
        >
          {icons ? nav(view.id, view.label).slice(0, 1) : nav(view.id, view.label)}
          {icons ? null : <kbd data-kbd={view.hint}>{view.hint}</kbd>}
        </button>
      ))}

      <div data-ops-section="pinned">{copy.rail.pinned}</div>
      {pins.length === 0 ? <div data-ops-pins-empty="">{copy.rail.noPins}</div> : null}
      {pins.filter(id => matches(pinText(id), filter)).map(id => (
        <div data-ops-pin-row={id} key={id} style={rowStyle}>
          <button data-ops-pin={id} onClick={() => onOpenPin(id)} style={fit} type="button">
            {icons ? '★' : pinText(id)}
          </button>
          <button aria-label={copy.rail.unpinItem(pinText(id))} data-ops-unpin={id} onClick={() => onTogglePin(id)} style={fit} type="button">
            ×
          </button>
        </div>
      ))}

      <div data-ops-section="lenses">{copy.rail.lenses}</div>
      {visiblePrimary.map(lens => (
        <div key={lens.id} style={rowStyle}>
          <button
            aria-label={nav(lens.id, lens.label)}
            data-ops-lens={lens.id}
            data-route={lens.route}
            data-unavailable={lens.unavailable ? 'true' : 'false'}
            onClick={() => onOpenLens(lens.id)}
            style={fit}
            type="button"
          >
            {icons ? nav(lens.id, lens.label).slice(0, 1) : nav(lens.id, lens.label)}
            {icons || !lens.hint ? null : <kbd>{lens.hint}</kbd>}
          </button>
          <button
            aria-label={pins.includes(`lens:${lens.id}`) ? copy.rail.unpinItem(nav(lens.id, lens.label)) : copy.rail.pinItem(nav(lens.id, lens.label))}
            data-ops-pin-toggle={`lens:${lens.id}`}
            onClick={() => onTogglePin(`lens:${lens.id}`)}
            style={fit}
            type="button"
          >
            {icons ? '★' : pins.includes(`lens:${lens.id}`) ? copy.rail.unpin : copy.rail.pin}
          </button>
        </div>
      ))}
      <button aria-expanded={moreOpen} data-ops-more="" onClick={() => setMoreOpen(open => !open)} style={fit} type="button">
        {icons ? '…' : copy.rail.more}
      </button>
      {moreOpen || filter.trim()
        ? visibleMore.map(lens => (
            <button
              aria-label={nav(lens.id, lens.label)}
              data-ops-lens={lens.id}
              data-ops-more-item=""
              data-route={lens.route}
              key={lens.id}
              onClick={() => onOpenLens(lens.id)}
              style={fit}
              type="button"
            >
              {icons ? nav(lens.id, lens.label).slice(0, 1) : nav(lens.id, lens.label)}
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
        {icons ? '◉' : copy.rail.needsYou}
        {icons ? null : (
          <span data-ops-g85-count="">
            {fleet.a3 === 'missing' || fleet.a1 === 'missing' ? copy.unavailable : arrangeFleet(fleet).needsYouLabel}
          </span>
        )}
        {icons ? (
          <span data-ops-g85-count="" style={{ display: 'none' }}>
            {fleet.a3 === 'missing' || fleet.a1 === 'missing' ? copy.unavailable : arrangeFleet(fleet).needsYouLabel}
          </span>
        ) : null}
      </button>

      <FleetList compact={icons} feed={fleet} filter={filter} />
      {icons ? null : (
        <>
          <button aria-label={copy.rail.connect} data-ops-connect="" onClick={onConnect} style={fit} type="button">
            {icons ? '+' : copy.rail.connect}
          </button>
          <button aria-keyshortcuts="Control+," aria-label={copy.rail.settings} data-ops-settings="" onClick={onOpenSettings} style={fit} type="button">
            {icons ? '⚙' : copy.rail.settings}
            {icons ? null : <kbd>Ctrl+,</kbd>}
          </button>
        </>
      )}
      </div>
      {icons ? (
        <div data-ops-rail-footer="" style={{ flex: '0 0 auto' }}>
          <button aria-label={copy.rail.connect} data-ops-connect="" onClick={onConnect} style={fit} type="button">
            +
          </button>
          <button aria-keyshortcuts="Control+," aria-label={copy.rail.settings} data-ops-settings="" onClick={onOpenSettings} style={fit} type="button">
            ⚙
          </button>
        </div>
      ) : null}
    </nav>
  )
}

export function pinLabel(pinId: string): string {
  if (pinId.startsWith('lens:')) {
    return lensById(pinId.slice(5))?.label ?? pinId
  }

  return pinId
}
