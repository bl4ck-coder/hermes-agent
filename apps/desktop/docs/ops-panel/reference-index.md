# Ops panel reference index (P0-08)

Status: documentation only. Exactly 19 screenshot entries. Missing references are blockers below. They are not entries, and they are not replaced.
Shot source: `C:/Users/nachi/AppData/Local/Temp/opusspec/` (the folder encuentro-opus read on 2026-10-12, session `20261012_184917_003ea2`). Inventory line in that folder's `REPORT.md` line 3: `agent-builder-*.png`, `orbit-*.png`, and `x-post-status-2109638103346381298.png`.
Count on disk at index time: 19 png files. The x-post file is not among them. It is blocker B1, not entry 20.
Wireframes: `wireframes.md` in this directory. ASCII fences match SPEC section 12.5. This index does not redraw them.
Rows: O23, O44, O47, G17, G37, G47, G48, G49, G54, R32, R53. A row on an entry means the shot is evidence for that row, or the row applies and the shot does not depict it (said explicitly). It does not mean the shot is the spec.

Paths are absolute so a judge can open them without a repo copy. The png files were not vendored into git and not replaced. Hashes are SHA-256 of the file bytes.

## How to count

Count level-2 headings whose text is `Entry` plus a two-digit id. There are 19, from 01 through 19. Blocker headings are not entries.

## Entry 01

- File: `agent-builder-canvas-run-replay.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-canvas-run-replay.png`
- Bytes: 285323
- SHA-256: `a3815086870176ee30318e8256334745f148db50835650edc644b3903c01ab3b`
- Site: Outglow
- Wireframes: W4
- Rows: G17, G37, G47, G48, G49, G54, O44, R32
- Seen: run panel open (`Run discovery-agent over the past 7 days`), three columns (Schedule, Triggers, Channels, Memory | Agent, Instructions | Tools, Sub-agents, Skills), dotted grid, zoom `100%`, blue and orange ports, dashed curves. Sub-agents and Skills are on the canvas and also listed in the run panel. No node spinner. Left app nav is an icon-only rail (~30 px, x0-30, full height, no labels). It is the only one of the 12 Outglow shots in that state; 02-12 show the full sidebar.
- Freeze: W4 keeps this topology (G48). Port hues in the shot are not G49. G54 stays even though this shot has no spinner. One 24 px gutter is not measurable here (R32). Entry 01 is the appearance reference for the O44 icons state. It does not prove G17 persistence or the R53 trigger (R53 is measured on the Ops pane container, SPEC.md:673, not off an Outglow frame). Do not copy Outglow's icons.

## Entry 02

- File: `agent-builder-chat.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-chat.png`
- Bytes: 53181
- SHA-256: `58d83c6f4affed34b9e19af046f905d16698f74d6a75c49dbe9a08e4aef12ec4`
- Site: Outglow
- Wireframes: W1 (sidebar only). Not a second Ops composer.
- Rows: G17, O44
- Seen: full sidebar (Chat, Inbox, Templates, Integrations, Skills, Agents). Empty state heading `Who's on it today?`. Model chip `Fable 5`. Usage banner `You've used 80% of your tokens.` Recommended prompt cards. Sidebar is full, not icons.
- Freeze: G17 full state. Do not copy `Fable 5` (not P2). Do not add a second composer (P0-04 O32). Icon-rail state is not this shot.

## Entry 03

- File: `agent-builder-connect-app-popover.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-connect-app-popover.png`
- Bytes: 303085
- SHA-256: `16780638c0a4e0186e5dca2671784f4e31a6b6c1db18a66cbc52df2d42ca772a`
- Site: Outglow
- Wireframes: W12, W4 behind it
- Rows: G37, G47, G48, G49
- Seen: popover `Search apps` over the canvas, categories Models (`Claude`, `GPT`), Design (`Chromatic`, `Maze`, `Miro`), Code and CI. Canvas columns and dotted grid remain behind it. It is a popover, not a page.
- Freeze: W12 "+" popover. Do not turn it into a route. Do not copy blue/orange ports into G49.

## Entry 04

- File: `agent-builder-dark-theme.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-dark-theme.png`
- Bytes: 108908
- SHA-256: `aaa89d13578d0358bea5d037008ad8f942fa4c6c329850a7bde3d2c79b458e95`
- Site: Outglow
- Wireframes: W12 (Skills, dark skin). Not W9.
- Rows: G17, O44
- Seen: dark Skills page. Workspace menu open: `Agents` / `Workbench`, Organization settings, Profile settings, Appearance, Support, What's new, Log out. Sidebar still full. Starter packs and the skills table remain.
- Freeze: D5 is Gold Night, not this dark skin. G19 Agents/Workbench and G77 Support / Log out are Cuts. Do not add them to W9 or W12. This is not the icon rail.

## Entry 05

- File: `agent-builder-instructions-edit-button.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-instructions-edit-button.png`
- Bytes: 304640
- SHA-256: `2ae715306a4254101c9b2e446768684483047170c62d452e4785660b1352dad1`
- Site: Outglow
- Wireframes: W4
- Rows: G37, G47, G48, G49
- Seen: `Edit` on the Instructions node (`Product Discovery Agent`, version line, owner Arek). No editor panel opened. Three-column canvas and run panel still visible. Channels still `Set identity`. No node spinner.
- Freeze: Prompt `[Edit]` stays in the W4 fence. Do not invent the editor chrome the shot did not open.

## Entry 06

- File: `agent-builder-integrations.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-integrations.png`
- Bytes: 152565
- SHA-256: `e4e355dd22acd39f452555c0d7eb3bf7de17dc4ca84ba9626b067056fb88e20a`
- Site: Outglow
- Wireframes: W12
- Rows: R32, R53
- Seen: Integrations. Left categories (Design, Code and CI, Issues and planning, Docs and knowledge, Customer voice, Analytics, Monitoring, Communication). Filters `All` and `Connected`. Search `Search by name, etc...`. Cards with `Connect` or `Connected` (GitHub, Slack, ClickUp, Notion, Figma). Top banner with moving chips (`Updated 23 tasks after the last run`).
- Freeze: W12 Channels and MCP keeps the rail, All/Connected, search, Connect / check / Manage. The banner is G9, a Cut. Do not add it. Breakpoints are not measured in this shot (R53). One gutter is not measured (R32).

## Entry 07

- File: `agent-builder-product-discovery.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-product-discovery.png`
- Bytes: 280290
- SHA-256: `640fadd1a73e74a29780a2949077a46abc351309c1298a4ffee67d3d65fd92a9`
- Site: Outglow
- Wireframes: W4
- Rows: G37, G47, G48, G49, G54
- Seen: same canvas, run panel open. Only a `Tools` node is visible in the right column. Sub-agents and Skills are not drawn. Empty canvas to its right. Schedule, Triggers, Channels (`Set identity`), Memory, Agent, Instructions visible and rendered normally. Dotted grid. Zoom `100%`. Thinking `1m 6s · 2.7k tokens`. Usage banner in the run panel. The Tools node shows a partial-arc loading spinner and shimmer on that node only (original PNG, region x700-850 y72-108). Neighbours do not spin.
- Freeze: partial view of W4, not a different layout. G54 is depicted in 07: per-node loading, neighbours unaffected. Hue is not copied; the freeze is gold shimmer. Do not drop the right column. Entries 01 and 08 are the complete G48 topology. The missing Sub-agents and Skills nodes are not proven by this frame. REPORT.md:58: nodes appear progressively during replay.

## Entry 08

- File: `agent-builder-run-panel-hidden.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-run-panel-hidden.png`
- Bytes: 285991
- SHA-256: `f873b5d942635eacb737e7477939633580aafd1bb003c20de7b012402ac5e237`
- Site: Outglow
- Wireframes: W4
- Rows: G37, G47, G48, G49
- Seen: run panel hidden. Three columns remain: inputs, Agent/Instructions, Tools/Sub-agents/Skills. Zoom `100%` bottom centre. Sidebar full. Dotted grid. No reflow into a new topology. No node spinner.
- Freeze: hide removes the panel only. G48 columns stay. This is the comparison shot for "run panel hidden".

## Entry 09

- File: `agent-builder-search-typed.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-search-typed.png`
- Bytes: 258045
- SHA-256: `6998f0772864366501ac5e0fd4b0813b486bb0135e94dbf2255fec1536772f7a`
- Site: Outglow
- Wireframes: W1 filter, W4 behind it
- Rows: G17, G47, G48
- Seen: sidebar search contains `design`. No result list opened. Canvas still shows Schedule, Triggers, Channels, Memory, Agent, Instructions. No right column visible. Empty canvas right of Agent/Instructions. No node spinner. Run panel still streaming (`Thinking 1m 4s · 2.6k tokens`).
- Freeze: the filter accepts text. Do not invent results. An empty result is an empty state, not a failed page (W10). Do not drop the right column. Entries 01 and 08 are the complete G48 topology. The missing right column is not proven by this frame. REPORT.md:58: nodes appear progressively during replay.

## Entry 10

- File: `agent-builder-skills-show-tooltip.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-skills-show-tooltip.png`
- Bytes: 102004
- SHA-256: `e51f99f912832443c68c07fc4b9070bab2bcfd3eee7d3527f794f9d13aa15f21`
- Site: Outglow
- Wireframes: W12
- Rows: R32
- Seen: Skills table. Tooltip on `design-critique`: `Reviewing a screen or flow - returns issues ranked by severity.` A `Show` control sits on the truncated description. Columns: Name, Description, Type, Agents, Author, Updated. Packs row still above.
- Freeze: W12 table keeps truncated desc plus a way to read it. Do not drop the tooltip. Gutter not measured (R32).

## Entry 11

- File: `agent-builder-skills.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-skills.png`
- Bytes: 99329
- SHA-256: `6b63b20a249e3d90046b0e0291ccd046816f5498aad80138be3da77e6a7ad7c0`
- Site: Outglow
- Wireframes: W12
- Rows: R32, R53
- Seen: `Starter pack` row (Product design kit, Frontend engineer, Backend and infra, each `Add all`). `Browse library`. Table of 6 skills with profile chips and `+N`. Search `Search by name, type, etc...`. `Create skill` in the header. Light skin. Sidebar full.
- Freeze: W12 Skills packs plus sortable table (name, desc, type, profiles chips +N, author, updated). `Add all` is not given a new contract here. Breakpoints not measured (R53).

## Entry 12

- File: `agent-builder-workspace-menu.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/agent-builder-workspace-menu.png`
- Bytes: 104810
- SHA-256: `80b46de70ed38806c6d863d6cbf99ef55d52405304ea56a7848c846a781743f8`
- Site: Outglow
- Wireframes: W12 (menu over Skills, light)
- Rows: G17, O44
- Seen: same menu as entry 04, on the light Skills page. `Agents` / `Workbench`, Organization settings, Profile settings, Appearance (sun/moon), Support, What's new, Log out. Sidebar full underneath.
- Freeze: menu is an overlay. Cuts G19 and G77 stay cut. Appearance is not an Ops theme picker (D5 opens Desktop settings). Not the collapsed icon rail.

## Entry 13

- File: `orbit-agents.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/orbit-agents.png`
- Bytes: 121204
- SHA-256: `c90e06e17a92f60bd7eba7486a8402d96f4758efef192c22aff4ea378915d408`
- Site: Orbit
- Wireframes: W1 shell, W3 is not this shot
- Rows: O23, O44, O47
- Seen: Agents table, columns AGENT, STATE, NOW, MODEL, TOOLS. Seven rows. Forge `Blocked — DEPLOY_TOKEN is not set`. Inspector Agents | Context, groups ACTIVE / IDLE / OFFLINE. Footer `Run #218`, `Elapsed 3:54`, `Tokens 77.3k`. Dock TERMINAL / OUTPUT / PROBLEMS. Toast `Forge is blocked` / Resolve. Tab dots: orange on `page.tsx`, blue on `research.md`. Rail full. No agent card drawer.
- Freeze: O23 footer is legal here because a run is focused. Hide it when nothing is focused. O47 colours in the shot are not gold/champagne. This table is not W3.

## Entry 14

- File: `orbit-chat.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/orbit-chat.png`
- Bytes: 143537
- SHA-256: `770f7bb0c8d20701ec7f249ed105396f3b28c0bc3d52d4c92e58815a8ae70fed`
- Site: Orbit
- Wireframes: W1 shell. Not an Ops composer.
- Rows: O23, O44, O47
- Seen: Chat tab, scripted thread (You, Atlas, Sage). Composer `Ask Sage, or type @ to add context`, controls Context, Sage, `Opus 5.5`. Inspector footer `Run #218` / `4:14` / `83.4k`. Dock open. Rail full. Dots on `page.tsx` and `research.md`.
- Freeze: Ops does not embed this composer (P0-04 O32). Model name `Opus 5.5` is not P2 and is not copied. Footer still O23 (focused run only).

## Entry 15

- File: `orbit-home.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/orbit-home.png`
- Bytes: 123994
- SHA-256: `cc4e34cd40f79463908568dc112ac86f3e693e12f70e8758db8e6953a7c3ef60`
- Site: Orbit
- Wireframes: W2, W1, W8 excerpt
- Rows: O23, O44, O47
- Seen: Home. Centre orb is Atlas (yellow face), not sandhi. Orbiting labels Scout, Sage, Pixel, Quill, Forge (five). Composer `Ask Atlas anything, or describe a task...` and chips. Needs you: Quill, `Waiting for approval · headline`, Approve. Tasks table and Recent activity. Inspector footer `Run #218` / `0:27` / `14.3k`. Status bar `feat/landing`, `Run #218`, `2 agents working`, Motion: Full, `14.3k tok`. Rail full. Orange dot on `page.tsx`, blue dots on Chat and `research.md`. Toast `Quill needs your approval`.
- Freeze: D6 centre is sandhi. Do not copy Atlas. 8-orb cap is not visible (five orbs) and still holds. O47 dots stay gold/champagne, scoped by connection plus profile. O23 footer hides when no run is focused. This Needs-you row is the Office excerpt, not the whole of W8.

## Entry 16

- File: `orbit-settings.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/orbit-settings.png`
- Bytes: 105475
- SHA-256: `8fda7fedb249a307afc1e1cdcb8ef821aee343d7228c4a966a352a7881b07958`
- Site: Orbit
- Wireframes: W9
- Rows: O23, O44
- Seen: Settings. `Reduce motion` switch. `Default model` `Opus 5.5`. `Agent autonomy` `Ask first` / `Safe actions` / `Full`. Secrets `DEPLOY_TOKEN, ANALYTICS_KEY · granted per agent` and Manage. No theme control in the shot. Inspector footer still `Run #218`. Rail full. Dock open.
- Freeze: W9 theme opens Desktop settings (D5). Do not add a theme picker because the shot lacks one, and do not copy `Opus 5.5`. Secrets stay names only. Footer is O23.

## Entry 17

- File: `orbit-sidebar-collapsed.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/orbit-sidebar-collapsed.png`
- Bytes: 56893
- SHA-256: `bcc9a73aad5f19417a5cc1c454cd1af3ad5625212d6b8d302c31e4c1fc798e70`
- Site: Orbit
- Wireframes: W1 hidden-rail state, W5 is not this list
- Rows: O23, O44, O47, R53
- Seen: left nav is gone, not an icon strip. Titlebar still has Home, Build landing page, Chat, `page.tsx`, `research.md`, Tasks. Tasks table (TASK-142 running 0/6). Inspector still docked with footer `Run #218` / `0:03` / `1.6k`. No dock in this frame.
- Freeze: this is O44 hidden, not the under-1024 icon state (R53). Do not use it as the G17 icon rail; the icon appearance reference is entry 01. Tasks here are a table, not W5 columns.

## Entry 18

- File: `orbit-task-tab.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/orbit-task-tab.png`
- Bytes: 135303
- SHA-256: `8ec78419ac46892cd1dc2f9dcdf2f8a982f7deed64e78ed02b5a6e85d8229498`
- Site: Orbit
- Wireframes: W6
- Rows: O23, O44, O47, G54
- Seen: task tab `Build landing page`. Timeline: Quill needs approval (`Approve`, `Discuss`), Forge `pnpm install`, edit `page.tsx`, `pnpm test` 42 passed, `Deploy failed` / `DEPLOY_TOKEN is not set` with Resolve on that step. Dock repeats the token error. Inspector footer `Run #218` / `4:02` / `79.6k`. Rail full. Dots on `page.tsx` (orange) and `research.md` (blue). The failure is one timeline step. Other steps stay.
- Freeze: W6 header actions are Steer / Stop / Unblock, not Pause. No deploy-token grant dialog (O75 Cut). Error stays on the step (W10). O47 colours not copied. O23 footer hides if this run is not focused. G54 is not depicted; the step error is not a node skeleton.

## Entry 19

- File: `orbit-tasks-terminal-blocked.png`
- Path: `C:/Users/nachi/AppData/Local/Temp/opusspec/orbit-tasks-terminal-blocked.png`
- Bytes: 109109
- SHA-256: `5a5a3e29472e8f1d5f0d71b3e4ead2022b479b5fb5367b6394553d9da947b645`
- Site: Orbit
- Wireframes: W10, W1 dock. Not W5.
- Rows: O23, O44
- Seen: Tasks list. `TASK-142` status `Blocked`, 4/6, updated now. Other rows Completed. Dock: `Error: DEPLOY_TOKEN is not set for the preview environment.` Toast `Forge is blocked` / Resolve. Inspector footer `Run #218` / `2:20` / `49.3k`. Rail full. Page title and the other rows stay. Not a whole-page error.
- Freeze: W10 local failure. Do not add Grant access. Do not restyle this table into W5 kanban columns. O23 footer still focused-run only.

## Blocker B1

`x-post-status-2109638103346381298.png` is named in `C:/Users/nachi/AppData/Local/Temp/opusspec/REPORT.md` line 3. The file is not in that folder and was not found under `C:/Users/nachi/AppData/Local/Temp`. It is a phase-exit blocker. It was not replaced with another image, and it is not an Entry.

## Blocker B2

Gr8r Studio has no screenshot in the 19. REPORT section 1, line 15 describes the demo page and does not name a `gr8r-*.png`. R32 (one 24 px gutter) and R53 (1280 / 1024 / 800 on the Ops pane container) are frozen from SPEC section 12.3, SPEC row R53, and P0-04 `desktop-surface-audit.md` lines 100-114. They are not measured off a picture. No Orbit or Outglow shot was substituted for a Gr8r shot. W5 stays the SPEC fence.

## Note B3 (resolved, not a blocker)

The icon-rail appearance is depicted in entry 01. No shot proves G17 persistence across restart or R53's forced icons under a 1024 px container. Those stay frozen from P0-04 desktop-surface-audit.md:109,114 and SPEC.md:673 text. Entry 17 (hidden) is still not a stand-in for icons.

## Blocker B4

`REPORT.md` line 3 cites raw source `_raw/`. That directory is not in `opusspec`. It was not recreated. It is not a screenshot entry.

## Row coverage

| Row | Entries that carry it | Depicted? |
|---|---|---|
| O23 | 13, 14, 15, 16, 17, 18, 19 | Footer visible because a run is focused. Hide rule is the freeze, not a missing file. |
| O44 | 01, 02, 04, 12, 13, 14, 15, 16, 17, 18, 19 | Full (02-16, 18, 19), icons (01, appearance only) and hidden (17). Persistence and the R53 trigger are not depicted. |
| O47 | 13, 14, 15, 17, 18 | Dots depicted in orange/blue. Freeze colours differ. Scope is not a pixel in the shot. |
| G17 | 01, 02, 04, 09, 12 | Full sidebar 02/04/09/12. Icon collapse appearance in 01. Persistence not depicted (text-frozen, see Note B3). |
| G37 | 01, 03, 05, 07, 08 | Collapsible node headers depicted. |
| G47 | 01, 03, 05, 07, 08, 09 | Dotted grid depicted. Gold at 6% is the freeze, not the shot's grey. |
| G48 | 01, 03, 05, 07, 08, 09 | Three columns depicted in 01 and 08 (complete topology). 07 shows only a `Tools` node in the right column (Sub-agents/Skills not drawn, empty canvas to its right). 09 has no right column visible (empty canvas right of Agent/Instructions). Not proven by the frame. REPORT.md:58: nodes appear progressively during replay. Do not drop the right column. |
| G49 | 01, 03, 05, 07, 08 | Ports depicted in blue/orange. Freeze colours differ. |
| G54 | 01, 07, 18 | Depicted in 07 (per-node loading on Tools, neighbours unaffected; hue not copied, freeze is gold shimmer). Not depicted in 01 or 18. Not cut. |
| R32 | 01, 06, 10, 11 | Not measured. Number is SPEC 24 px. Gr8r shot missing (B2). |
| R53 | 06, 11, 17 | Not measured. Entry 17 is not the 1024 px rule (see Note B3). Gr8r shot missing (B2). |
