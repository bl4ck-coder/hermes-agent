import '../motion.css'

import type { ReactNode, WheelEvent } from 'react'
import { useState } from 'react'

import { useI18n } from '@/i18n'

import { opsDensityStyle } from './data-table'

/** G49. Gold changed, amber unset, garnet policy, champagne ok. */
export const PORT_COLOR = {
  changed: '#C9A55A',
  unset: '#D4893A',
  policy: '#B4533C',
  ok: '#CDBB98'
} as const

export type PortState = keyof typeof PORT_COLOR

export interface NodeCardProps {
  title: string
  port?: PortState
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /** Keyboard-reachable. Revealed on hover or focus. Never covered by the pan overlay. */
  onEdit?: () => void
  editLabel?: string
  controls?: ReactNode
  children?: ReactNode
}

export function NodeCard({
  children,
  collapsed,
  controls,
  defaultCollapsed = false,
  editLabel,
  onCollapsedChange,
  onEdit,
  port = 'ok',
  title
}: NodeCardProps) {
  const copy = useI18n().t.ops
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed)
  const [revealed, setRevealed] = useState(false)
  const isCollapsed = collapsed === undefined ? internalCollapsed : collapsed

  const setCollapsed = (next: boolean) => {
    if (collapsed === undefined) {
      setInternalCollapsed(next)
    }

    onCollapsedChange?.(next)
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.stopPropagation()
  }

  return (
    <article
      className="ops-node"
      data-collapsed={isCollapsed ? 'true' : 'false'}
      data-edge={port === 'unset' ? 'dashed' : 'solid'}
      data-port={port}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setRevealed(false)
        }
      }}
      onFocus={() => setRevealed(true)}
      onMouseEnter={() => setRevealed(true)}
      onMouseLeave={event => {
        const active = event.currentTarget.ownerDocument.activeElement

        if (!event.currentTarget.contains(active)) {
          setRevealed(false)
        }
      }}
      style={{ ...opsDensityStyle(), position: 'relative' }}
    >
      <header style={{ alignItems: 'center', display: 'flex', gap: 8, height: 28 }}>
        <button
          aria-expanded={!isCollapsed}
          onClick={() => setCollapsed(!isCollapsed)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              setCollapsed(!isCollapsed)
            }
          }}
          type="button"
        >
          {title}
        </button>
        <span
          aria-label={copy.node.port(port)}
          data-port-color={PORT_COLOR[port]}
          role="img"
          style={{
            backgroundColor: PORT_COLOR[port],
            borderRadius: '50%',
            display: 'inline-block',
            height: 8,
            width: 8
          }}
        />
      </header>
      {!isCollapsed && (
        <div className="ops-node__body" style={{ position: 'relative' }}>
          <div
            aria-hidden="true"
            data-pan-overlay
            style={{ inset: 0, pointerEvents: 'none', position: 'absolute', zIndex: 0 }}
          />
          <div
            data-scroll="internal"
            onWheel={onWheel}
            style={{
              maxHeight: 160,
              overflow: 'auto',
              overscrollBehavior: 'contain',
              position: 'relative',
              zIndex: 1
            }}
          >
            {children}
          </div>
          <div
            data-overlay-intercept="false"
            data-revealed={revealed ? 'true' : 'false'}
            style={{ pointerEvents: 'auto', position: 'relative', zIndex: 2 }}
          >
            {onEdit && (
              <button
                data-revealed={revealed ? 'true' : 'false'}
                onClick={onEdit}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onEdit()
                  }
                }}
                style={{ opacity: revealed ? 1 : 0 }}
                type="button"
              >
                {editLabel ?? copy.node.edit}
              </button>
            )}
            {controls}
          </div>
        </div>
      )}
    </article>
  )
}
