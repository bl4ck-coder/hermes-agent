import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react'

import { ErrorBoundary } from '@/components/error-boundary'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/i18n'
import type { OpsStateCopy } from '@/i18n/types_ops_states'

/** W10 states. `ready` renders content only; every other kind carries its own copy. */
export type OpsStateKind = 'ready' | 'empty' | 'loading' | 'reconnecting' | 'stale' | 'exhausted' | 'auth' | 'capability'

export type OpsFailureClass = 'auth' | 'capability' | 'transient'

export const OPS_DEFAULT_MAX_RETRIES = 3
export const OPS_RETRY_CEILING = 5

export const clampOpsRetries = (max: number | undefined): number => {
  const n = Number.isFinite(max) ? Math.floor(max as number) : OPS_DEFAULT_MAX_RETRIES

  return Math.min(OPS_RETRY_CEILING, Math.max(1, n))
}

const statusOf = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  const record = error as { status?: unknown; statusCode?: unknown; response?: { status?: unknown } }
  const raw = record.status ?? record.statusCode ?? record.response?.status

  return typeof raw === 'number' ? raw : undefined
}

/** 401/403 are authentication; an explicit missing capability (or 501) is not transient. */
export function classifyOpsFailure(error: unknown): OpsFailureClass {
  const status = statusOf(error)

  if (status === 401 || status === 403) {
    return 'auth'
  }

  if (error && typeof error === 'object') {
    const record = error as { capability?: unknown; code?: unknown }

    if (typeof record.capability === 'string' || record.code === 'capability_missing') {
      return 'capability'
    }
  }

  return status === 501 ? 'capability' : 'transient'
}

export interface OpsStateInput {
  /** A request is in flight. With a snapshot this is a silent background refresh. */
  loading?: boolean
  error?: unknown
  /** A last good snapshot exists and is rendered as children. */
  hasSnapshot?: boolean
  /** The source answered with zero items. */
  empty?: boolean
  /** The snapshot is older than its freshness budget. */
  stale?: boolean
  /** Failed attempts so far for the current error streak. */
  attempt?: number
  maxRetries?: number
}

export function resolveOpsState({
  loading = false,
  error,
  hasSnapshot = false,
  empty = false,
  stale = false,
  attempt = 0,
  maxRetries
}: OpsStateInput): OpsStateKind {
  if (error != null) {
    const failure = classifyOpsFailure(error)

    if (failure !== 'transient') {
      return failure
    }

    return attempt >= clampOpsRetries(maxRetries) ? 'exhausted' : 'reconnecting'
  }

  if (loading && !hasSnapshot) {
    return 'loading'
  }

  if (stale && hasSnapshot) {
    return 'stale'
  }

  if (empty) {
    return 'empty'
  }

  return 'ready'
}

/** Bounded manual/automatic retry: `retry` runs at most `max` times until `reset`. */
export function useOpsBoundedRetry(run: () => void, max?: number) {
  const limit = clampOpsRetries(max)
  const runRef = useRef(run)
  const attemptRef = useRef(0)
  const [attempt, setAttempt] = useState(0)

  runRef.current = run

  const retry = useCallback(() => {
    if (attemptRef.current >= limit) {
      return false
    }

    attemptRef.current += 1
    setAttempt(attemptRef.current)
    runRef.current()

    return true
  }, [limit])

  const reset = useCallback(() => {
    attemptRef.current = 0
    setAttempt(0)
    runRef.current()
  }, [])

  return { attempt, exhausted: attempt >= limit, limit, reset, retry }
}

const OpsWritesContext = createContext(false)

/** Future mutations read this; it is true only for a current (`ready`) view that opted in. */
export const useOpsWritesEnabled = () => useContext(OpsWritesContext)

export interface OpsStateFrameProps extends OpsStateInput {
  /** Stable id used in data attributes and the boundary label. */
  id: string
  label: string
  /** Endpoint or store that produced the data, e.g. `GET /api/status`. */
  source?: string
  /** Last successful observation (epoch ms or Date). */
  updatedAt?: number | Date | null
  /** Missing capability name for the `capability` state. */
  capability?: string
  /** Explicit override when the caller already resolved the state. */
  state?: OpsStateKind
  /** Writes stay disabled unless the caller opts in and the view is ready. */
  writable?: boolean
  onRetry?: () => void
  onReset?: () => void
  onReauth?: () => void
  onCapabilityHelp?: () => void
  className?: string
  children?: ReactNode
}

type Variant = 'section' | 'node'

const formatTime = (value: number | Date, locale: string) => {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(value)
  } catch {
    return new Date(value).toISOString()
  }
}

function StateNotice({
  variant,
  id,
  kind,
  copy,
  meta,
  onAction,
  actionDisabled
}: {
  variant: Variant
  id: string
  kind: OpsStateKind | 'crashed'
  copy: OpsStateCopy
  meta: string[]
  onAction?: () => void
  actionDisabled?: boolean
}) {
  return (
    <div
      className={variant === 'node' ? 'ops-state-notice ops-state-notice--node' : 'ops-state-notice'}
      data-ops-state-notice={kind}
      id={`${id}-state`}
      role="status"
    >
      <p className="ops-state-notice__title" data-ops-state-title="">
        {copy.title}
      </p>
      <p className="ops-state-notice__explanation" data-ops-state-explanation="">
        {copy.explanation}
      </p>
      <p className="ops-state-notice__meta" data-ops-state-meta="">
        {meta.join(' · ')}
      </p>
      <Button
        data-ops-state-action={kind}
        disabled={actionDisabled || !onAction}
        onClick={onAction}
        size="sm"
        type="button"
        variant="outline"
      >
        {copy.action}
      </Button>
    </div>
  )
}

function Shimmer({ variant }: { variant: Variant }) {
  const rows = variant === 'node' ? 2 : 3

  return (
    <div aria-hidden="true" className="ops-state-skeleton" data-ops-shimmer="gold-night">
      {Array.from({ length: rows }, (_, index) => (
        <div
          className="shimmer-bg shimmer-color-[#e8c77a] h-3 rounded bg-[#1f1b14]"
          key={index}
          style={{ width: `${100 - index * 22}%` }}
        />
      ))}
    </div>
  )
}

/** Shared W10 frame. Children stay mounted at a stable position so focus and scroll survive state changes. */
export function OpsStateFrame({ variant, ...props }: OpsStateFrameProps & { variant: Variant }) {
  const { t, locale } = useI18n()
  const copy = t.opsStates
  const kind = props.state ?? resolveOpsState(props)
  const max = clampOpsRetries(props.maxRetries)
  const showContent = kind === 'ready' || (props.hasSnapshot === true && kind !== 'auth' && kind !== 'capability')
  const writes = props.writable === true && kind === 'ready'

  const meta = [
    props.source ? copy.source(props.source) : copy.sourceUnknown,
    props.updatedAt != null ? copy.updated(formatTime(props.updatedAt, locale)) : copy.neverUpdated
  ]

  if (kind === 'reconnecting' || kind === 'exhausted') {
    meta.push(copy.attempt(Math.min(props.attempt ?? 0, max), max))
  }

  if (kind === 'capability' && props.capability) {
    meta.push(copy.capabilityName(props.capability))
  }

  if (!writes) {
    meta.push(copy.writesDisabled)
  }

  const action: Partial<Record<OpsStateKind, (() => void) | undefined>> = {
    empty: props.onRetry,
    loading: props.onRetry,
    reconnecting: props.onRetry,
    stale: props.onRetry,
    exhausted: props.onReset ?? props.onRetry,
    auth: props.onReauth,
    capability: props.onCapabilityHelp
  }

  const Tag = variant === 'section' ? 'section' : 'div'

  return (
    <Tag
      aria-busy={kind === 'loading' || kind === 'reconnecting'}
      aria-describedby={kind === 'ready' ? undefined : `${props.id}-state`}
      aria-label={props.label}
      className={props.className}
      data-ops-node-state={variant === 'node' ? kind : undefined}
      data-ops-section-state={variant === 'section' ? kind : undefined}
      data-ops-state-id={props.id}
      data-ops-writes={writes ? 'enabled' : 'disabled'}
      role={variant === 'node' ? 'group' : undefined}
    >
      {kind !== 'ready' && (
        <StateNotice
          copy={copy[kind]}
          id={props.id}
          kind={kind}
          meta={meta}
          onAction={action[kind]}
          variant={variant}
        />
      )}
      {kind === 'loading' && <Shimmer variant={variant} />}
      {showContent && (
        <div className="ops-state-body" data-ops-state-body="">
          <OpsWritesContext.Provider value={writes}>
            <ErrorBoundary
              fallback={({ reset }) => (
                <StateNotice
                  copy={copy.crashed}
                  id={`${props.id}-crash`}
                  kind="crashed"
                  meta={meta}
                  onAction={reset}
                  variant={variant}
                />
              )}
              label={`ops-${variant}:${props.id}`}
            >
              {props.children}
            </ErrorBoundary>
          </OpsWritesContext.Provider>
        </div>
      )}
    </Tag>
  )
}

/** W10 section wrapper: independent empty/loading/reconnecting/stale/exhausted/auth/capability states. */
export function OpsSectionState(props: OpsStateFrameProps) {
  return <OpsStateFrame {...props} variant="section" />
}
