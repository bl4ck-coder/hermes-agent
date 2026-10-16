/**
 * Ops dock host. The bottom dock reuses the P0.5-03 Dock primitive (LogTail,
 * events, problems). It spans the pane and anchors to the bottom. It is not a
 * right column. Interactive terminal stays cut (O64).
 */

import { useStore } from '@nanostores/react'
import type { ReactNode } from 'react'

import { $opsProblemsCount } from './chrome'
import { useOpsEscapeLayer } from './keymap'
import { type DockSlot } from './navigation-store'
import { Dock, type DockProblem } from './primitives/dock'

export type { DockProblem }

export interface DockHostProps {
  active?: boolean
  open: boolean
  slot: DockSlot
  label?: string
  logLines: string[] | null
  problems: DockProblem[]
  events?: ReactNode
  onSlot: (slot: DockSlot) => void
  onClose: () => void
}

export function DockHost({
  active = true,
  events,
  label,
  logLines,
  onClose,
  onSlot,
  open,
  problems,
  slot
}: DockHostProps) {
  const problemsCount = useStore($opsProblemsCount)
  useOpsEscapeLayer(active && open, onClose)

  if (!open) {
    return null
  }

  return (
    <div
      data-ops-dock=""
      data-ops-dock-anchor="bottom"
      data-ops-dock-slot={slot}
      style={{
        alignSelf: 'stretch',
        boxSizing: 'border-box',
        flex: '0 0 auto',
        left: 0,
        position: 'relative',
        width: '100%'
      }}
    >
      <Dock
        events={events}
        label={label}
        logLines={logLines}
        onClose={onClose}
        onSlotChange={onSlot}
        problems={problems}
        problemsCount={problemsCount}
        slot={slot}
      />
    </div>
  )
}
