/** P3: live Office/Canvas panels the host injects into OpsShell (the shell itself stays data-free). */
import type { ReactNode } from 'react'

import { CanvasContainer } from './canvas/canvas-container'
import type { OpsTab } from './navigation-store'
import { OfficeContainer } from './office/office-container'

/** Live panels need the Desktop preload bridge; without it the shell keeps its honest placeholder. */
export function hasOpsBridge(): boolean {
  const w = (globalThis as { window?: { hermesDesktop?: { api?: unknown } } }).window

  return Boolean(w?.hermesDesktop?.api)
}

export function opsLivePanel(tab: OpsTab, profile: string): ReactNode {
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

  return null
}