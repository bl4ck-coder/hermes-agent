# Ops panel P0.5 QA (P0.5-09)

Status: P0.5 phase QA evidence, recorded by Sandhi. Pairs with `phase-acceptance.md` section 3 (P05-X1 to P05-X9) and `reference-index.md`.
Tree: `ops/P0.5-09` on `feat/ops-panel` `635d1559741` plus this card's commits.

## Waiver (Nacho, 2026-10-13 16:46 ART)

Nacho skipped the screenshot part of P0.5-09. That covers:

- The Gold Night live screenshots: the 19-reference side-by-side for P05-X1 and the five-route captures for P05-X2.
- The Judge visual sign-off on those captures.

All Hermes model providers are out of tokens, so the judge and meta reviews for this card and for the phase exit were done by Sandhi directly, not by a Hermes judge profile. P05-X1 and P05-X2 are WAIVED, not PASS. Blockers B1, B2 and B4 in `reference-index.md` stay open as documentation of the missing captures. Earlier waivers stay as recorded on their cards: P0.5-06 (live Electron K1-K9), P0.5-07 (shimmer visual), and P0.5-08 (per-locale captures; "Ops" brand and token-provenance tooltip left untranslated).

## Evidence

Commands run in `apps/desktop` on Windows (Ignacio):

- `npm run lint`: exit 0. This card fixes the perfectionist sort errors and one `import()` type annotation in files touched by the ops panel.
- `npm run test:ui` (full, at `8bbf2a102a7`): 1207/1218 files, 10842/10889 tests pass, 30 fail, 17 skipped. All 30 are outside ops: (a) 4 fail identically on upstream base `865ba906c1a` (`store/voice-prefs.test.ts` x2, `plugins/hermes-bots/cron-detail.test.tsx` x1 and `cron-prompt.test.ts` x1, which are date and localStorage dependent); (b) 26 are 15 s timeouts plus cascades under full-suite load in `use-gateway-request`, `gateway-background-reconnect`, `tutorial-lifetime`, `session-states-profile-rename`, `branch-owner-routing.integration` and `providers-settings.terminal-disconnect`, and every one of those files passes when re-run in isolation on this branch.
- Typecheck plus the targeted vitest suites: `src/app/ops/shell.test.tsx` (10), `states.test.tsx` (11), `locales.test.ts` (45), `keymap.test.tsx`, `chrome.test.tsx`, plus `src/themes/gold-night.test.ts` and `presets.test.ts`.

| Id | Result | Pointer |
|---|---|---|
| P05-X1 | WAIVED (Nacho 2026-10-13 16:46 ART) | No captures. B1/B2/B4 open |
| P05-X2 | WAIVED for visual. Code half PASS | `src/themes/presets.ts:656` `DEFAULT_SKIN_NAME = 'gold-night'`; `gold-night.test.ts` |
| P05-X3 | PASS (code) | `presets.ts` `BUILTIN_THEMES` keeps non-gold-night built-ins; `RETIRED_SKINS` (`:662`) = nous-light, default, gold, without gold-night; `presets.test.ts` |
| P05-X4 | PASS (jsdom) | `shell.test.tsx` "chat stays usable with Ops open": typing in chat is not captured by Ops chords, and the draft is kept |
| P05-X5 | PASS (jsdom) | `shell.test.tsx` "full-screen round-trip keeps the chat node, its draft and a single mount"; pane widths 1440/1279/1023/799 against `narrowFromPane` |
| P05-X6 | PASS (jsdom) | `shell.test.tsx` "reduced motion scopes every glyph to the static path" |
| P05-X7 | PASS (jsdom) | `states.test.tsx` fault injection (sibling sections and nodes survive) and render-crash containment; `shell.test.tsx` filter isolation per connection/profile |
| P05-X8 | PASS (unit) | `locales.test.ts` (9 locales registered, rendered leaves, no missing keys); `npm run i18n:keys --check` |
| P05-X9 | PASS (unit) | `shell.test.tsx` "registers one chrome set, replaces it on scope change and unregisters on unmount" (titlebar Slot plus statusBar registry); no second composer, session list or profile editor added |

Accessibility of recovery states: `shell.test.tsx` checks role=status, aria-describedby, a named recovery action, and no focus steal.

## Phase exit

Signed by Sandhi as judge and meta (providers out of tokens): `PHASE PASS` `object: phase-exit` `task_or_phase: P0.5`, with P05-X1 and P05-X2 visual WAIVED by Nacho. This doc does not claim live Electron visual QA.
