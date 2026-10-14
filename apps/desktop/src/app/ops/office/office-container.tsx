/** Office container (ops-panel P3-02): wires OfficeView to the P3-01 client and feed. */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { createOpsActions, type OpsActions } from '../feed/ops-actions'
import { createOpsClient, type OpsClient, parseDispatch } from '../feed/ops-client'
import { OPS_POLL_MS, useOpsFeed } from '../feed/ops-feed'

import { OfficeView } from './office'

type Loaded<T> = T | null

export function listOrNull<T>(v: T[] | null | undefined): T[] | null {
  return Array.isArray(v) ? v : null
}

export function useOpsResource<T>(load: () => Promise<T>, deps: unknown[], pollMs = OPS_POLL_MS) {
  const [value, setValue] = useState<Loaded<T>>(null)
  const [error, setError] = useState<unknown>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true

    load().then(
      v => live && (setValue(v), setError(null)),
      e => live && setError(e)
    )
    const t = setTimeout(() => setTick(n => n + 1), pollMs)

    return () => {
      live = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { value, error, reload: () => setTick(n => n + 1) }
}

export function OfficeContainer({
  readOnly = false,
  client: clientProp,
  actions: actionsProp,
  onOpenProfile,
  onOpenTask
}: {
  readOnly?: boolean
  client?: OpsClient
  actions?: OpsActions
  onOpenProfile?: (p: string) => void
  onOpenTask?: (taskId: string) => void
}) {
  const client = useMemo(() => clientProp ?? createOpsClient(), [clientProp])
  const actions = useMemo(() => actionsProp ?? createOpsActions(), [actionsProp])
  const feed = useOpsFeed(null, client)
  const pending = useOpsResource(() => client.pendingApprovals(), [client])
  const usage = useOpsResource(() => client.usageToday(), [client])
  const cron = useOpsResource(() => client.cronJobs(), [client])
  const board = useOpsResource(() => client.board(), [client])
  const activity = useOpsResource(() => client.resolvedApprovals(), [client])
  const [nowS, setNowS] = useState(() => Date.now() / 1000)

  useEffect(() => {
    const t = setInterval(() => setNowS(Date.now() / 1000), 1000)

    return () => clearInterval(t)
  }, [])

  // Malformed or partial payloads render as unknown (null), never as an empty, healthy-looking list.
  const inFlight = Array.isArray(board.value?.columns)
    ? board.value.columns.filter(c => c.name === 'running').flatMap(c => (Array.isArray(c.tasks) ? c.tasks : []))
    : null

  const approve = useCallback(
    async (item: Parameters<OpsClient['approve']>[0]) => {
      await client.approve(item, 'once')
      pending.reload()
    },
    [client, pending]
  )

  const dispatch = useCallback(
    async (text: string) => {
      const { assignee, title } = parseDispatch(text)
      await client.dispatch(title, assignee)
      board.reload()
    },
    [client, board]
  )

  return (
    <OfficeView
      activity={listOrNull(activity.value?.items)}
      cron={listOrNull(cron.value)}
      fleet={Array.isArray(feed.fleet?.profiles) ? feed.fleet : null}
      fleetError={feed.error}
      inFlight={inFlight}
      nowS={nowS}
      onApprove={approve}
      onCronRun={async id => (await actions.cronTrigger(id), cron.reload())}
      onDispatch={dispatch}
      onKanban={async a => (await actions.kanban(a), pending.reload(), board.reload())}
      onOpenProfile={onOpenProfile}
      onOpenTask={onOpenTask}
      pending={listOrNull(pending.value?.items)}
      readOnly={readOnly}
      usage={usage.value}
    />
  )
}
