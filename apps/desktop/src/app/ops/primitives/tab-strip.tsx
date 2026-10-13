import '../motion.css'

import type { KeyboardEvent } from 'react'
import { useState } from 'react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ResponsiveTabs } from '@/components/ui/tab-dropdown'
import { useMediaQuery } from '@/hooks/use-media-query'
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
}

export interface TabStripProps {
  tabs: TabStripTab[]
  activeId: string
  onActiveChange: (id: string) => void
  onClose?: (id: string) => void
  /** Pinned tabs always stay. Extra unpinned tabs go to the overflow chevron. */
  maxVisible?: number
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
  const Icon = tab.icon
  const closable = canClose(tab)

  return (
    <span className="ops-tab" data-active={active ? 'true' : 'false'} data-pinned={tab.pinned ? 'true' : 'false'}>
      <button
        aria-selected={active}
        data-kind-icon={Icon ? 'true' : 'false'}
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
        <button aria-label={`Close ${tab.label}`} onClick={() => onClose(tab.id)} type="button">
          <X aria-hidden size={12} />
        </button>
      )}
    </span>
  )
}

export function TabStrip({ activeId, maxVisible = 6, onActiveChange, onClose, tabs }: TabStripProps) {
  const narrow = useMediaQuery(TAB_STRIP_NARROW)
  const { overflow, visible } = partitionTabs(tabs, activeId, maxVisible)
  const [overflowOpen, setOverflowOpen] = useState(false)

  if (narrow) {
    return (
      <div
        className="ops-tab-strip"
        data-layout="narrow"
        onKeyDown={event => onStripKeyDown(event, tabs, activeId, onActiveChange, onClose)}
        style={opsDensityStyle()}
      >
        <ResponsiveTabs
          onChange={onActiveChange}
          tabs={tabs.map(tab => ({ id: tab.id, label: tab.label }))}
          value={activeId}
        />
      </div>
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
      <div aria-label="Ops tabs" role="tablist">
        {visible.map(tab => (
          <TabButton active={tab.id === activeId} key={tab.id} onClose={onClose} onSelect={onActiveChange} tab={tab} />
        ))}
        {overflow.length > 0 && (
          <DropdownMenu onOpenChange={setOverflowOpen} open={overflowOpen}>
            <DropdownMenuTrigger asChild>
              <button
                aria-expanded={overflowOpen}
                aria-label={`More tabs, ${overflow.length} overflow`}
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
                <DropdownMenuItem key={tab.id} onSelect={() => onActiveChange(tab.id)}>
                  {tab.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
