/** P3: live Ops panels the host injects into OpsShell (the shell itself stays data-free). */
import type { ReactNode } from 'react'

import { BoardContainer } from './board/board-container'
import { CanvasContainer } from './canvas/canvas-container'
import { AgentCardContainer, RunDetailContainer } from './detail/details'
import { TaskTabContainer } from './detail/task-tab'
import { AgentsLens, ChannelsLens, SkillsLens } from './lenses/b4-lenses'
import { ActivityLens, ProjectsLens, RunsLens, TemplatesLens } from './lenses/lenses'
import { SettingsContainer } from './motion/settings'
import { hostIdentityFromTab, type OpsTab } from './navigation-store'
import { OfficeContainer } from './office/office-container'

/** Live panels need the Desktop preload bridge; without it the shell keeps its honest placeholder. */
export function hasOpsBridge(): boolean {
  const w = (globalThis as { window?: { hermesDesktop?: { api?: unknown } } }).window

  return Boolean(w?.hermesDesktop?.api)
}

export function opsLivePanel(
  tab: OpsTab,
  profile: string,
  onOpenRoute?: (route: string) => void,
  connectionId = 'local'
): ReactNode {
  if (!hasOpsBridge()) {
    return null
  }

  if (tab.kind === 'office') {
    // B9: Office showed "unknown connection" because the host never passed the connection it scopes.
    return <OfficeContainer connectionLabel={connectionId} onOpenRoute={onOpenRoute} profile={profile} />
  }

  // P3 Canvas has no write paths at all (readOnly is the remote badge); the writable Canvas is P5.
  if (tab.kind === 'canvas') {
    return <CanvasContainer onOpenRoute={onOpenRoute} profile={profile} />
  }

  // P4 Board: Mine = the scoped profile.
  if (tab.kind === 'board') {
    return <BoardContainer connection={connectionId} me={profile} onOpenRoute={onOpenRoute} />
  }

  // W9 Ops settings is a live lens; other lenses (W12) keep their existing route buttons.
  if (tab.kind === 'lens' && tab.id === 'lens:settings') {
    return <SettingsContainer onOpenRoute={onOpenRoute} profile={profile} />
  }

  // P7 F3: live lenses. Task/run links go through the host's route handler (Desktop kanban route).
  if (tab.kind === 'lens') {
    const openTask = onOpenRoute ? (id: string) => onOpenRoute(`/kanban?task=${encodeURIComponent(id)}`) : undefined

    switch (tab.id) {
      case 'lens:runs':
        return <RunsLens onOpenTask={openTask} />

      case 'lens:projects':
        return <ProjectsLens onOpenBoard={onOpenRoute ? id => onOpenRoute(`/kanban?project=${encodeURIComponent(id)}`) : undefined} />

      case 'lens:templates':
        return <TemplatesLens onOpenRoute={onOpenRoute} profile={profile} />

      case 'lens:agents':
        return <AgentsLens onOpenRoute={onOpenRoute} />

      case 'lens:skills':
        return <SkillsLens onOpenRoute={onOpenRoute} profile={profile} />

      case 'lens:channels':
        return <ChannelsLens onOpenRoute={onOpenRoute} profile={profile} />

      case 'lens:activity':
        return <ActivityLens onOpenTask={openTask} />
    }
  }

  const id = hostIdentityFromTab(tab).id

  if (!id) {
    return null
  }

  if (tab.kind === 'profile') {
    return <AgentCardContainer name={id} />
  }

  if (tab.kind === 'task') {
    return <TaskTabContainer id={id} onOpenRoute={onOpenRoute} />
  }

  if (tab.kind === 'run') {
    return <RunDetailContainer id={id} onOpenRoute={onOpenRoute} />
  }

  // Lenses (W12) keep their existing route buttons.
  return null
}