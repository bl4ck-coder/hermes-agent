/**
 * Scoped document tabs. Pinned Office / Canvas / Board cannot close.
 * Closable lens, task, profile, and run tabs overflow into the shared TabStrip
 * and become a dropdown when the Ops pane is under 800px. Inactive panels stay
 * mounted so a background event cannot reset their scroll or steal focus.
 */

import type { KeyboardEvent, ReactNode } from 'react'
import { useEffect, useRef } from 'react'

import { CheckCircle2, Eye, LayoutDashboard, NotebookTabs, Palette, Play, Users, type IconComponent } from '@/lib/icons'

import { TAB_INDICATOR_COLOR, TabStrip, type TabStripTab } from './primitives/tab-strip'
import {
  type NavSnapshot,
  type OpsNarrow,
  type OpsTab,
  type TabKind,
  emptySnapshot
} from './navigation-store'

const KIND_ICON: Record<TabKind, IconComponent> = {
  office: LayoutDashboard,
  canvas: Palette,
  board: NotebookTabs,
  lens: Eye,
  task: CheckCircle2,
  profile: Users,
  run: Play
}

export const TAB_OVERFLOW_MAX = 6

export interface DocumentTabsProps {
  tabs: OpsTab[]
  selectedId: string
  dots: Record<string, 'unsaved' | 'unread'>
  narrow: OpsNarrow['tabs']
  snapshots: Record<string, NavSnapshot>
  pins: string[]
  overlay?: ReactNode
  onSelect: (id: string, leaving: NavSnapshot) => void
  onClose: (id: string) => void
  onSnapshot: (id: string, snapshot: NavSnapshot) => void
  onTogglePin: (id: string) => void
  renderPanel: (tab: OpsTab) => ReactNode
}

export function DocumentTabs({
  dots,
  narrow,
  onClose,
  onSelect,
  onSnapshot,
  onTogglePin,
  overlay,
  pins,
  renderPanel,
  selectedId,
  snapshots,
  tabs
}: DocumentTabsProps) {
  const selected = tabs.find(tab => tab.id === selectedId) ?? tabs[0]
  const stripTabs: TabStripTab[] = tabs.map(tab => ({
    closable: tab.closable,
    icon: KIND_ICON[tab.kind],
    id: tab.id,
    indicator: dots[tab.id] ?? null,
    label: tab.label,
    pinned: tab.pinned,
    route: tab.route
  }))

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) {
      return
    }

    const target = event.target

    if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) {
      return
    }

    if (event.key === 'w' && (event.ctrlKey || event.metaKey) && selected && !selected.pinned) {
      event.preventDefault()
      onClose(selected.id)

      return
    }

    if (event.key === 'Tab' && event.ctrlKey) {
      event.preventDefault()
      const index = tabs.findIndex(tab => tab.id === selectedId)
      const next = tabs[(index + (event.shiftKey ? -1 : 1) + tabs.length) % tabs.length]

      if (next) {
        onSelect(next.id, snapshots[selectedId] ?? emptySnapshot())
      }
    }
  }

  return (
    <div data-ops-tabs={narrow} onKeyDown={onKeyDown} style={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
      <div style={{ flex: '0 0 auto', position: 'relative', zIndex: 4 }}>
        <TabStrip
          activeId={selectedId}
          layout={narrow === 'dropdown' ? 'dropdown' : 'strip'}
          maxVisible={TAB_OVERFLOW_MAX}
          onActiveChange={id => onSelect(id, snapshots[selectedId] ?? emptySnapshot())}
          onClose={onClose}
          tabs={stripTabs}
        />
        {narrow === 'dropdown'
          ? (Object.keys(dots) as Array<keyof typeof dots>).map(id =>
              dots[id] ? (
                <span
                  data-ops-dot={dots[id]}
                  key={id}
                  style={{
                    backgroundColor: TAB_INDICATOR_COLOR[dots[id]],
                    borderRadius: '50%',
                    display: 'inline-block',
                    height: 6,
                    width: 6
                  }}
                />
              ) : null
            )
          : null}
      </div>
      <div data-ops-view-slot="" style={{ flex: '1 1 auto', minHeight: 120, position: 'relative' }}>
        {tabs.map(tab => (
          <TabPanel
            active={tab.id === selectedId}
            key={tab.id}
            onSnapshot={snapshot => onSnapshot(tab.id, snapshot)}
            onTogglePin={() => onTogglePin(tab.id)}
            pinned={pins.includes(tab.id)}
            renderPanel={renderPanel}
            snapshot={snapshots[tab.id] ?? emptySnapshot()}
            tab={tab}
          />
        ))}
        {overlay}
      </div>
    </div>
  )
}

function TabPanel({
  active,
  onSnapshot,
  onTogglePin,
  pinned,
  renderPanel,
  snapshot,
  tab
}: {
  active: boolean
  onSnapshot: (snapshot: NavSnapshot) => void
  onTogglePin: () => void
  pinned: boolean
  renderPanel: (tab: OpsTab) => ReactNode
  snapshot: NavSnapshot
  tab: OpsTab
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = ref.current

    if (!active || !node) {
      return
    }

    node.scrollTop = snapshot.scrollTop

    if (!snapshot.focusId) {
      return
    }

    const focus = node.querySelector<HTMLElement>(`[data-ops-focus-id="${snapshot.focusId}"]`)

    focus?.focus()
  }, [active, snapshot.focusId, snapshot.scrollTop])

  return (
    <div
      data-ops-panel={tab.id}
      data-ops-restored-filter={snapshot.filter}
      data-pane-hidden={active ? undefined : ''}
      data-route={tab.route}
      data-scroll={String(snapshot.scrollTop)}
      hidden={active ? undefined : true}
      onScroll={event => onSnapshot({ ...snapshot, scrollTop: event.currentTarget.scrollTop })}
      ref={ref}
      style={{
        display: active ? undefined : 'none',
        inset: 0,
        overflow: 'auto',
        position: active ? 'absolute' : undefined
      }}
    >
      {tab.closable && active ? (
        <button data-ops-pin-toggle={tab.id} onClick={onTogglePin} type="button">
          {pinned ? `Unpin ${tab.label}` : `Pin ${tab.label}`}
        </button>
      ) : null}
      <div data-ops-panel-body="">
        {tab.unavailable ? (
          <p data-ops-unavailable="">No Desktop route for {tab.label}. This shell does not invent one.</p>
        ) : (
          renderPanel(tab)
        )}
      </div>
      <div data-ops-selection={snapshot.selectionId ?? ''}>{snapshot.selectionId ?? ''}</div>
      <div data-ops-restored-scroll="">{snapshot.scrollTop}</div>
    </div>
  )
}
