# B12 Fusion Matrix — Orbit × Outglow × Gr8r → Ops Panel

References captured 2026-10-14 under `/workspace/b12/ref/` (Orbit, Outglow/agent-builder-ui, Gr8r) plus vault Gr8r frames.

Legend: **A** = adopted · **A+** = adopted and improved · **M** = missing / deferred · **N/A** = not applicable to our product surface

## Visual language

| Pattern | Orbit | Outglow | Gr8r | Ours | Status |
|---|---|---|---|---|---|
| Dark density / Gold Night | Yes (#050505, Geist) | Light Inter | Light Geist | Gold Night default + light | **A+** (theme switch, reduced-motion contract) |
| Left rail with agent/fleet list + state | Agent list Active/Idle/Offline | Agents sidebar | Projects/nav | Fleet groups by presence | **A+** (presence colours, honest unknown) |
| Centre stage identity | Atlas orb + floating avatars | Chat+canvas | Greeting + stat cards | Orrery + radials + Sigil orbs | **A+** (collision-avoided labels, thinking pulse, presence border) |
| Greeting strip | — | — | "Good afternoon, … · date · Here's what's happening" | Same shape, locale-aware date, 9 langs | **A+** |
| Stat cards with sublines | Tokens/run strip | Usage banner | Overdue-red sublines | StatCards + thresholds | **A** |
| Task table / Needs-you | Tasks owner/status/steps | — | My tasks | Needs-you table | **A** |
| Board columns + counts + "+" | — | — | Status icons + counts | Glyphs via `h3::before` + tabular counts | **A+** |
| Cards: id chip, tags, priority, due, avatar, hover actions | — | — | Full | Mono id + Sigil assignee + priority/due | **A+** (Sigil deterministic) |
| Multi-view board (board/list/timeline/calendar/files) | — | — | Yes + saved views | board/list/table/calendar/timeline/files/favorites/review | **A+** |
| Node canvas dotted grid, ports, curved edges, zoom | — | Yes | — | Dotted grid + card nodes + ports + zoom + Set identity | **A+** |
| Right inspector (Agents \| Context) | Yes, grouped + subtitles | Run panel Thinking+tokens | Task detail | Inspector with i18n labels, lens tabs | **A+** |
| Dock / status bar | Terminal/Output/Problems + Run # | — | — | Diagnostics lens + status toasts | **A** (dock chrome lighter) |
| Empty states with a way out | — | Starter packs | Empty + CTA | Skills packs + empty copy | **A** |
| Workload bars | — | — | Yes | Thresholds / tokens-today | **A** (lighter) |

## Interaction patterns

| Pattern | Orbit | Outglow | Gr8r | Ours | Status |
|---|---|---|---|---|---|
| Tab strip / saved views | Tabs | — | Saved-view tabs | Tabs + saved views | **A** |
| Ctrl/Cmd K command palette | Yes | — | Yes | Yes | **A** |
| Ctrl , settings | Yes | — | — | Settings lens | **A** |
| Composer with @assign + suggestions | Ask Atlas + chips | Chat = canvas | + New | "Type a task. Start with @profile" + quick prompts | **A+** |
| Selection → inspector | Click agent | Click node | Click card | Click row/card/orb → inspector | **A** |
| Drag cards across columns | — | Drag nodes | Drag cards | Column move via actions (no free card-drag yet) | **M** (deferred: no first-pickup drag; move via board actions / Escape fullscreen spike only) |
| Live feedback (presence, thinking, tokens) | Orb states, Motion: Full | Thinking timer + tokens | Due colouring | Presence borders, `ops-think` pulse, live events | **A+** |
| Zoom / pan canvas | — | Zoom pill | — | Zoom + pan + Fit | **A** |
| "Set identity" CTA | — | Amber CTA | — | Same CTA on unset ports | **A** |
| Chat→canvas compose (describe → nodes) | — | Core loop | — | Composer dispatches tasks; no auto node graph | **M** (deferred: needs backend proposal path; must never auto-apply) |
| Shortcuts cheatsheet | Implied | — | — | Shortcuts lens / help | **A** |
| Reduced motion | Contract | — | — | Honoured (pulse off) | **A+** |
| i18n of chrome + main content | EN | EN | EN | 9 locales (ops chrome + main T()) | **A+** |

## Gaps we closed in B12 builds

1. Orbit-style live orbs: Sigil monogram inside presence-coloured pills + thinking pulse.
2. Gr8r greeting + card mono id + assignee Sigil + column status glyphs.
3. Outglow dotted canvas surface + card-node chrome.
4. Main-content `T()` + 424-key tables for es/fr/de/ru/ja/zh/zh-hant/ar.

## Intentionally deferred

- Freeform card drag (board already moves via actions; drag spike was fullscreen leave).
- Outglow "chat becomes canvas" auto-compose (safety: proposal-only, never auto-apply; needs backend).
