// Focus-owned Ops keymap. Desktop keeps every chord outside [data-ops-root].
// This module does not register a contributed keybind and does not approve.

import { openCommandPalettePage } from '@/store/command-palette'
import { isEditableTarget, IS_MAC, OVERLAY_SURFACE } from '@/lib/keybinds/combo'

export const OPS_ROOT = '[data-ops-root]'
export const OPS_PALETTE_PAGE = 'ops'
export const OPS_LAYER_PRIORITY = 15
export const OPS_FULLSCREEN_PRIORITY = 5
export const G_LEADER_MS = 1000
export const MODEL_EDIT_UNAVAILABLE = 'Editing unavailable until A5/A6'
export const MUTATION_UNAVAILABLE = 'Unavailable until A5/A6 writes exist'

export const OPS_SHORTCUTS = [
  { chord: 'G O', action: 'Office' },
  { chord: 'G C', action: 'Canvas' },
  { chord: 'G B', action: 'Board' },
  { chord: 'G R', action: 'Runs' },
  { chord: 'G S', action: 'Skills' },
  { chord: 'N', action: 'Focus the create surface. Does not create a task.' },
  { chord: '/', action: 'Rail filter' },
  { chord: '?', action: 'Shortcut sheet' },
  { chord: 'E', action: 'Edit the focused Ops object' },
  { chord: '[', action: 'Toggle rail' },
  { chord: ']', action: 'Toggle inspector' },
  { chord: 'J / K', action: 'Move selection' },
  { chord: 'Enter', action: 'Open the focused row. Does not approve.' },
  { chord: 'Ctrl+W', action: 'Close the active non-pinned Ops tab. Never the window.' },
  { chord: 'Ctrl+Tab', action: 'Cycle Ops document tabs' },
  { chord: 'Alt+Left / Alt+Right', action: 'Tab history' },
  { chord: 'Ctrl+,', action: 'Ops settings' },
  { chord: 'Ctrl+K', action: 'Search Ops in the existing palette' },
  { chord: 'Esc', action: 'Close the innermost layer, then full-screen' }
] as const

export type OpsView = 'office' | 'canvas' | 'board' | 'runs' | 'skills'
export type OpsTabClose = 'closed' | 'pinned' | 'none'

export interface OpsKeymapHost {
  cycleTabs: (direction: 1 | -1) => void
  openSettings: () => void
  closeFocusedTab: () => OpsTabClose
  focusRailFilter: () => void
  go: (view: OpsView) => void
  newTask: () => void
  openShortcutSheet: () => void
  editFocused: () => void
  toggleRail: () => void
  toggleInspector: () => void
  toggleDock: () => void
  moveSelection: (delta: 1 | -1) => void
  openFocused: () => void
  history: (direction: -1 | 1) => void
  focusNextApproval: () => void
  exitFullscreen: () => void
}

let host: OpsKeymapHost | null = null
let leaderUntil = 0
let clock = () => Date.now()

export function registerOpsKeymapHost(next: OpsKeymapHost | null): () => void {
  const previous = host
  host = next

  return () => {
    if (host === next) {
      host = previous
    }
  }
}

export function setOpsKeymapClock(next: () => number): void {
  clock = next
}

export function resetOpsKeymapForTests(): void {
  host = null
  leaderUntil = 0
  clock = () => Date.now()
}

export function opsHost(): OpsKeymapHost | null {
  return host
}

function asElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) {
    return target
  }

  if (typeof Text !== 'undefined' && target instanceof Text) {
    return target.parentElement
  }

  return null
}

export function elementInOpsRoot(target: EventTarget | null): boolean {
  return Boolean(asElement(target)?.closest(OPS_ROOT))
}

export function opsTypingExcluded(
  target: EventTarget | null,
  event?: { isComposing?: boolean; key?: string }
): boolean {
  if (event?.isComposing || event?.key === 'Process') {
    return true
  }

  const el = asElement(target)

  if (!el) {
    return false
  }

  if (isEditableTarget(el) || el.closest('[contenteditable]')) {
    return true
  }

  return Boolean(el.closest(OVERLAY_SURFACE))
}

/** DOM focus inside Ops, not hover, and not an editable or overlay. */
export function opsFocusOwns(target: EventTarget | null, event?: { isComposing?: boolean; key?: string }): boolean {
  return elementInOpsRoot(target) && !opsTypingExcluded(target, event)
}

export function opsOwnsCloseTarget(target: EventTarget | null): boolean {
  return opsFocusOwns(target)
}

export function opsEscSkipsApproval(target: EventTarget | null): boolean {
  const el = asElement(target)

  return Boolean(el?.closest(OPS_ROOT) && !el.closest('[data-approval-stack]'))
}

export function activeElementInOpsRoot(): boolean {
  return typeof document !== 'undefined' && Boolean(document.activeElement?.closest(OPS_ROOT))
}

/** Moves focus only. Never clicks [data-approval-run] or calls approval.respond. */
export function focusNextApproval(): void {
  if (typeof document === 'undefined') {
    return
  }

  document.querySelector<HTMLElement>('[data-ops-next-approval]')?.focus()
}

function tabCycle(combo: string): 1 | -1 | null {
  if (combo === 'ctrl+tab' || (!IS_MAC && combo === 'mod+tab')) {
    return 1
  }

  if (combo === 'ctrl+shift+tab' || (!IS_MAC && combo === 'mod+shift+tab')) {
    return -1
  }

  return null
}

/**
 * BR-DISPATCH. True only for Ctrl+Tab, Ctrl+Shift+Tab, Ctrl/Cmd+K, and
 * Ctrl/Cmd+comma while Ops owns focus. Not mod+j, not mod+p, not mod+w.
 */
export function claimOpsFocusedChord(event: KeyboardEvent, combo: string): boolean {
  if (!opsFocusOwns(event.target, event)) {
    return false
  }

  if (combo === 'mod+k') {
    openCommandPalettePage(OPS_PALETTE_PAGE)

    return true
  }

  if (combo === 'mod+,') {
    host?.openSettings()

    return true
  }

  const direction = tabCycle(combo)

  if (direction) {
    host?.cycleTabs(direction)

    return true
  }

  return false
}

function consumeLeader(key: string): boolean {
  leaderUntil = 0
  const view: Record<string, OpsView> = {
    o: 'office',
    c: 'canvas',
    b: 'board',
    r: 'runs',
    s: 'skills'
  }
  const next = view[key]

  if (next) {
    host?.go(next)
  }

  return true
}

/**
 * Root-local bare keys and Alt history. Primary-modifier chords stay with
 * claimOpsFocusedChord or the Desktop close path. Lone G is not approve.
 */
export function claimOpsRootKey(event: KeyboardEvent, combo: string): boolean {
  if (event.isComposing || event.key === 'Process' || event.repeat) {
    return false
  }

  if (!opsFocusOwns(event.target, event)) {
    leaderUntil = 0

    return false
  }

  const el = asElement(event.target)

  if (el?.closest('[data-approval-stack]') && (event.key === 'Enter' || event.key === 'Escape')) {
    return false
  }

  if (event.key === 'Escape' || combo === 'escape' || combo === 'mod+j' || combo === 'mod+w' || combo === 'mod+p' || combo === 'mod+g') {
    return false
  }

  if (event.metaKey || event.ctrlKey || event.altKey) {
    if (combo === 'alt+left') {
      host?.history(-1)

      return true
    }

    if (combo === 'alt+right') {
      host?.history(1)

      return true
    }

    return false
  }

  const now = clock()

  if (leaderUntil > now) {
    return consumeLeader(event.key.toLowerCase())
  }

  if (combo === 'g') {
    leaderUntil = now + G_LEADER_MS

    return true
  }

  if (combo === 'n') {
    host?.newTask()

    return true
  }

  if (combo === '/' ) {
    host?.focusRailFilter()

    return true
  }

  if (combo === 'shift+/' || event.key === '?') {
    host?.openShortcutSheet()

    return true
  }

  if (combo === 'e') {
    host?.editFocused()

    return true
  }

  if (combo === '[') {
    host?.toggleRail()

    return true
  }

  if (combo === ']') {
    host?.toggleInspector()

    return true
  }

  if (combo === 'j') {
    host?.moveSelection(1)

    return true
  }

  if (combo === 'k') {
    host?.moveSelection(-1)

    return true
  }

  if (combo === 'enter' || event.key === 'Enter') {
    host?.openFocused()

    return true
  }

  return false
}

export function consumeOpsClose(): OpsTabClose {
  return host?.closeFocusedTab() ?? 'pinned'
}
