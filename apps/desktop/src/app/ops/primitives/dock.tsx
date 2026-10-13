import '../motion.css'

import type { ReactNode } from 'react'

import { LogTail } from '@/components/chat/log-tail'
import { ResponsiveTabs } from '@/components/ui/tab-dropdown'
import { TextTab, TextTabMeta } from '@/components/ui/text-tab'
import { useMediaQuery } from '@/hooks/use-media-query'
import { X } from '@/lib/icons'

import { opsDensityStyle } from './data-table'
import { TAB_STRIP_NARROW } from './tab-strip'

export type DockSlot = 'log' | 'events' | 'problems'

export interface DockProblem {
  id: string
  summary: string
}

export interface DockProps {
  slot: DockSlot
  onSlotChange: (slot: DockSlot) => void
  onClose?: () => void
  /** Caller-supplied context label. Never a baked-in shell name. */
  label?: string
  logLines: string[] | null
  logEmptyLabel?: string
  events?: ReactNode
  problems: DockProblem[]
}

const SLOT_LABEL: Record<DockSlot, string> = {
  log: 'Log',
  events: 'Events',
  problems: 'Problems'
}

export function Dock({
  events,
  label,
  logEmptyLabel = 'No log lines',
  logLines,
  onClose,
  onSlotChange,
  problems,
  slot
}: DockProps) {
  const narrow = useMediaQuery(TAB_STRIP_NARROW)
  const count = problems.length
  const tabs = (Object.keys(SLOT_LABEL) as DockSlot[]).map(id => ({
    id,
    label: SLOT_LABEL[id],
    meta: id === 'problems' ? count : undefined
  }))

  return (
    <section
      aria-label="Ops dock"
      className="ops-dock"
      data-terminal="cut"
      style={opsDensityStyle()}
    >
      <header style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
        {narrow ? (
          <ResponsiveTabs onChange={id => onSlotChange(id as DockSlot)} tabs={tabs} value={slot} />
        ) : (
          <div role="tablist">
            {tabs.map(tab => (
              <TextTab active={tab.id === slot} key={tab.id} onClick={() => onSlotChange(tab.id)} role="tab">
                {tab.label}
                {tab.id === 'problems' && (
                  <TextTabMeta data-problems-count={String(count)}>{count}</TextTabMeta>
                )}
              </TextTab>
            ))}
          </div>
        )}
        {label ? <span data-dock-label>{label}</span> : null}
        {onClose && (
          <button aria-label="Close dock" onClick={onClose} type="button">
            <X aria-hidden size={14} />
          </button>
        )}
      </header>
      {slot === 'log' && <LogTail emptyLabel={logEmptyLabel} lines={logLines} />}
      {slot === 'events' && (
        <div data-slot="events">{events ?? <p data-empty="true">No events</p>}</div>
      )}
      {slot === 'problems' && (
        <ul data-slot="problems">
          {problems.length === 0 ? (
            <li data-empty="true">No problems</li>
          ) : (
            problems.map(problem => <li key={problem.id}>{problem.summary}</li>)
          )}
        </ul>
      )}
    </section>
  )
}
