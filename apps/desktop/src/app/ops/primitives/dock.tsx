import '../motion.css'

import type { ReactNode } from 'react'

import { LogTail } from '@/components/chat/log-tail'
import { ResponsiveTabs } from '@/components/ui/tab-dropdown'
import { TextTab, TextTabMeta } from '@/components/ui/text-tab'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useI18n } from '@/i18n'
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
  /** Host's authoritative observation; null means unavailable. */
  problemsCount?: number | null
}

const SLOTS: DockSlot[] = ['log', 'events', 'problems']

export function Dock({
  events,
  label,
  logEmptyLabel,
  logLines,
  onClose,
  onSlotChange,
  problems,
  problemsCount,
  slot
}: DockProps) {
  const narrow = useMediaQuery(TAB_STRIP_NARROW)
  const copy = useI18n().t.ops
  const count = problemsCount === undefined ? problems.length : problemsCount

  const tabs = SLOTS.map(id => ({
    id,
    label: copy.dock.slots[id],
    meta: id === 'problems' ? (count ?? copy.unavailable) : undefined
  }))

  return (
    <section aria-label={copy.dock.label} className="ops-dock" data-terminal="cut" style={opsDensityStyle()}>
      <header style={{ alignItems: 'center', display: 'flex', gap: 8 }}>
        {narrow ? (
          <ResponsiveTabs onChange={id => onSlotChange(id as DockSlot)} tabs={tabs} value={slot} />
        ) : (
          <div role="tablist">
            {tabs.map(tab => (
              <TextTab active={tab.id === slot} key={tab.id} onClick={() => onSlotChange(tab.id)} role="tab">
                {tab.label}
                {tab.id === 'problems' && (
                  <TextTabMeta data-problems-count={count === null ? 'unavailable' : String(count)}>
                    {count ?? copy.unavailable}
                  </TextTabMeta>
                )}
              </TextTab>
            ))}
          </div>
        )}
        {label ? <span data-dock-label>{label}</span> : null}
        {onClose && (
          <button aria-label={copy.dock.close} onClick={onClose} type="button">
            <X aria-hidden size={14} />
          </button>
        )}
      </header>
      {slot === 'log' && <LogTail emptyLabel={logEmptyLabel ?? copy.dock.noLog} lines={logLines} />}
      {slot === 'events' && <div data-slot="events">{events ?? <p data-empty="true">{copy.dock.noEvents}</p>}</div>}
      {slot === 'problems' && (
        <ul data-slot="problems">
          {count === null ? (
            <li data-unavailable="true">{copy.dock.problemsUnavailable}</li>
          ) : problems.length === 0 ? (
            <li data-empty="true">{copy.dock.noProblems}</li>
          ) : (
            problems.map(problem => <li key={problem.id}>{problem.summary}</li>)
          )}
        </ul>
      )}
    </section>
  )
}
