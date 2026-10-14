/** P3: live Ops panels the host injects into OpsShell (the shell itself stays data-free). */
import type { ReactNode } from 'react'

import { BoardContainer } from './board/board-container'
import { CanvasContainer } from './canvas/canvas-container'
import { AgentCardContainer, RunDetailContainer, TaskDetailContainer } from './detail/details'
import { SettingsContainer } from './motion/settings'
import { hostIdentityFromTab, type OpsTab } from './navigation-store'
import { OfficeContainer } from './office/office-container'

/** Live panels need the Desktop preload bridge; without it the shell keeps its honest placeholder. */
export function hasOpsBridge(): boolean {
  const w = (globalThis as { window?: { hermesDesktop?: { api?: unknown } } }).window

  return Boolean(w?.hermesDesktop?.api)
}

export function opsLivePanel(tab: OpsTab, profile: string, onOpenRoute?: (route: string) => void): ReactNode {
  if (!hasOpsBridge()) {
    return null
  }

  if (tab.kind === 'office') {
    return <OfficeContainer />
  }

  // P3 Canvas has no write paths at all (readOnly is the remote badge); the writable Canvas is P5.
  if (tab.kind === 'canvas') {
    return <CanvasContainer profile={profile} />
  }

  // P4 Board: Mine = the scoped profile.
  if (tab.kind === 'board') {
    return <BoardContainer me={profile} />
  }

  // W9 Ops settings is a live lens; other lenses (W12) keep their existing route buttons.
  if (tab.kind === 'lens' && tab.id === 'lens:settings') {
    return <SettingsContainer onOpenRoute={onOpenRoute} profile={profile} />
  }

  const id = hostIdentityFromTab(tab).id

  if (!id) {
    return null
  }

  if (tab.kind === 'profile') {
    return <AgentCardContainer name={id} />
  }

  if (tab.kind === 'task') {
    return <TaskDetailContainer id={id} onOpenRoute={onOpenRoute} />
  }

  if (tab.kind === 'run') {
    return <RunDetailContainer id={id} />
  }

  // Lenses (W12) keep their existing route buttons.
  return null
}