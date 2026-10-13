// One Ops page inside the existing command palette. No second cmdk.

import { useMemo, useSyncExternalStore } from 'react'

import {
  focusNextApproval,
  MODEL_EDIT_UNAVAILABLE,
  MUTATION_UNAVAILABLE,
  OPS_PALETTE_PAGE,
  opsHost,
  type OpsView
} from './keymap'

export { OPS_PALETTE_PAGE }

const RECENT_KEY = 'hermes.desktop.opsRecentSearch.v1'
const RECENT_LIMIT = 8

export interface OpsPaletteScope {
  connectionId: string
  profile: string
}

let scope: OpsPaletteScope = { connectionId: '', profile: '' }
const scopeListeners = new Set<() => void>()

export function setOpsPaletteScope(next: OpsPaletteScope): void {
  if (next.connectionId === scope.connectionId && next.profile === scope.profile) {
    return
  }

  scope = next
  scopeListeners.forEach(listener => listener())
}

export function readOpsPaletteScope(): OpsPaletteScope {
  return scope
}

function subscribeScope(listener: () => void): () => void {
  scopeListeners.add(listener)

  return () => scopeListeners.delete(listener)
}

function scopeId(value: OpsPaletteScope = scope): string {
  return `${value.connectionId}\u0000${value.profile}`
}

function readStore(): Record<string, string[]> {
  if (typeof localStorage === 'undefined') {
    return {}
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '{}') as unknown

    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string[]>) : {}
  } catch {
    return {}
  }
}

export function readRecentSearches(value: OpsPaletteScope = scope): string[] {
  const rows = readStore()[scopeId(value)]

  return Array.isArray(rows) ? rows.filter(row => typeof row === 'string') : []
}

export function rememberOpsSearch(query: string, value: OpsPaletteScope = scope): void {
  const trimmed = query.trim()

  if (!trimmed || typeof localStorage === 'undefined') {
    return
  }

  const store = readStore()
  const id = scopeId(value)
  const next = [trimmed, ...(store[id] ?? []).filter(row => row !== trimmed)].slice(0, RECENT_LIMIT)
  store[id] = next

  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(store))
  } catch {
    // A full or blocked store must not throw out of a palette select.
  }
}

export interface OpsPaletteCommand {
  id: string
  label: string
  keywords: string[]
  disabledReason?: string
  run?: () => void
}

export function opsPaletteCommands(): OpsPaletteCommand[] {
  const go = (view: OpsView) => () => opsHost()?.go(view)

  return [
    { id: 'go-office', label: 'Go to Office', keywords: ['office', 'navigate', 'g o'], run: go('office') },
    { id: 'go-canvas', label: 'Go to Canvas', keywords: ['canvas', 'navigate', 'g c'], run: go('canvas') },
    { id: 'go-board', label: 'Go to Board', keywords: ['board', 'navigate', 'g b'], run: go('board') },
    { id: 'go-runs', label: 'Go to Runs', keywords: ['runs', 'navigate', 'g r'], run: go('runs') },
    { id: 'go-skills', label: 'Go to Skills', keywords: ['skills', 'capabilities', 'g s'], run: go('skills') },
    { id: 'settings', label: 'Settings', keywords: ['settings', 'shortcuts'], run: () => opsHost()?.openSettings() },
    {
      id: 'shortcut-sheet',
      label: 'Shortcut sheet',
      keywords: ['shortcuts', 'keymap', 'help'],
      run: () => opsHost()?.openShortcutSheet()
    },
    {
      id: 'focus-next-approval',
      label: 'Go to next approval',
      keywords: ['approval', 'focus', 'needs you'],
      run: focusNextApproval
    },
    {
      id: 'create-task',
      label: 'Create task',
      keywords: ['create', 'task', 'new'],
      disabledReason: MUTATION_UNAVAILABLE
    },
    {
      id: 'create-project',
      label: 'Create project',
      keywords: ['create', 'project', 'new'],
      disabledReason: MUTATION_UNAVAILABLE
    },
    {
      id: 'approve',
      label: 'Approve',
      keywords: ['approve', 'allow'],
      disabledReason: 'No shortcut approves. Go to next approval only moves focus.'
    },
    {
      id: 'set-model',
      label: 'Set model',
      keywords: ['model', 'picker'],
      disabledReason: MODEL_EDIT_UNAVAILABLE
    },
    {
      id: 'restore',
      label: 'Restore profile',
      keywords: ['restore', 'write'],
      disabledReason: MUTATION_UNAVAILABLE
    }
  ]
}

export function OpsPalettePage({
  onSearch,
  search
}: {
  onSearch?: (query: string) => void
  search: string
}) {
  const liveScope = useSyncExternalStore(subscribeScope, readOpsPaletteScope, readOpsPaletteScope)
  const query = search.trim().toLowerCase()
  const commands = useMemo(() => {
    return opsPaletteCommands().filter(command => {
      if (!query) {
        return true
      }

      return [command.label, ...command.keywords].some(part => part.toLowerCase().includes(query))
    })
  }, [query])
  const recent = query ? [] : readRecentSearches(liveScope)

  const select = (command: OpsPaletteCommand) => {
    if (command.disabledReason || !command.run) {
      return
    }

    if (search.trim()) {
      rememberOpsSearch(search, liveScope)
    }

    command.run()
  }

  return (
    <div data-ops-palette-page={OPS_PALETTE_PAGE}>
      {recent.length > 0 && (
        <div data-ops-recent-searches={scopeId(liveScope)}>
          {recent.map(row => (
            <button key={row} onClick={() => onSearch?.(row)} type="button">
              {row}
            </button>
          ))}
        </div>
      )}
      <ul>
        {commands.map(command => (
          <li key={command.id}>
            <button
              aria-disabled={command.disabledReason ? true : undefined}
              data-ops-command={command.id}
              data-ops-disabled-reason={command.disabledReason}
              disabled={Boolean(command.disabledReason)}
              onClick={() => select(command)}
              title={command.disabledReason}
              type="button"
            >
              {command.label}
              {command.disabledReason ? <span>{command.disabledReason}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
