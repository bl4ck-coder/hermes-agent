/**
 * Scoped document tabs. Pinned Office / Canvas / Board cannot close.
 * Closable lens, task, profile, and run tabs overflow into a chevron and
 * become a dropdown when the Ops pane is under 800px. Inactive panels stay
 * mounted so a background event cannot reset their scroll or steal focus.
 */

import type { KeyboardEvent, ReactNode } from 'react'
import { useEffect, useRef } from 'react'

import {
  type NavSnapshot,
  type OpsNarrow,
  type OpsTab,
  emptySnapshot,
  visibleTabs
} from './navigation-store'

export const TAB_OVERFLOW_MAX = 6

export interface DocumentTabsProps {
  tabs: OpsTab[]
  selectedId: string
  dots: Record<string, 'unsaved' | 'unread'>
  narrow: OpsNarrow['tabs']
  snapshots: Record<string, NavSnapshot>
  onSelect: (id: string, leaving: NavSnapshot) => void
  onClose: (id: string) => void
  onSnapshot: (id: string, snapshot: NavSnapshot) => void
  renderPanel: (tab: OpsTab) => ReactNode
}

function dotLabel(dot: 'unsaved' | 'unread' | undefined) {
  if (dot === 'unsaved') {
    return 'unsaved'
  }

  if (dot === 'unread') {
    return 'unread'
  }

  return ''
}

export function DocumentTabs({
  dots,
  narrow,
  onClose,
  onSelect,
  onSnapshot,
  renderPanel,
  selectedId,
  snapshots,
  tabs
}: DocumentTabsProps) {
  const { overflow, visible } = visibleTabs(tabs, selectedId, TAB_OVERFLOW_MAX)
  const selected = tabs.find(tab => tab.id === selectedId) ?? tabs[0]

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target

    if (target instanceof HTMLElement && target.closest('input, textarea, select')) {
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
    <div data-ops-tabs={narrow} onKeyDown={onKeyDown}>
      {narrow === 'dropdown' ? (
        <label data-ops-tab-dropdown="">
          Tabs
          <select
            aria-label="Ops tabs"
            onChange={event => onSelect(event.target.value, snapshots[selectedId] ?? emptySnapshot())}
            value={selectedId}
          >
            {tabs.map(tab => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
              </option>
            ))}
          </select>
          {selected && selected.closable && !selected.pinned ? (
            <button aria-label={`Close ${selected.label}`} data-ops-tab-close={selected.id} onClick={() => onClose(selected.id)} type="button">
              ×
            </button>
          ) : null}
        </label>
      ) : (
        <div data-ops-tab-strip="" role="tablist">
          {visible.map(tab => (
            <button
              aria-selected={tab.id === selectedId}
              data-closable={tab.closable ? 'true' : 'false'}
              data-dot={dotLabel(dots[tab.id])}
              data-ops-tab={tab.id}
              data-pinned={tab.pinned ? 'true' : 'false'}
              data-route={tab.route}
              key={tab.id}
              onClick={() => onSelect(tab.id, snapshots[selectedId] ?? emptySnapshot())}
              role="tab"
              type="button"
            >
              {tab.label}
              {dots[tab.id] ? <span data-ops-dot={dots[tab.id]} /> : null}
              {tab.closable && !tab.pinned ? (
                <span
                  aria-label={`Close ${tab.label}`}
                  data-ops-tab-close={tab.id}
                  onClick={event => {
                    event.stopPropagation()
                    onClose(tab.id)
                  }}
                  role="button"
                >
                  ×
                </span>
              ) : null}
            </button>
          ))}
          {overflow.length > 0 ? (
            <details data-ops-tab-overflow="">
              <summary>More tabs</summary>
              {overflow.map(tab => (
                <button
                  data-ops-tab={tab.id}
                  data-route={tab.route}
                  key={tab.id}
                  onClick={() => onSelect(tab.id, snapshots[selectedId] ?? emptySnapshot())}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </details>
          ) : null}
        </div>
      )}
      {tabs.map(tab => (
        <TabPanel
          active={tab.id === selectedId}
          key={tab.id}
          onSnapshot={snapshot => onSnapshot(tab.id, snapshot)}
          renderPanel={renderPanel}
          snapshot={snapshots[tab.id] ?? emptySnapshot()}
          tab={tab}
        />
      ))}
    </div>
  )
}

function TabPanel({
  active,
  onSnapshot,
  renderPanel,
  snapshot,
  tab
}: {
  active: boolean
  onSnapshot: (snapshot: NavSnapshot) => void
  renderPanel: (tab: OpsTab) => ReactNode
  snapshot: NavSnapshot
  tab: OpsTab
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (active && ref.current) {
      ref.current.scrollTop = snapshot.scrollTop
    }
  }, [active, snapshot.scrollTop])

  return (
    <div
      data-ops-panel={tab.id}
      data-pane-hidden={active ? undefined : ''}
      data-route={tab.route}
      data-scroll={String(snapshot.scrollTop)}
      hidden={active ? undefined : true}
      onScroll={event => onSnapshot({ ...snapshot, scrollTop: event.currentTarget.scrollTop })}
      ref={ref}
    >
      {tab.unavailable ? (
        <p data-ops-unavailable="">No Desktop route for {tab.label}. This shell does not invent one.</p>
      ) : (
        renderPanel(tab)
      )}
      <div data-ops-selection={snapshot.selectionId ?? ''} />
    </div>
  )
}
