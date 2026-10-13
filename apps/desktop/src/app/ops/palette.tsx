// One Ops page inside the existing command palette. No second cmdk.

import { useMemo, useSyncExternalStore } from 'react'

import { CommandGroup, CommandItem } from '@/components/ui/command'
import { useI18n } from '@/i18n'
import { closeCommandPalette, openCommandPalettePage } from '@/store/command-palette'

import { OPS_PALETTE_PAGE, opsHost, type OpsView } from './keymap'
import type { OpsCopy } from './locales'

export { OPS_PALETTE_PAGE }

const RECENT_KEY = 'hermes.desktop.opsRecentSearch.v1'
const RECENT_LIMIT = 8

export interface OpsPaletteScope {
  connectionId: string
  profile: string
}

let scope: OpsPaletteScope = { connectionId: '', profile: '' }
const scopeListeners = new Set<() => void>()
let pendingCommand: (() => void) | null = null

/** Existing palette Dialog retires its focus trap before running an Ops action. */
export function finishOpsPaletteCommand(event: Event): void {
  const run = pendingCommand
  pendingCommand = null

  if (run) {
    event.preventDefault()
    queueMicrotask(run)
  }
}

export function setOpsPaletteScope(next: OpsPaletteScope): void {
  if (next.connectionId === scope.connectionId && next.profile === scope.profile) {
    return
  }

  scope = next
  pendingCommand = null
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
  const next = [trimmed, ...readRecentSearches(value).filter(row => row !== trimmed)].slice(0, RECENT_LIMIT)
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

export function opsPaletteCommands(copy: OpsCopy): OpsPaletteCommand[] {
  const go = (view: OpsView) => () => opsHost()?.go(view)
  const label = copy.palette.commands

  return [
    { id: 'go-office', label: label['go-office'], keywords: ['office', 'navigate', 'g o'], run: go('office') },
    { id: 'go-canvas', label: label['go-canvas'], keywords: ['canvas', 'navigate', 'g c'], run: go('canvas') },
    { id: 'go-board', label: label['go-board'], keywords: ['board', 'navigate', 'g b'], run: go('board') },
    { id: 'go-runs', label: label['go-runs'], keywords: ['runs', 'navigate', 'g r'], run: go('runs') },
    { id: 'go-skills', label: label['go-skills'], keywords: ['skills', 'capabilities', 'g s'], run: go('skills') },
    { id: 'settings', label: label.settings, keywords: ['settings', 'shortcuts'], run: () => opsHost()?.openSettings() },
    {
      id: 'switch-theme',
      label: label['switch-theme'],
      keywords: ['theme', 'appearance'],
      run: () => openCommandPalettePage('theme')
    },
    {
      id: 'shortcut-sheet',
      label: label['shortcut-sheet'],
      keywords: ['shortcuts', 'keymap', 'help'],
      run: () => opsHost()?.openShortcutSheet()
    },
    {
      id: 'focus-next-approval',
      label: label['focus-next-approval'],
      keywords: ['approval', 'focus', 'needs you'],
      run: () => opsHost()?.focusNextApproval()
    },
    {
      id: 'create-task',
      label: label['create-task'],
      keywords: ['create', 'task', 'new'],
      disabledReason: copy.reasons.mutation
    },
    {
      id: 'create-project',
      label: label['create-project'],
      keywords: ['create', 'project', 'new'],
      disabledReason: copy.reasons.mutation
    },
    {
      id: 'approve',
      label: label.approve,
      keywords: ['approve', 'allow'],
      disabledReason: copy.reasons.approve
    },
    {
      id: 'set-model',
      label: label['set-model'],
      keywords: ['model', 'picker'],
      disabledReason: copy.reasons.modelEdit
    },
    {
      id: 'restore',
      label: label.restore,
      keywords: ['restore', 'write'],
      disabledReason: copy.reasons.mutation
    }
  ]
}

export function OpsPalettePage({ onSearch, search }: { onSearch?: (query: string) => void; search: string }) {
  const liveScope = useSyncExternalStore(subscribeScope, readOpsPaletteScope, readOpsPaletteScope)
  const query = search.trim().toLowerCase()
  const copy = useI18n().t.ops

  const commands = useMemo(() => {
    return opsPaletteCommands(copy).filter(command => {
      if (!query) {
        return true
      }

      return [command.label, ...command.keywords].some(part => part.toLowerCase().includes(query))
    })
  }, [copy, query])

  const recent = query ? [] : readRecentSearches(liveScope)

  const select = (command: OpsPaletteCommand) => {
    if (command.disabledReason || !command.run) {
      return
    }

    if (search.trim()) {
      rememberOpsSearch(search, liveScope)
    }

    const selectedScope = liveScope

    pendingCommand = () => {
      if (scopeId(selectedScope) === scopeId() && scope.connectionId && scope.profile) {
        command.run?.()
      }
    }

    closeCommandPalette()
  }

  return (
    <div data-ops-palette-page={OPS_PALETTE_PAGE}>
      {recent.length > 0 && (
        <CommandGroup data-ops-recent-searches={scopeId(liveScope)} heading={copy.palette.recent}>
          {recent.map(row => (
            <CommandItem key={row} onSelect={() => onSearch?.(row)} value={`recent:${row}`}>
              {row}
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      <CommandGroup heading={copy.palette.group}>
        {commands.map(command => (
          <CommandItem
            aria-disabled={command.disabledReason ? true : undefined}
            className="flex-col items-start gap-1"
            data-ops-command={command.id}
            data-ops-disabled-reason={command.disabledReason}
            disabled={Boolean(command.disabledReason)}
            key={command.id}
            onSelect={() => select(command)}
            title={command.disabledReason}
            value={command.id}
          >
            {command.label}
            {command.disabledReason ? (
              <span className="text-xs text-muted-foreground">{command.disabledReason}</span>
            ) : null}
          </CommandItem>
        ))}
      </CommandGroup>
    </div>
  )
}
