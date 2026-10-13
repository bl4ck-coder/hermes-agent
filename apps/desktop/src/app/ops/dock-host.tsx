/**
 * Ops dock host. Log reuses Desktop LogTail. Events and Problems render only
 * what the caller supplied. Interactive terminal stays cut (O64).
 */

import type { ReactNode } from 'react'

import { LogTail } from '@/components/chat/log-tail'

import { type DockSlot } from './navigation-store'

export interface DockProblem {
  id: string
  summary: string
}

export interface DockHostProps {
  open: boolean
  slot: DockSlot
  label?: string
  logLines: string[] | null
  problems: DockProblem[]
  events?: ReactNode
  onSlot: (slot: DockSlot) => void
  onClose: () => void
}

const SLOTS: DockSlot[] = ['log', 'events', 'problems']

export function DockHost({ events, label, logLines, onClose, onSlot, open, problems, slot }: DockHostProps) {
  if (!open) {
    return null
  }

  return (
    <section aria-label="Ops dock" data-ops-dock="" data-ops-dock-slot={slot} data-terminal="cut">
      <div role="tablist">
        {SLOTS.map(id => (
          <button
            aria-selected={id === slot}
            data-ops-dock-tab={id}
            key={id}
            onClick={() => onSlot(id)}
            role="tab"
            type="button"
          >
            {id === 'log' ? 'Log' : id === 'events' ? 'Events' : `Problems (${problems.length})`}
          </button>
        ))}
        {label ? <span data-dock-label="">{label}</span> : null}
        <button aria-label="Close dock" data-ops-dock-close="" onClick={onClose} type="button">
          ×
        </button>
      </div>
      {slot === 'log' ? <LogTail emptyLabel="No log lines" lines={logLines} /> : null}
      {slot === 'events' ? <div data-ops-dock-events="">{events ?? 'No events'}</div> : null}
      {slot === 'problems' ? (
        <ul data-ops-dock-problems="">
          {problems.length === 0 ? <li data-ops-dock-problems-empty="">No problems</li> : null}
          {problems.map(problem => (
            <li data-ops-problem={problem.id} key={problem.id}>
              {problem.summary}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
