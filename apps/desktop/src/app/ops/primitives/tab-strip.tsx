import '../motion.css'

import type { KeyboardEvent } from 'react'
import { useRef, useState } from 'react'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useI18n } from '@/i18n'
import type { IconComponent } from '@/lib/icons'
import { ChevronDown, X } from '@/lib/icons'

import { OPS_GUTTER_PX, opsDensityStyle } from './data-table'

/** O47: caller supplies the meaning. Gold = unsaved, champagne = unread. */
export const TAB_INDICATOR_COLOR = {
  unsaved: '#C9A55A',
  unread: '#CDBB98'
} as const

export type TabIndicator = keyof typeof TAB_INDICATOR_COLOR

export interface TabStripTab {
  id: string
  label: string
  pinned?: boolean
  /** Ignored when pinned. Unpinned tabs are closable unless this is false. */
  closable?: boolean
  icon?: IconComponent
  indicator?: TabIndicator | null
  route?: string
}

export interface TabStripProps {
  tabs: TabStripTab[]
  activeId: string
  onActiveChange: (id: string) => void
  onClose?: (id: string) => void
  /** Pinned tabs always stay. Extra unpinned tabs go to the overflow chevron. */
  maxVisible?: number
  /** Pane-aware override. Viewport media query is the fallback. */
  layout?: 'strip' | 'dropdown'
}

export const TAB_STRIP_NARROW = '(max-width: 800px)'

export function partitionTabs(tabs: TabStripTab[], activeId: string, maxVisible: number) {
  const pinned = tabs.filter(tab => tab.pinned)
  const unpinned = tabs.filter(tab => !tab.pinned)
  const room = Math.max(0, maxVisible - pinned.length)
  let visibleUnpinned = unpinned.slice(0, room)
  let overflow = unpinned.slice(room)
  const activeOverflow = overflow.find(tab => tab.id === activeId)

  if (activeOverflow && visibleUnpinned.length > 0) {
    const displaced = visibleUnpinned[visibleUnpinned.length - 1]
    visibleUnpinned = [...visibleUnpinned.slice(0, -1), activeOverflow]
    overflow = [displaced, ...overflow.filter(tab => tab.id !== activeId)]
  }

  return { overflow, visible: [...pinned, ...visibleUnpinned] }
}

function canClose(tab: TabStripTab | undefined) {
  return Boolean(tab && !tab.pinned && tab.closable !== false)
}

function onStripKeyDown(
  event: KeyboardEvent<HTMLDivElement>,
  tabs: TabStripTab[],
  activeId: string,
  onActiveChange: (id: string) => void,
  onClose?: (id: string) => void
) {
  const target = event.target

  if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) {
    return
  }

  if (event.key === 'Tab' && event.ctrlKey && tabs.length > 0) {
    event.preventDefault()
    const index = Math.max(0, tabs.findIndex(tab => tab.id === activeId))
    const delta = event.shiftKey ? -1 : 1
    const next = tabs[(index + delta + tabs.length) % tabs.length]

    if (next) {
      onActiveChange(next.id)
    }
  }

  if ((event.key === 'w' || event.key === 'W') && event.ctrlKey) {
    event.preventDefault()
    const active = tabs.find(tab => tab.id === activeId)

    if (canClose(active) && onClose && active) {
      onClose(active.id)
    }
  }
}

function Indicator({ indicator }: { indicator: TabIndicator }) {
  return (
    <span
      aria-label={indicator}
      data-indicator={indicator}
      data-indicator-color={TAB_INDICATOR_COLOR[indicator]}
      data-ops-dot={indicator}
      role="img"
      style={{
        backgroundColor: TAB_INDICATOR_COLOR[indicator],
        borderRadius: '50%',
        display: 'inline-block',
        height: 6,
        width: 6
      }}
    />
  )
}

function TabFace({ tab }: { tab: TabStripTab }) {
  const Icon = tab.icon

  return (
    <span data-kind-icon={Icon ? 'true' : 'false'} style={{ alignItems: 'center', display: 'inline-flex', gap: 6 }}>
      {Icon ? <Icon aria-hidden data-icon="kind" size={14} strokeWidth={1.5} /> : null}
      <span>{tab.label}</span>
      {tab.indicator ? <Indicator indicator={tab.indicator} /> : null}
    </span>
  )
}

function dismissEnclosingMenu(node: HTMLElement) {
  if (!node.closest('[role="menu"]')) {
    return
  }

  node.ownerDocument.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
}

function CloseTab({ onClose, tab }: { onClose?: (id: string) => void; tab: TabStripTab }) {
  const copy = useI18n().t.ops

  if (!canClose(tab) || !onClose) {
    return null
  }

  return (
    <button
      aria-label={copy.tabs.close(tab.label)}
      data-close-tab={tab.id}
      data-ops-tab-close={tab.id}
      onClick={event => {
        event.preventDefault()
        event.stopPropagation()
        onClose(tab.id)
        dismissEnclosingMenu(event.currentTarget)
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          onClose(tab.id)
          dismissEnclosingMenu(event.currentTarget)
        }
      }}
      onPointerDown={event => event.stopPropagation()}
      onPointerUp={event => event.stopPropagation()}
      type="button"
    >
      <X aria-hidden size={12} />
    </button>
  )
}

function TabButton({
  active,
  onClose,
  onSelect,
  tab
}: {
  active: boolean
  onClose?: (id: string) => void
  onSelect: (id: string) => void
  tab: TabStripTab
}) {
  const copy = useI18n().t.ops
  const Icon = tab.icon
  const closable = canClose(tab)

  return (
    <span className="ops-tab" data-active={active ? 'true' : 'false'} data-pinned={tab.pinned ? 'true' : 'false'}>
      <button
        aria-selected={active}
        data-kind-icon={Icon ? 'true' : 'false'}
        data-ops-tab={tab.id}
        data-pinned={tab.pinned ? 'true' : 'false'}
        data-route={tab.route ?? ''}
        onClick={() => onSelect(tab.id)}
        role="tab"
        style={{
          alignItems: 'center',
          borderBottom: active ? '2px solid #C9A55A' : '2px solid transparent',
          display: 'inline-flex',
          gap: 6,
          height: 28
        }}
        type="button"
      >
        {Icon && <Icon aria-hidden data-icon="kind" size={14} strokeWidth={1.5} />}
        <span>{tab.label}</span>
        {tab.indicator && <Indicator indicator={tab.indicator} />}
      </button>
      {closable && onClose && (
        <button aria-label={copy.tabs.close(tab.label)} data-ops-tab-close={tab.id} onClick={() => onClose(tab.id)} type="button">
          <X aria-hidden size={12} />
        </button>
      )}
    </span>
  )
}

function focusOpenMenuItem(trigger: HTMLElement) {
  const menuId = trigger.getAttribute('aria-controls')
  const menu = menuId ? document.getElementById(menuId) : null
  const item = menu?.querySelector<HTMLElement>('[role="menuitem"]')

  if (!item) {
    return false
  }

  item.focus()

  return true
}

function focusSiblingMenuItem(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
    return
  }

  const current = event.target instanceof HTMLElement ? event.target.closest('[role="menuitem"]') : null

  if (!(current instanceof HTMLElement) || !event.currentTarget.contains(current)) {
    return
  }

  const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')]
  const next = items[items.indexOf(current) + (event.key === 'ArrowDown' ? 1 : -1)]

  if (!next) {
    return
  }

  event.preventDefault()
  event.stopPropagation()
  next.focus()
}

function NarrowStrip({
  active,
  activeId,
  onActiveChange,
  onClose,
  tabs
}: {
  active: TabStripTab | undefined
  activeId: string
  onActiveChange: (id: string) => void
  onClose?: (id: string) => void
  tabs: TabStripTab[]
}) {
  const copy = useI18n().t.ops
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div
      className="ops-tab-strip"
      data-layout="narrow"
      data-ops-tab-dropdown=""
      onKeyDown={event => onStripKeyDown(event, tabs, activeId, onActiveChange, onClose)}
      style={opsDensityStyle()}
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={active ? copy.tabs.labelActive(active.label) : copy.tabs.label}
            data-active="true"
            data-narrow-trigger=""
            onKeyDown={event => {
              if (event.key === 'ArrowDown' && focusOpenMenuItem(event.currentTarget)) {
                event.preventDefault()
              }
            }}
            ref={triggerRef}
            style={{ borderBottom: '2px solid #C9A55A' }}
            type="button"
          >
            {active ? <TabFace tab={active} /> : null}
            <ChevronDown aria-hidden size={14} />
          </button>
        </DropdownMenuTrigger>
        {active ? <CloseTab onClose={onClose} tab={active} /> : null}
        <DropdownMenuContent
          align="start"
          onKeyDownCapture={event => {
            if (event.key === 'Escape') {
              const trigger = triggerRef.current ?? document.querySelector('[data-narrow-trigger]')

              if (trigger instanceof HTMLElement) {
                trigger.focus()
              }

              return
            }

            focusSiblingMenuItem(event)
          }}
          side="bottom"
        >
          {tabs.map(tab => {
            const selected = tab.id === activeId

            return (
              <DropdownMenuItem
                data-active={selected ? 'true' : 'false'}
                data-pinned={tab.pinned ? 'true' : 'false'}
                data-tour={`tab-${tab.id}`}
                key={tab.id}
                onSelect={() => onActiveChange(tab.id)}
                style={{
                  borderBottom: selected ? '2px solid #C9A55A' : '2px solid transparent'
                }}
              >
                <TabFace tab={tab} />
                <CloseTab onClose={onClose} tab={tab} />
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function TabStrip({ activeId, layout, maxVisible = 6, onActiveChange, onClose, tabs }: TabStripProps) {
  const mediaNarrow = useMediaQuery(TAB_STRIP_NARROW)
  const copy = useI18n().t.ops
  const narrow = layout ? layout === 'dropdown' : mediaNarrow
  const { overflow, visible } = partitionTabs(tabs, activeId, maxVisible)
  const [overflowOpen, setOverflowOpen] = useState(false)

  if (narrow) {
    const active = tabs.find(tab => tab.id === activeId) ?? tabs[0]

    return (
      <NarrowStrip
        active={active}
        activeId={activeId}
        onActiveChange={onActiveChange}
        onClose={onClose}
        tabs={tabs}
      />
    )
  }

  return (
    <div
      className="ops-tab-strip"
      data-gutter={String(OPS_GUTTER_PX)}
      data-layout="strip"
      data-overflow-count={String(overflow.length)}
      onKeyDown={event => onStripKeyDown(event, tabs, activeId, onActiveChange, onClose)}
      style={opsDensityStyle()}
    >
      <div aria-label={copy.tabs.label} role="tablist">
        {visible.map(tab => (
          <TabButton active={tab.id === activeId} key={tab.id} onClose={onClose} onSelect={onActiveChange} tab={tab} />
        ))}
        {overflow.length > 0 && (
          <DropdownMenu onOpenChange={setOverflowOpen} open={overflowOpen}>
            <DropdownMenuTrigger asChild>
              <button
                aria-expanded={overflowOpen}
                aria-label={copy.tabs.more(overflow.length)}
                data-ops-tab-overflow=""
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    event.stopPropagation()
                    setOverflowOpen(true)
                  }
                }}
                type="button"
              >
                <ChevronDown aria-hidden size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflow.map(tab => (
                <DropdownMenuItem
                  key={tab.id}
                  onSelect={event => {
                    if ((event.target as HTMLElement | null)?.closest?.('[data-close-tab]')) {
                      event.preventDefault()

                      return
                    }

                    onActiveChange(tab.id)
                  }}
                >
                  <TabFace tab={tab} />
                  <CloseTab onClose={onClose} tab={tab} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
