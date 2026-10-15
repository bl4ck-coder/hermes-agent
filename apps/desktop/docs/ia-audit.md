# Hermes Desktop: information architecture audit (first pass)

Scope: every main screen, presentation only. Behaviour, data and tests are unchanged.
Evidence: `/workspace/ops-live/glass/` on the agent box (`pair-<screen>.png` before|after, `before/`, `after/`,
`side-by-side-carnave-vs-hermes.png`). Live rounds: `b31r1` (before) and `glass2` (after).

Legend: **Done** = landed in this pass and checked in the live screenshot. **Next** = audited, not yet changed.

## Settings (overlay)
- **Who comes here to do what:** change the model, provider and keys for a profile. Then appearance and the gateway.
- **Before:**
  - The "Applies to" wall of 40 profile chips sat above every page and pushed the model controls below the fold.
  - The left nav is a flat list of 20 categories with no grouping.
  - The current page in the nav was only a faint border.
- **After (Done):**
  - "Applies to" folds into a disclosure once there are more than 8 profiles. The summary shows the current target as a chip plus the profile count. The chips are one click away, and the scope note is unchanged.
  - The current nav row is a gold glass pill (it uses the existing `aria-current="page"`).
- **Next:**
  - Group the nav under headers: *Core* (Model, Chat, Appearance, Workspace), *Data & safety* (Safety, Passwords, Memory, Sessions), *Connections* (Providers, Gateway, Tools & keys, Plugins, Browser, Voice), *System* (Notifications, Shortcuts, Billing, Advanced, About).
  - Collapse *Advanced* by default.

## Profiles (overlay)
- **Who comes here to do what:** pick a profile and edit its SOUL.md.
- **Before:** the SOUL.md editor showed 3 lines in a thin box, and Save floated far below on the right. The page looked empty.
- **After (Done):** the editor fills up to 55vh (30rem cap), and Save sits directly under it.
- **Next:** when there are more than 12 profiles, group the long list by lane or tenant, and add "Create profile" as a pinned primary action at the top of the list.

## Scheduled tasks / Cron (overlay)
- **Who comes here to do what:** see whether jobs ran and what happened.
- **Before:** each history row repeated the raw markdown boilerplate (`# Cron Job: … **Job ID:** … **Mode:** …`), and the outcome was cut off at the far right.
- **After (Done):** rows read "COMPLETED · silent (empty output)", using `cronRunLabel`. Plain titles pass through unchanged.
- **Next:** colour status chips (completed, failed, silent), and put the templates list under a collapsed "Start from a template".

## Command center / Sessions (overlay)
- **Who comes here to do what:** find and reopen a past session.
- **Before / after:** a long undated-feeling list, with its search field far top-right, away from the list. Only the glass card and nav pill changed.
- **Next:** date-group headers (Today, This week, Earlier), a search field above the list, and row actions revealed on hover.

## Chat
- **Who comes here to do what:** talk to an agent.
- **Before / after:** the structure is clear: sidebar (sessions, pinned, plugins), centred composer, right inspector. The glass pass adds the gold-pill active row, uppercase gold group labels, glass inputs and a press scale on buttons.
- **Next:** an empty-state teaching line under the wordmark (3 example prompts), and session groups collapsible by default after 10 rows.

## Agents (overlay)
- **Before / after:** the empty state reads "No hay conversaciones activas" only.
- **Next:** a teaching empty state that says what an agent conversation is, plus a primary "Start one" action.

## Ops panel (Office, Board, Canvas, Fleet, Teams, Skills, Channels, Settings, Diagnostics)
- **Covered by B17–B31** (see `docs/ops-panel/release-evidence.md`): grouped lenses, status lights, counts, segmented switchers, empty states, and progressive disclosure (e.g. secrets that aren't set are collapsed).
- **This pass:** glass sheen and highlight on the settings groups, strip, toolbar, team cards and channel cards, and a glass toast.
- **B31:** probe chips drop the redundant "available" (still read to screen readers), secrets use the full row in 3 columns, and channel copy is clamped.

## Design-system notes (glass layer)
- **Files:**
  - `src/styles/glass/glass.css`: tokens, primitives, the app-wide `data-slot` pass, overlay cards and fallbacks.
  - `src/components/ui/glass.tsx`: `GlassPanel`, `GlassPill`, `GlassButton`, `Glow`.
- **Sources:**
  - Carnave `CartDrawer.module.css`: sheet gradient 170deg, blur 24 / saturate 1.8, inset highlights, two-layer shadow, sheen 165deg, spring easing.
  - Carnave `CartDock`: blur 22 / saturate 1.7, pill radius.
  - Carnave `Nav`: blur 18 / saturate 1.15, with a reduced fallback.
  - All re-cut in Gold Night (ink #0E0D0B, panel #16140F, raised #1F1B14, gold #C9A55A / #E8C77A, ivory #F2E8D5).
- **Blur budget:**
  - `backdrop-filter` only on dialogs and sheets plus their scrims (at most 2 stacked).
  - None on menus, popovers, tooltips, the sidebar, overlay cards, Ops lenses or toasts (the Ops toast sits over the animated Office).
  - A test enforces this (`glass.test.tsx`).
- **Fallbacks:**
  - `prefers-reduced-transparency` gives opaque fills; the existing app-wide rule already drops blur.
  - `prefers-contrast: more` gives stronger edges.
  - `prefers-reduced-motion` removes the press scale; the existing blanket rule zeroes durations.
- **Contrast:**
  - Text colours are unchanged: ivory #F2E8D5 on panel is about 15:1, and gold-hi #E8C77A on the gold-tinted pill is about 10:1.
  - The fills are at least 0.94 opaque on overlay cards, so AA holds.

## Glass pass 3 follow-up (glass6–glass11)

| Screen | Before | After |
|---|---|---|
| Profiles · SOUL.md | Editor used the GitHub-light ink (#1f2328) on Gold Night, so the prompt was close to invisible; a cream 2px box framed only the text, and only the first ~60px took clicks. | The editor follows the painted mode (as the terminal does), so the ink is legible. The whole frame is the click target and focus shows as one gold glow on the frame. |
| Office / Agents / Skills / Channels titles | Same weight and size as the body, so nothing said "this is the page". | Editorial serif display title in lit gold (Carnave's "Lo que ve el socio" treatment); the greeting is the largest. |
| Capabilities / Artifacts / Messaging | The page-shell body repainted the flat surface over the lit shell, so these pages looked unlit next to chat. | The shell's ambient light and spotlight show through. |
| Artifacts load | A warning toast on most boots ("Skipped N of 30 …") caused by the profile-backend pool (slot wait, cancelled start, back-off after saturation, retired idle backend). | Pool states get one delayed retry, then are skipped quietly; only real read errors and safe-limit skips warn. |

## B32 (glass12-glass14)

| Screen | Before | After |
|---|---|---|
| Artifacts | Spinner for more than 15 s while 30 sessions were read one by one. | The first load streams: the list fills session by session, and a refresh swaps in the full list only when it is complete. The loader yields between sessions. |
| Ops Settings | Shortcuts and Security were fully expanded, so the page ran about three screens long. | Both fold behind a one-line summary with a hint of what is inside (8 locales). |
| Office | The greeting was 20 px (a (0,0,1) rule beat the display size). | 34 px editorial serif in gold. |
| Board | Flat cards. | Lit cards: a gold-tinted gradient, an inner highlight, a soft drop and a hover edge. |
| Agents (empty) | A small line of text in a blank overlay. | The empty state sits on a lit glass card. |
## B33 layout batch (glass15-glass18)

| Screen | Before | After |
|---|---|---|
| Artifacts | Files and links appeared only as table rows. | The newest 8 appear as preview cards (type or host badge, name, session, time) above the table. |
| Cron | Dozens of identical "Completado - silent (empty output)" rows. | Consecutive identical runs fold into one row with a count, and each run is still one click away inside the fold. |
| Fleet / Skills | Table only. | A Table/Cards pill (remembered per lens). Cards show the name and every non-empty column as label:value. |
| Skills Hub | A white cross-origin page inside Gold Night. | Opens with Docusaurus' `docusaurus-theme=` query matching the painted mode, in a rounder, deeper frame. |
| Board | Flat columns. | Lit columns with a gold top wash and an inner highlight. |
| Office (below the Orbit) | The dispatch bar and Needs-you list sat flat. | The dispatch bar is lit; Needs-you is a lit card with row hover. |
| Canvas / Teams / Channels / Diagnostics / Sessions / App Settings | | One upgrade each: a dot grid plus a selected-node glow; busy-team glow; app card hover lift plus a connected rim; probe rows with an inner highlight; gold date-group headers; a lit active nav pill. |
## B34–B35b (2026-10-14, glass19–glass22)

- B34: Artifacts preview thumbnails (GitHub OG / monogram), Office "now running" hero, Fleet avatars + status rings, Diagnostics/Ops Settings/Profiles heroes, Agents ring illustration, Skills card capture fixed.
- B35: OG thumbnails cached locally (Cache Storage `hermes-artifact-thumbs-v1`; any failure falls back to the monogram; tested). Shared `HeroBand` for Cron, Sessions (14-day spark), App Settings and Capabilities. Teams avatar stack, Channels connected ring, Canvas profile header, Board column flow bar, Chat emblem. Diagnostics ring hole fixed; Agents single card; Settings hero captured.
- B35b: Skills hero (enabled ring + category chips), Agents hero always shown, Profiles identity card, live run waits for Office stats and frames the Canvas hero.
- Evidence: glass22 frames p95 15.1–15.2 ms, max 29.6 ms, 0 frames over 33 ms. Gateway untouched (restarted externally at 21:17 ART; now pid 237584).

## B36–B37b (2026-10-14, glass23–glass27): independent judge passes

- Score of record is now the independent judge (`judge` profile, gpt-6.1-sol), not self-scores. Pass 1 (B35b) / pass 2 (B36c) / pass 3 (B37): Office 7/7/7, Chat 7/7/7, Skills 5/6/6, Channels 5/6/6, App Settings 5/6/6, Agents 5/6/6, Capabilities 5/5/5, Cron 5/5/5, every other screen 6. Raw outputs: `kanban/workspaces/judge-reviews/judge-pass{1,2,3}-*.txt`.
- B36: Agents status buckets (interrupted counts as failed), empty-state illustration and copyable example; Office "unknown" vs quiet; Artifacts skipped-sessions note with Retry; thumbnail opt-out, 7-day TTL, LRU; Settings hero removed, section/row hooks; Channels connected-first; Skills packs fold; roster descriptions.
- B36b: glass card for settings pages without sections. B36c: the active profile's sessions load first (Artifacts first paint).
- B37: skipped sessions split idle/unreachable and shown in every state; per-entry cached-at timestamp, reference-counted blob revocation; connected channels no longer repeat in the catalog; i18n/a11y fixes; live run fails when Office stats never resolve.
- B37b: thumbnail opt-out re-checked when a pending fetch lands, same-window preference event; roster descriptions span the card (verified in glass27).
- Evidence: glass27 p95 15.1–15.2 ms; board drag 4 paired compositor frames up to 44 ms with no main-thread cost (glass24/25 clean on the same code).
- B38 (judge top-5 layout): Capabilities Installed/Explore modes, Cron next-run/last-result tiles, roster card geometry, App Settings decision blocks with "0 = Auto", Profiles SOUL editor at reading scale, visible "Artifact previews" toggle in Ops Settings (on by default; off makes no request).
- Open: a few structural/unscoped glass.css selectors; the live script dismisses alerts before capture; `providers-settings.terminal-disconnect` fails on baseline too.
