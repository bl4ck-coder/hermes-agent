import type { ReactNode } from 'react'

import { PageHeader } from '@/components/layout/hierarchy'
import { cn } from '@/lib/utils'

/** B35: one lit hero band for app pages (Cron, Sessions, Settings, Capabilities): icon tile, title, stats, optional sparkline. */
export interface HeroStat {
  label: ReactNode
  tone?: 'bad' | 'good' | 'muted' | 'warn'
  value: ReactNode
}

export function HeroSpark({ label, srSummary, values }: { label?: ReactNode; srSummary?: string; values: number[] }) {
  const max = Math.max(1, ...values)

  return (
    <figure className="m-0 flex flex-col items-end gap-1" data-hero-spark="">
      <span aria-hidden className="flex h-8 items-end gap-[3px]">
        {values.map((v, i) => (
          <span className="w-[5px] rounded-sm bg-current opacity-80" data-hero-spark-bar={v ? '' : 'zero'} key={i} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
        ))}
      </span>
      <span className="sr-only">{srSummary ?? values.join(', ')}</span>
      {label ? <figcaption className="text-xs uppercase tracking-wider text-muted-foreground">{label}</figcaption> : null}
    </figure>
  )
}

/** B41: HeroBand is now a PageHeader (hierarchy spec): the first stat becomes the view's ONE PrimaryMetric,
 *  the rest render inline as secondary metrics, and the icon tile / decorative sparkline are dropped. */
export function HeroBand({
  actions,
  className,
  id,
  stats,
  subtitle,
  title
}: {
  actions?: ReactNode
  className?: string
  icon?: ReactNode
  id: string
  spark?: ReactNode
  stats?: HeroStat[]
  subtitle?: ReactNode
  title: ReactNode
}) {
  const [first, ...rest] = stats ?? []

  return (
    <div className={className} data-hero-band={id}>
      <PageHeader
        actions={actions}
        context={subtitle}
        id={id}
        metric={first ? { label: first.label, tone: first.tone, value: first.value } : undefined}
        secondary={rest.map(s => ({ label: s.label, tone: s.tone, value: s.value }))}
        title={title}
      />
    </div>
  )
}
