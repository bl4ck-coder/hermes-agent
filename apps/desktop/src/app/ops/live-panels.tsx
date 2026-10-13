/** P3: live Office/Canvas panels the host injects into OpsShell (the shell itself stays data-free). */
import type { ReactNode } from 'react'

import type { OpsTab } from './navigation-store'
import { OfficeContainer } from './office/office-container'

/** Live panels need the Desktop preload bridge; without it the shell keeps its honest placeholder. */
export function hasOpsBridge(): boolean {
  const w = (globalThis as { window?: { hermesDesktop?: { api?: unknown } } }).window

  return Boolean(w?.hermesDesktop?.api)
}

export function opsLivePanel(tab: OpsTab, profile: string): ReactNode {
  void profile

  if (!hasOpsBridge()) {
    return null
  }

  if (tab.kind === 'office') {
    return <OfficeContainer />
  }

  return null
}