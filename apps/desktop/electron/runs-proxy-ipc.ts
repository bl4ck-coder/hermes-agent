/**
 * runs-proxy-ipc.ts
 *
 * IPC surface for the `/v1/runs/*` proxy, the remote-key keychain store, and the
 * Ops SSE bridge (ops-panel P1-06). The renderer gets results and events only;
 * no handler ever returns a key or a session token. Subscriptions are owned by
 * the sender and torn down when its webContents is destroyed.
 */

import { followOpsSse, type OpsSseOpenRequest, type ServeTarget } from './ops-sse-bridge'
import type { RunKeyStore } from './run-key-store'
import type { RunsProxy, RunsTargetRef, RunsTransport, SseEvent } from './runs-proxy'

export const RUNS_IPC = {
  get: 'hermes:runs:get',
  create: 'hermes:runs:create',
  approve: 'hermes:runs:approve',
  steer: 'hermes:runs:steer',
  stop: 'hermes:runs:stop',
  clarify: 'hermes:runs:clarify',
  resolveUnknown: 'hermes:runs:resolve-unknown',
  eventsOpen: 'hermes:runs:events:open',
  eventsClose: 'hermes:runs:events:close',
  event: 'hermes:runs:event',
  keySet: 'hermes:runs:remoteKey:set',
  keyStatus: 'hermes:runs:remoteKey:status',
  keyClear: 'hermes:runs:remoteKey:clear',
  opsSseOpen: 'hermes:ops:sse:open',
  opsSseClose: 'hermes:ops:sse:close',
  opsSseEvent: 'hermes:ops:sse:event'
} as const

interface SenderLike {
  id: number
  send: (channel: string, payload: unknown) => void
  isDestroyed?: () => boolean
  once?: (event: 'destroyed', cb: () => void) => void
}

interface IpcMainLike {
  handle: (channel: string, fn: (event: { sender: SenderLike }, ...args: any[]) => unknown) => void
}

export interface RunsIpcDeps {
  ipcMain: IpcMainLike
  proxy: RunsProxy
  keyStore: RunKeyStore
  transport: RunsTransport
  resolveServeTarget: (profile: string | null) => Promise<ServeTarget>
}

const refOf = (raw: any): RunsTargetRef => ({
  connectionId: typeof raw?.connectionId === 'string' ? raw.connectionId : null,
  profile: typeof raw?.profile === 'string' ? raw.profile : null
})

export function registerRunsProxyIpc({ ipcMain, proxy, keyStore, transport, resolveServeTarget }: RunsIpcDeps) {
  const subs = new Map<string, { owner: number; close: () => void }>()
  const watched = new Set<number>()
  let seq = 0

  const track = (sender: SenderLike, close: () => void): string => {
    const id = `sub-${++seq}`
    subs.set(id, { owner: sender.id, close })

    if (!watched.has(sender.id) && sender.once) {
      watched.add(sender.id)
      sender.once('destroyed', () => {
        watched.delete(sender.id)

        for (const [sid, sub] of subs) {
          if (sub.owner === sender.id) {
            sub.close()
            subs.delete(sid)
          }
        }
      })
    }

    return id
  }

  const safeSend = (sender: SenderLike, channel: string, payload: unknown) => {
    if (!sender.isDestroyed?.()) {
      sender.send(channel, payload)
    }
  }

  const closeOwned = (sender: SenderLike, id: unknown) => {
    const sub = subs.get(String(id))

    if (sub && sub.owner === sender.id) {
      sub.close()
      subs.delete(String(id))

      return true
    }

    return false
  }

  ipcMain.handle(RUNS_IPC.get, (_e, ref, runId) => proxy.getRun(refOf(ref), String(runId)))
  ipcMain.handle(RUNS_IPC.create, (_e, ref, body) => proxy.createRun(refOf(ref), body))
  ipcMain.handle(RUNS_IPC.approve, (_e, ref, runId, body) => proxy.approve(refOf(ref), String(runId), body))
  ipcMain.handle(RUNS_IPC.steer, (_e, ref, runId, body) => proxy.steer(refOf(ref), String(runId), body))
  ipcMain.handle(RUNS_IPC.stop, (_e, ref, runId) => proxy.stop(refOf(ref), String(runId)))
  ipcMain.handle(RUNS_IPC.clarify, (_e, ref, runId, body) => proxy.clarify(refOf(ref), String(runId), body))
  ipcMain.handle(RUNS_IPC.resolveUnknown, (_e, ref, runId, body) => proxy.resolveUnknown(refOf(ref), String(runId), body))

  ipcMain.handle(RUNS_IPC.eventsOpen, (event, ref, runId, opts) => {
    let id = ''
    let ended = false

    const handle = proxy.openEvents(
      refOf(ref),
      String(runId),
      { lastEventId: typeof opts?.lastEventId === 'string' ? opts.lastEventId : null },
      (ev: SseEvent) => safeSend(event.sender, RUNS_IPC.event, { subscriptionId: id, type: 'event', ...ev }),
      reason => {
        ended = true
        subs.delete(id)
        safeSend(event.sender, RUNS_IPC.event, { subscriptionId: id, type: 'end', ...reason })
      }
    )

    id = ended ? 'ended' : track(event.sender, handle.close)

    return { subscriptionId: id, ended }
  })
  ipcMain.handle(RUNS_IPC.eventsClose, (event, id) => closeOwned(event.sender, id))

  ipcMain.handle(RUNS_IPC.keySet, (_e, connectionId, baseUrl, key) => {
    keyStore.set(String(connectionId), String(baseUrl), String(key))

    return keyStore.status(String(connectionId))
  })
  ipcMain.handle(RUNS_IPC.keyStatus, (_e, connectionId) => keyStore.status(String(connectionId)))
  ipcMain.handle(RUNS_IPC.keyClear, (_e, connectionId) => {
    keyStore.clear(String(connectionId))

    return keyStore.status(String(connectionId))
  })

  ipcMain.handle(RUNS_IPC.opsSseOpen, (event, request: OpsSseOpenRequest) => {
    let id = ''
    let ended = false

    const handle = followOpsSse({
      request,
      resolveTarget: resolveServeTarget,
      transport,
      onEvent: ev => safeSend(event.sender, RUNS_IPC.opsSseEvent, { subscriptionId: id, type: 'event', ...ev }),
      onEnd: reason => {
        ended = true
        subs.delete(id)
        safeSend(event.sender, RUNS_IPC.opsSseEvent, { subscriptionId: id, type: 'end', ...reason })
      }
    })

    id = ended ? 'ended' : track(event.sender, handle.close)

    return { subscriptionId: id, ended }
  })
  ipcMain.handle(RUNS_IPC.opsSseClose, (event, id) => closeOwned(event.sender, id))

  return { activeSubscriptions: () => subs.size }
}
