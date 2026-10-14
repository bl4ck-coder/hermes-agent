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