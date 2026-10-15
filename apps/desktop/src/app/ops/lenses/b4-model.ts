/**
 * P8 b4 (pure): Fleet / Teams / Roles, Skills and Channels models. No React, no I/O.
 * Unknown stays null; nothing is invented from absent fields.
 */
import type { BoardTask } from '../office/control-room'

/* --------------------------------- Fleet ---------------------------------- */

export interface FleetProfile {
  name: string
  model?: string | null
  provider?: string | null
  description?: string | null
}

export interface FleetWorker {
  profile: string | null
  task_id: string
  last_heartbeat_at: number | null
}

export type FleetStatus = 'running' | 'failing' | 'idle' | 'unknown'

export interface FleetRow {
  name: string
  role: string | null
  model: string | null
  /** Lane = the tenant this profile works in most (ties: alphabetical); null when it has no tasks. */
  lane: string | null
  active: number
  runs7d: number
  /** Where runs7d came from: real task_runs rows, or task starts on an older backend. */
  runsSource: 'runs' | 'task-starts'
  failed7d: number | null
  lastActive: number | null
  status: FleetStatus
  /** P8: the open task that is failing (most consecutive failures), so attention says why. */
  failingTask?: { id: string; title: string; failures: number } | null
}

export const WEEK_S = 7 * 86_400
const OPEN = new Set(['triage', 'todo', 'ready', 'running', 'blocked', 'review'])

/** O76: role = first clause of the profile description. */
export function roleOf(description?: string | null): string | null {
  const s = (description || '').trim()

  if (!s) {
    return null
  }

  const clause = s.split(/[.;:\n—–]|\s-\s/)[0].trim()

  return clause ? clause.slice(0, 48) : null
}

const touchedAt = (t: BoardTask) => Math.max(t.last_heartbeat_at ?? 0, t.completed_at ?? 0, t.started_at ?? 0) || null

export type RunStats = Record<string, { runs: number; failed: number; last_started_at?: number | null }>

export function fleetRows(
  profiles: FleetProfile[],
  tasks: BoardTask[] | null,
  workers: FleetWorker[] | null,
  nowS: number,
  stats: RunStats | null = null
): FleetRow[] {
  return profiles.map(p => {
    const mine = tasks ? tasks.filter(t => t.assignee === p.name) : null
    const lanes = new Map<string, number>()

    for (const t of mine ?? []) {
      if (t.tenant) {
        lanes.set(t.tenant, (lanes.get(t.tenant) ?? 0) + 1)
      }
    }

    const lane = [...lanes.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
    const last = mine ? mine.reduce<number | null>((m, t) => Math.max(m ?? 0, touchedAt(t) ?? 0) || m, null) : null
    const live = workers?.some(w => w.profile === p.name) ?? false
    const failingTasks = (mine ?? []).filter(t => OPEN.has(t.status) && (t.consecutive_failures ?? 0) > 0)
    const failing = failingTasks.length > 0
    const worst = failingTasks.sort((a, b) => (b.consecutive_failures ?? 0) - (a.consecutive_failures ?? 0))[0]

    return {
      name: p.name,
      role: roleOf(p.description),
      model: p.model || null,
      lane,
      active: mine ? mine.filter(t => OPEN.has(t.status)).length : 0,
      runs7d: stats ? (stats[p.name]?.runs ?? 0) : mine ? mine.filter(t => (t.started_at ?? 0) >= nowS - WEEK_S).length : 0,
      runsSource: stats ? 'runs' : 'task-starts',
      failed7d: stats ? (stats[p.name]?.failed ?? 0) : null,
      lastActive: Math.max(last ?? 0, stats?.[p.name]?.last_started_at ?? 0) || null,
      status: !tasks && !workers ? 'unknown' : failing ? 'failing' : live ? 'running' : 'idle',
      failingTask: worst ? { id: worst.id, title: worst.title || worst.id, failures: worst.consecutive_failures ?? 0 } : null
    }
  })
}

export function searchRows<T>(rows: T[], q: string, fields: (r: T) => (string | null | undefined)[]): T[] {
  const n = q.trim().toLowerCase()

  return n ? rows.filter(r => fields(r).some(f => (f || '').toLowerCase().includes(n))) : rows
}

/* --------------------------------- Teams ---------------------------------- */

export interface Team {
  lane: string
  projects: string[]
  open: number
  members: string[]
  /** P7/P9: what the lane is working on now: up to 3 open tasks, blocked first, then newest. Status is per task, not per title. */
  focus: { id: string; title: string; blocked: boolean }[]
  blocked: number
}

const focusOf = (ts: BoardTask[]) =>
  ts
    .filter(t => OPEN.has(t.status) && t.title)
    .sort((a, b) => Number(b.status === 'blocked') - Number(a.status === 'blocked') || (Number((b as { created_at?: number }).created_at) || 0) - (Number((a as { created_at?: number }).created_at) || 0))
    .slice(0, 3)

/** R73: a team is a tenant lane: its projects, open tasks and the profiles that work it. */
export function teams(tasks: BoardTask[]): Team[] {
  const by = new Map<string, BoardTask[]>()

  for (const t of tasks) {
    const k = t.tenant || 'No lane'
    by.set(k, [...(by.get(k) ?? []), t])
  }

  return [...by.entries()]
    .map(([lane, ts]) => ({
      lane,
      projects: [...new Set(ts.map(t => t.project_id).filter((x): x is string => !!x))].sort(),
      open: ts.filter(t => OPEN.has(t.status)).length,
      members: [...new Set(ts.map(t => t.assignee).filter((x): x is string => !!x))].sort(),
      focus: focusOf(ts).map(t => ({ id: t.id, title: String(t.title), blocked: t.status === 'blocked' })),
      blocked: ts.filter(t => t.status === 'blocked').length
    }))
    .sort((a, b) => (a.lane === 'No lane' ? 1 : b.lane === 'No lane' ? -1 : b.open - a.open || a.lane.localeCompare(b.lane)))
}

/* --------------------------------- Skills --------------------------------- */

export interface SkillLite {
  name: string
  category: string
  description: string
  enabled: boolean
  provenance?: string
  usage?: number
}

export interface SkillRow extends SkillLite {
  /** G69: profiles that have this skill enabled (only the profiles that answered). */
  agents: string[]
}

export function skillRows(byProfile: Record<string, SkillLite[] | null>, focus: string): SkillRow[] {
  const base = byProfile[focus] ?? []

  const agents = (name: string) =>
    Object.entries(byProfile)
      .filter(([, list]) => list?.some(s => s.name === name && s.enabled))
      .map(([p]) => p)
      .sort()

  return base.map(s => ({ ...s, agents: agents(s.name) }))
}

/** G68: category tag hue. Gold family, stable per category (hash), so every tag reads as one system. */
export const TAG_TONES = ['gold', 'amber', 'ochre', 'bronze', 'sand', 'brass'] as const

export function tagTone(category: string): (typeof TAG_TONES)[number] {
  let h = 0

  for (const c of category.toLowerCase()) {
    h = (h * 31 + c.charCodeAt(0)) >>> 0
  }

  return TAG_TONES[h % TAG_TONES.length]
}

export interface OfficialLite {
  identifier: string
  name: string
  category: string
  description: string
  installed: boolean
}

export interface StarterPack {
  id: string
  title: string
  skills: OfficialLite[]
  missing: OfficialLite[]
}

/** G10/G82: the hub has no bundle field, so packs are the official catalog grouped by category (>= 2 skills). */
export function starterPacks(official: OfficialLite[]): StarterPack[] {
  const by = new Map<string, OfficialLite[]>()

  for (const s of official) {
    const k = s.category || 'general'
    by.set(k, [...(by.get(k) ?? []), s])
  }

  return [...by.entries()]
    .filter(([, xs]) => xs.length >= 2)
    .map(([id, xs]) => ({
      id,
      title: `${id.charAt(0).toUpperCase()}${id.slice(1).replace(/[-_]/g, ' ')} kit`,
      skills: [...xs].sort((a, b) => a.name.localeCompare(b.name)),
      missing: xs.filter(s => !s.installed)
    }))
    .sort((a, b) => b.skills.length - a.skills.length || a.id.localeCompare(b.id))
}

/* -------------------------------- Channels -------------------------------- */

export type AppKind = 'mcp' | 'messaging' | 'model'

export interface AppCard {
  key: string
  kind: AppKind
  id: string
  name: string
  description: string
  category: string
  connected: boolean
  /** Why it is not usable even though it is connected (e.g. gateway stopped), when known. */
  warning: string | null
}

export const APP_CATEGORIES: Record<AppKind, string> = { messaging: 'Messaging', mcp: 'Tools (MCP)', model: 'Models' }

export interface ChannelsInput {
  catalog: { name: string; description: string; installed?: boolean }[] | null
  servers: { name: string; enabled: boolean }[] | null
  platforms: { id: string; name: string; description: string; configured: boolean; enabled: boolean; gateway_running: boolean; error_message?: string | null }[] | null
  providers: { id: string; name: string; flow: string; status: { logged_in: boolean; error?: string } }[] | null
}

/** G83: Connected = configured MCP server, platform with credentials set, provider signed in. */
export function appCards(i: ChannelsInput): AppCard[] {
  const servers = new Map((i.servers ?? []).map(s => [s.name, s]))
  const out: AppCard[] = []

  for (const p of i.platforms ?? []) {
    out.push({
      key: `messaging:${p.id}`,
      kind: 'messaging',
      id: p.id,
      name: p.name,
      description: p.description,
      category: APP_CATEGORIES.messaging,
      connected: p.configured,
      warning: p.error_message || (p.configured && !p.enabled ? 'disabled' : p.configured && !p.gateway_running ? 'gateway stopped' : null)
    })
  }

  const seen = new Set<string>()

  for (const e of i.catalog ?? []) {
    seen.add(e.name)
    const s = servers.get(e.name)
    out.push({
      key: `mcp:${e.name}`,
      kind: 'mcp',
      id: e.name,
      name: e.name,
      description: e.description,
      category: APP_CATEGORIES.mcp,
      connected: !!s || !!e.installed,
      warning: s && !s.enabled ? 'disabled' : null
    })
  }

  for (const s of i.servers ?? []) {
    if (!seen.has(s.name)) {
      out.push({ key: `mcp:${s.name}`, kind: 'mcp', id: s.name, name: s.name, description: 'Custom MCP server', category: APP_CATEGORIES.mcp, connected: true, warning: s.enabled ? null : 'disabled' })
    }
  }

  for (const p of i.providers ?? []) {
    out.push({
      key: `model:${p.id}`,
      kind: 'model',
      id: p.id,
      name: p.name,
      description: p.flow === 'external' ? 'Signed in outside Hermes' : 'Model provider sign-in',
      category: APP_CATEGORIES.model,
      connected: !!p.status?.logged_in,
      warning: p.status?.error || null
    })
  }

  return out
}

/** G7: Connect and Manage reuse Desktop's own flows; Ops never re-implements a credential form. */
export function appRoute(c: AppCard): string {
  if (c.kind === 'messaging') {
    return `/messaging?platform=${encodeURIComponent(c.id)}`
  }

  if (c.kind === 'model') {
    return `/settings?section=providers&provider=${encodeURIComponent(c.id)}`
  }

  return `/capabilities?tab=connectors&server=${encodeURIComponent(c.id)}`
}

/** G67: blueprint tags that name a known app become icons. */
export function appsInTags(tags: string[] | undefined, cards: Pick<AppCard, 'id' | 'name' | 'kind'>[]): { id: string; name: string; kind: AppKind }[] {
  const out: { id: string; name: string; kind: AppKind }[] = []

  for (const tag of tags ?? []) {
    const t = tag.toLowerCase()
    const hit = cards.find(c => c.id.toLowerCase() === t || c.name.toLowerCase() === t)

    if (hit && !out.some(o => o.id === hit.id)) {
      out.push({ id: hit.id, name: hit.name, kind: hit.kind })
    }
  }

  return out
}

/** Monogram glyph for an app (no third-party logos are bundled). */
export const appGlyph = (name: string) => (name.replace(/[^a-z0-9]/gi, '').slice(0, 2) || '?').toUpperCase()
