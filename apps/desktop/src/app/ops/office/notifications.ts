/** R54 (P8 b5): opt-in OS notifications for new approvals and newly blocked tasks. */
import { useEffect, useState } from 'react'

import { newIds, opsNotify } from '../feed/diag'
import { P, T } from '../main-i18n'

/** Reads the Settings prefs directly (no import of the Settings module: it imports the Office container). */
function prefs(): { notifyApprovals?: boolean; notifyBlocked?: boolean } {
  try {
    return JSON.parse(globalThis.localStorage?.getItem('hermes.ops.prefs') ?? '{}') ?? {}
  } catch {
    return {}
  }
}

export function useOpsNotifications(approvalIds: string[] | null, blocked: { id: string; title: string }[] | null) {
  const [seenA, setSeenA] = useState<Set<string> | null>(null)
  const [seenB, setSeenB] = useState<Set<string> | null>(null)
  const aKey = approvalIds?.join('\0') ?? null
  const bKey = blocked?.map(t => t.id).join('\0') ?? null

  useEffect(() => {
    if (!approvalIds) {
      return
    }

    const fresh = newIds(seenA, approvalIds.filter(Boolean))

    if (fresh.length && prefs().notifyApprovals === true) {
      opsNotify(T('Approval waiting'), fresh.length === 1 ? T('An agent is waiting for your approval.') : P(fresh.length, '{n} approvals are waiting.'))
    }

    setSeenA(new Set(approvalIds))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aKey])

  useEffect(() => {
    if (!blocked) {
      return
    }

    const fresh = newIds(seenB, blocked.map(t => t.id))

    if (fresh.length && prefs().notifyBlocked === true) {
      const first = blocked.find(t => t.id === fresh[0])
      opsNotify(T('Task blocked'), fresh.length === 1 ? T('{title} is blocked.').replace('{title}', String(first?.title ?? fresh[0])) : P(fresh.length, '{n} tasks became blocked.'))
    }

    setSeenB(new Set(blocked.map(t => t.id)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bKey])
}
