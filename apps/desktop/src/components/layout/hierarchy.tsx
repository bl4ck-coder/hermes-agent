import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/**
 * B41: the four shared layout primitives from the hierarchy spec (judge-spec-hierarchy.txt).
 * Every screen builds its top-level structure from these; the look lives in styles/hierarchy.css tokens.
 * - PageHeader: title + one-line context, at most 2 actions, optional PrimaryMetric, no frame.
 * - Section: title + optional hint + body, separated by space, not boxes.
 * - PrimaryMetric: the ONE dominant number/state of a view. Unknown is named, never shown as 0.
 * - Row: lead (icon/avatar) + title/secondary + trailing meta/action.
 */
export type HxTone = 'bad' | 'good' | 'muted' | 'warn'

export interface PrimaryMetricProps {
  label: ReactNode
  note?: ReactNode
  tone?: HxTone
  value: ReactNode
}

export function PrimaryMetric({ label, note, tone, value }: PrimaryMetricProps) {
  return (
    <div className="hx-metric" data-hx="metric" data-tone={tone}>
      <div className="hx-metric-value text-foreground" data-hx-metric-value="">
        {value}
      </div>
      <div className="hx-metric-label text-muted-foreground">{label}</div>
      {note ? <div className="hx-metric-note text-muted-foreground">{note}</div> : null}
    </div>
  )
}

export interface SecondaryMetric {
  label: ReactNode
  tone?: HxTone
  value: ReactNode
}

export function PageHeader({
  actions,
  className,
  context,
  id,
  metric,
  secondary,
  title
}: {
  actions?: ReactNode
  className?: string
  context?: ReactNode
  id?: string
  metric?: PrimaryMetricProps
  secondary?: SecondaryMetric[]
  title: ReactNode
}) {
  return (
    <header className={cn('hx-page-header', className)} data-hx="page-header" data-hx-id={id}>
      <div className="hx-page-header-main">
        <div className="min-w-0">
          <h2 className="hx-page-title text-foreground">{title}</h2>
          {context ? <p className="hx-page-context text-muted-foreground">{context}</p> : null}
        </div>
        {actions ? <div className="hx-page-actions">{actions}</div> : null}
      </div>
      {metric || secondary?.length ? (
        <div className="hx-page-metrics">
          {metric ? <PrimaryMetric {...metric} /> : null}
          {secondary?.length ? (
            <dl className="hx-secondary">
              {secondary.map((s, i) => (
                <div data-tone={s.tone} key={i}>
                  <dt className="text-muted-foreground">{s.label}</dt>
                  <dd className="text-foreground">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}
    </header>
  )
}

export function Section({
  actions,
  children,
  className,
  hint,
  id,
  title
}: {
  actions?: ReactNode
  children: ReactNode
  className?: string
  hint?: ReactNode
  id?: string
  title?: ReactNode
}) {
  return (
    <section className={cn('hx-section', className)} data-hx="section" data-hx-id={id}>
      {title || actions ? (
        <div className="hx-section-head">
          <div className="min-w-0">
            {title ? <h3 className="hx-section-title text-foreground">{title}</h3> : null}
            {hint ? <p className="hx-section-hint text-muted-foreground">{hint}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function Row({
  active,
  className,
  lead,
  onClick,
  secondary,
  title,
  trailing
}: {
  active?: boolean
  className?: string
  lead?: ReactNode
  onClick?: () => void
  secondary?: ReactNode
  title: ReactNode
  trailing?: ReactNode
}) {
  const body = (
    <>
      {lead ? <span className="hx-row-lead">{lead}</span> : null}
      <span className="hx-row-main">
        <span className="hx-row-title text-foreground">{title}</span>
        {secondary ? <span className="hx-row-secondary text-muted-foreground">{secondary}</span> : null}
      </span>
      {trailing ? <span className="hx-row-trailing text-muted-foreground">{trailing}</span> : null}
    </>
  )
  const cls = cn('hx-row', active && 'bg-(--ui-row-active-background)', className)

  return onClick ? (
    <button className={cls} data-active={active ? '' : undefined} data-hx="row" data-two-line={secondary ? '' : undefined} onClick={onClick} type="button">
      {body}
    </button>
  ) : (
    <div className={cls} data-active={active ? '' : undefined} data-hx="row" data-two-line={secondary ? '' : undefined}>
      {body}
    </div>
  )
}
