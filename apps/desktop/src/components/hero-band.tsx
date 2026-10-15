import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** B35: one lit hero band for app pages (Cron, Sessions, Settings, Capabilities): icon tile, title, stats, optional sparkline. */
export interface HeroStat {
  label: ReactNode
  tone?: 'bad' | 'good' | 'muted' | 'warn'
  value: ReactNode
}

export function HeroSpark({ label, values }: { label?: ReactNode; values: number[] }) {
  const max = Math.max(1, ...values)

  return (
    <figure className="m-0 flex flex-col items-end gap-1" data-hero-spark="">
      <span aria-hidden className="flex h-8 items-end gap-[3px]">
        {values.map((v, i) => (
          <span className="w-[5px] rounded-sm bg-current opacity-80" data-hero-spark-bar={v ? '' : 'zero'} key={i} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />
        ))}
      </span>
      {label ? <figcaption className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">{label}</figcaption> : null}
    </figure>
  )
}

export function HeroBand({
  actions,
  className,
  icon,
  id,
  spark,
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
  return (
    <section
      className={cn('mb-3 flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-(--ui-stroke-tertiary) px-4 py-3', className)}
      data-hero-band={id}
    >
      {icon ? (
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl text-lg" data-hero-band-icon="">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-medium leading-tight text-foreground" data-hero-band-title="">
          {title}
        </h2>
        {subtitle ? <p className="truncate text-xs text-muted-foreground/80">{subtitle}</p> : null}
      </div>
      {stats?.length ? (
        <dl className="m-0 flex gap-5" data-hero-band-stats="">
          {stats.map((s, i) => (
            <div className="min-w-0" data-tone={s.tone} key={i}>
              <dt className="text-[0.62rem] uppercase tracking-wider text-muted-foreground">{s.label}</dt>
              <dd className="m-0 text-xl font-semibold tabular-nums leading-tight text-foreground" data-hero-band-value="">
                {s.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {spark}
      {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
    </section>
  )
}
