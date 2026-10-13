# Gold Night tokens (P0-05)

Status: r2. Tokens, contrast, type, icons, focus, density, and the one gutter are frozen. This file does not edit a theme, a plugin, or a font binary.
Base: `2ab328a9c66` (`feat/ops-panel` after the P0-04 merge). Branch: `ops/P0-05`. Round 2 applies the meta r1 delta on `a90c6baf849`. Docs only.
Rows: O56 (sigil disc list in §6.3; the sigil rule is in `presence-motion.md`), G18, G76, R30 (shimmer colour only), R31 (duration tokens named here; the motion contract is in `presence-motion.md`). Also D5 and SPEC §12.3.
Wireframes W1–W12 and the 19-screenshot index are P0-08. This card does not sign visual fidelity. Judge signs that. Builder signs the arithmetic below.

Model policy P2 is not exercised. This slice writes no model, no `ops-policy.yaml`, and no profile config.

## 1. What is frozen, and what is not

Frozen for P0.5 to implement in `apps/desktop/src/themes/presets.ts` as preset name `gold-night`:

- App-wide default (D5, G18, G76). `DEFAULT_SKIN_NAME` is `nous` today (`presets.ts:462`). P0.5 changes that default. This commit does not.
- Other built-ins stay selectable (`BUILTIN_THEMES`, `presets.ts:444-456`). System stays selectable (G18, G76).
- Do not revive the retired name `gold` (`RETIRED_SKINS`, `presets.ts:468`).
- Do not rename or edit the installed plugin `aizurg-gold-night`.

Not frozen as passing text, and not signed:

- Light mode. `synthLightColors` (`themes/context.tsx`) may still synthesize a light variant. That synthesis is not in the table. P0.5 visual QA owns it.
- The plugin palette as a Desktop text ramp. It stays a reference. Several plugin pairs fail 4.5:1. They are recorded so they are not copied.
- Hairlines, the 6% top highlight, and the canvas dot grid. They are paint, not text.
- Glyph fills that the table marks non-text. They are not text tiers.

Supported reading surfaces for the 4.5:1 rule are exactly these three. Every other reading surface is an alias of one of them. A new surface is unsupported until it is added here and measured.

| Surface | Hex | Aliases |
|---|---|---|
| base | `#0E0D0B` | `background`, `sidebarBackground` |
| panel | `#16140F` | `card`, `muted` (the surface slot), toast, dock |
| raised | `#1F1B14` | `popover`, `input`, `userBubble`, inspector |

Action fills are not reading surfaces. Body tiers must not be painted on them. Each fill has one paired foreground, measured in §6.

## 2. Reconciliation with aizurg-gold-night

The plugin is not in this repo. Installed copy read, not written: `%LOCALAPPDATA%\hermes\desktop-plugins\aizurg-gold-night\plugin.js` (theme object at lines 5–69). Vault reference, not written: `01-Projects/Hermes/ops-console/tokens-casa.json`. SPEC §12.3 is the preset. The plugin remains a separate Appearance entry under its own name.

| Role | Plugin (unchanged) | SPEC §12.3 | Frozen on `gold-night` | Why |
|---|---|---|---|---|
| Base | `#040405` | `#0E0D0B` | `#0E0D0B` | SPEC names the app-wide surfaces. Plugin keeps its own bg. |
| Panel / card | `#0B0B0D` | `#16140F` | `#16140F` | Same. |
| Raised | none | `#1F1B14` | `#1F1B14` | SPEC. |
| Primary text | `#E6E4DC` | `#F2E8D5` | `#F2E8D5` | Both pass. SPEC ivory is the preset. |
| Secondary text | none | `#CDBB98` | `#CDBB98` | SPEC. Passes. |
| Tertiary / why | `#7C7A72` | `#9A8F7A` | `#9A8F7A` | Plugin muted is 4.203:1 on plugin `#161618` (fail). Not adopted. |
| Gold deep / button | `#B8922A` | `#C9A55A` | `#C9A55A` | SPEC gradient start. Plugin deep stays in the plugin. |
| Gold hi / focus | `#D4B056` | `#E8C77A` | `#E8C77A` | SPEC gradient end. Plugin hi stays in the plugin. |
| Garnet | `#C45C5C` | `#B4533C` | `#B4533C` glyph, `#FFFFFF` on that fill | Plugin bad is 4.108:1 on raised (fail as text). SPEC garnet also fails as text (3.463:1). See §6. |
| Connected | `#3ECF8E` | one muted sage, no other green | `#6F8F72` | Plugin green is not muted sage. Not copied. |
| Font | Segoe UI / Cascadia | Geist, bundled, no Google Fonts | §4 | Plugin stack stays in the plugin. |
| Motion | 160/220 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)` | 140/220/320 and the two §12.3 eases | SPEC | Plugin motion is not copied. |

No liquid-glass. No kanban-column chrome. Those plugin exclusions stay exclusions for the preset too.

## 3. Surfaces, accents, hairlines

Reading surfaces are §1. Paint on top of them:

| Token | Value | Use |
|---|---|---|
| `--gn-highlight` | `#E8C77A` at 6% | 1 px inner top edge. Not text. |
| `--gn-hairline-separator` | `#E8C77A` at 12% | Panel separators. |
| `--gn-hairline-card` | `#E8C77A` at 8% | Card edges. |
| `--gn-grid-dot` | `#E8C77A` at 6% | Canvas dot grid only. |

Opaque composites of `#E8C77A` over the reading surfaces (sRGB, alpha premultiplied, channels rounded). Desktop `border` is one hex, so the theme object uses the 12%-on-panel composite. Ops CSS uses the alpha tokens, not this stand-in, so a hairline on base is still 12% of gold over base.

| Over | 6% | 8% | 12% |
|---|---|---|---|
| base `#0E0D0B` | `#1B1812` | `#1F1C14` | `#282318` |
| panel `#16140F` | `#231F15` | `#272218` | `#2F291C` |
| raised `#1F1B14` | `#2B251A` | `#2F291C` | `#373020` |

`border` / `sidebarBorder` / `userBubbleBorder`: `#2F291C`.

`input` is `#1F1B14` here, in §1 (raised alias), and in §5. It is not a border hex. Every theme-object key in §1, §3, and §5 has exactly one hex.

Accent. The gradient `#C9A55A` → `#E8C77A` is primary actions and focus only. It is not body text, not a surface wash, and not a second text ramp. The presence working glyph and its working/thinking/tool label may use `#E8C77A` (SPEC §12.3 ● gold). No other text uses the accent. No text uses `#C9A55A`.

| Slot | Hex | Role |
|---|---|---|
| `primary` | `#C9A55A` | Primary button fill. Gradient start. |
| `primaryForeground` | `#0E0D0B` | Ink on that fill. 8.337:1. Ivory on this fill is 1.917:1 and is forbidden. |
| `ring`, `midground`, `composerRing` | `#E8C77A` | Focus and brand stroke. Gradient end. |
| `accent` | `#C9A55A` | Same family as `primary`. Not a second hue. |
| `accentForeground` | `#0E0D0B` | Ink if `accent` is used as a fill. |
| `destructive` | `#B4533C` | SPEC garnet fill. |
| `destructiveForeground` | `#FFFFFF` | Only measured ink that clears 4.5:1 on `#B4533C` (4.949:1). `#0E0D0B` is 3.925:1. `#F2E8D5` is 4.072:1. Both fail. |

Accent variants. `accent-override.ts` is a DEV-only scratch atom. It is not persisted (`accent-override.ts:1-13`). Production `gold-night` paints the authored hexes above with the override null.

Two seeds are safe to feed that override as fills, because both clear 4.5:1 with `#0E0D0B` ink. The "if painted as text" column is a contrast fact only. It is not a license to use either hex as body text. Production text follows the carve-out above.

| Seed | Hex | If painted as text, min on raised (not a text license) | Ink `#0E0D0B` on the fill |
|---|---|---|---|
| deep (default) | `#C9A55A` | 7.357:1 | 8.337:1 |
| hi | `#E8C77A` | 10.514:1 | 11.916:1 |

`retintColors` also rewrites `secondary` and `userBubble` (`themes/retint.ts:114-116`). Those two slots are graphite in this preset (`secondary` = `#1F1B14`, `userBubble` = `#1F1B14`). A retint that leaves them as gold mixes is not this preset. P0.5, if it calls `retintTheme`, must write the frozen graphite surfaces back after the retint. This commit does not call it.

`secondaryForeground` and `popoverForeground` and `cardForeground` are `#F2E8D5`.

## 4. Type, bundled fonts, icons, focus, density, gutter

Type sizes are the SPEC §12.3 set. No other size is introduced here.

| Use | Size | Face | Numerals |
|---|---|---|---|
| Body, default | 13 px | Geist | — |
| Body, compact (`@media (max-height: 768px)`, already `styles.css:93`) | 12 px | Geist | — |
| Table cell | 13 px | Geist | tabular where the value ticks |
| Table row | 32 px | — | — |
| Rail row | 28 px | Geist | — |
| Why footer | 12 px | Geist | — |
| Ticking values (age, tokens, elapsed, counts) | inherit | Geist Mono | `font-variant-numeric: tabular-nums` |

Fonts. SPEC §12.3: Geist / Geist Mono, bundled locally, no Google Fonts fetch.

What the tree has today: `@font-face` for JetBrains Mono only (`styles.css:105-124`), files `src/fonts/JetBrainsMono-Regular.woff2`, `JetBrainsMono-Bold.woff2`, `JetBrainsMono-Italic.woff2`. Collapse Bold is loaded from `node_modules` (`styles.css:95-100`). Geist is not in the tree. This commit does not add font binaries. The deliverable is this sheet.

P0.5 bundle, next to those woff2 files, `fontUrl` omitted (a remote stylesheet is a Google-Fonts-class fetch and is forbidden):

| File | family | weight | style |
|---|---|---|---|
| `src/fonts/Geist-Regular.woff2` | Geist | 400 | normal |
| `src/fonts/Geist-Medium.woff2` | Geist | 500 | normal |
| `src/fonts/GeistMono-Regular.woff2` | Geist Mono | 400 | normal |

`@font-face` shape matches `styles.css:105-110` (`font-display: swap`, `url('./fonts/...')`). License to ship with the files: SIL OFL-1.1 (Geist, Vercel). Fallback stack, only if the face is missing, is the existing `SYSTEM_SANS` / `SYSTEM_MONO` (`presets.ts:32-44`), which already starts mono at the bundled JetBrains Mono. The plugin's Segoe / Cascadia stack is not the preset stack.

Icons. `lucide-react` `0.577.0` is already the dependency (`apps/desktop/package.json:132`). Stroke `1.5`. Sizes: 14 px on rail, table, and status; 16 px on inspector, toast, and empty. No new icon package. Presence shapes are the glyphs in `presence-motion.md`, not lucide icons.

Focus ring. 2 px ivory `#F2E8D5` inner, 2 px gold `#E8C77A` outer, 2 px offset. It wraps the control, never the glyph. It is a hollow ring around the row, button, or chip. Working is a filled disc that pulses. A ring must not be used as the working glyph. The reduced-motion working substitute is the filled 8 px disc plus a 1 px stroke that meets the disc at 0 px gap (geometry in `presence-motion.md`). That stroke is the disc's edge, not this focus ring, and not the needs-you ◉. Both ring colours clear 3:1 against raised (ivory 14.104:1, gold hi 10.514:1). `ring` / `midground` / `composerRing` are the outer gold, not the button fill `#C9A55A`.

Density and gutter. One gutter: `--gn-gutter: 24px` (SPEC §12.3, Gr8r R32). No second gutter variable. Row heights above are the density. Do not add a compact gutter.

## 5. Theme-object map (P0.5, not applied here)

`colors` and `darkColors` are the same object. Name `gold-night`. Label `Gold Night`. Do not register it as `aizurg-gold-night` or `gold`.

| Key | Hex |
|---|---|
| background | `#0E0D0B` |
| foreground | `#F2E8D5` |
| card | `#16140F` |
| cardForeground | `#F2E8D5` |
| muted | `#16140F` |
| mutedForeground | `#9A8F7A` |
| popover | `#1F1B14` |
| popoverForeground | `#F2E8D5` |
| primary | `#C9A55A` |
| primaryForeground | `#0E0D0B` |
| secondary | `#1F1B14` |
| secondaryForeground | `#F2E8D5` |
| accent | `#C9A55A` |
| accentForeground | `#0E0D0B` |
| border | `#2F291C` |
| input | `#1F1B14` |
| ring | `#E8C77A` |
| midground | `#E8C77A` |
| midgroundForeground | `#0E0D0B` |
| composerRing | `#E8C77A` |
| destructive | `#B4533C` |
| destructiveForeground | `#FFFFFF` |
| sidebarBackground | `#0E0D0B` |
| sidebarBorder | `#2F291C` |
| userBubble | `#1F1B14` |
| userBubbleBorder | `#2F291C` |

Typography on the preset: `fontSans` starts with `Geist`, `fontMono` starts with `Geist Mono`, then the existing fallbacks. `fontUrl` omitted.

## 6. Contrast

Tool: `@hermes/shared/color` `contrastRatio` (`apps/shared/src/color.ts:67-94`).

Formula, copied from that file so a judge can reproduce without this worktree's `node_modules` (there are none):

- Channel: `c = value/255`. If `c <= 0.03928` then `c/12.92`, else `((c+0.055)/1.055) ** 2.4`.
- `L = 0.2126*R + 0.7152*G + 0.0722*B`.
- Ratio `(max(L)+0.05)/(min(L)+0.05)`.

Runner: Python 3.14.7 stdlib, same arithmetic. Script was not committed (deliverable is this file and `presence-motion.md`). Inputs and outputs are below. Floor is 4.5:1 for every text tier on every supported reading surface. Non-text glyph floor used only as a note is 3:1. It is not the acceptance floor.

r2 additions (stale `#A89880`, the four §6.3 discs) were recomputed with that formula in Python 3.14.7 and in Node. Disc channels use `Math.round(a + (b - a) * t)`, the same half-up rule as `color.ts` `mix`. The two runners agree to 0.001. Ratios below are that output rounded to 3 decimals. FAILS 0.

Surface luminance from that run: base `0.004054`, panel `0.007054`, raised `0.011257`. Worst reading surface for light text is raised.

### 6.1 Text tiers on reading surfaces

Every row is a text tier, including Why footer and state copy. Minimum must be ≥ 4.5.

| Tier | Hex | On base | On panel | On raised | Min | Verdict |
|---|---|---|---|---|---|---|
| primary | `#F2E8D5` | 15.983 | 15.143 | 14.104 | 14.104 | pass |
| secondary / idle copy / done copy | `#CDBB98` | 10.321 | 9.778 | 9.107 | 9.107 | pass |
| tertiary / why footer / unknown copy | `#9A8F7A` | 6.090 | 5.770 | 5.374 | 5.374 | pass |
| working glyph / working copy / thinking copy / tool copy | `#E8C77A` | 11.916 | 11.289 | 10.514 | 10.514 | pass |
| stale glyph / stale copy | `#A89880` | 6.908 | 6.545 | 6.096 | 6.096 | pass |
| needs-you copy | `#D4893A` | 6.881 | 6.519 | 6.072 | 6.072 | pass |
| blocked copy / failed copy | `#BF6D59` | 5.131 | 4.861 | 4.528 | 4.528 | pass |
| offline copy | `#8A8376` | 5.170 | 4.898 | 4.562 | 4.562 | pass |
| connected copy | `#6F8F72` | 5.409 | 5.125 | 4.773 | 4.773 | pass |

Why footer is not a fourth hex. SPEC §12.3 asked for a solid hex at ≥ 4.5:1 on `#16140F`. Tertiary `#9A8F7A` on panel is 5.770:1, and it also clears raised (5.374:1), so the footer uses that solid. No translucent why text.

The working row is the §3 carve-out. No other text uses `#E8C77A` or `#C9A55A`. Stale is the hatched-neutral family with unknown (`#9A8F7A`), not the accent. Shape ◍ and the label `stale` keep it apart from unknown ◌. The stale glyph uses the same hex as the stale copy because both clear 4.5:1.

Needs-you amber `#D4893A` is not a SPEC hex. SPEC said "amber" and gave no hex. This one clears 4.5:1 and is not the gold pair. Connected sage `#6F8F72` is the same kind of fill-in: SPEC required one muted sage and gave no hex. Plugin `#3ECF8E` was measured (8.587:1 on raised) and rejected because it is not muted sage.

Blocked copy is a lift, not the SPEC glyph. Inputs: `#B4533C` on raised is 3.463:1 (fail). The runner mixed that hex toward `#FFFFFF` until the minimum cleared 4.5:1. Output hex `#BF6D59`. Measured minimum 4.528:1 on raised. The SPEC glyph `#B4533C` stays the non-text triangle. It is not a text tier.

### 6.2 Not text tiers (recorded so they are not used as text)

| Paint | Hex | On base | On panel | On raised | Min | As text |
|---|---|---|---|---|---|---|
| SPEC garnet glyph | `#B4533C` | 3.925 | 3.719 | 3.463 | 3.463 | fail (clears 3:1) |
| Offline glyph | `#6E675C` | 3.476 | 3.293 | 3.067 | 3.067 | fail (clears 3:1) |
| Plugin muted | `#7C7A72` | 4.518 | 4.280 | 3.986 | 3.986 | fail on panel and raised |
| Plugin bad | `#C45C5C` | 4.655 | 4.410 | 4.108 | 4.108 | fail on panel and raised |

Plugin muted on the plugin's own `#161618` is 4.203:1 (fail). Plugin ink `#E6E4DC` on plugin `#040405` is 16.097:1 (pass) and is still not the preset text.

### 6.3 Sigil discs (O56)

K = 4 gold-tint discs. They are the sRGB stops of `#C9A55A` → `#E8C77A` at t = 0, 1/3, 2/3, 1. Channel = `Math.round(a + (b - a) * t)`. Each is measured with monogram ink `#0E0D0B`. Floor 4.5:1. Ivory `#F2E8D5` on every stop is ≤ 1.917:1 and is forbidden.

O56 requires a gold-tint disc. These four fills are that disc. They are fills, not text, and not a second text ramp. The only text on a disc is `#0E0D0B`. The §3 carve-out is unchanged.

| Index | t | Disc | Ink `#0E0D0B` | Ivory `#F2E8D5` | Verdict |
|---|---|---|---|---|---|
| 0 | 0 | `#C9A55A` | 8.337 | 1.917 | pass (ink) |
| 1 | 1/3 | `#D3B065` | 9.405 | 1.699 | pass (ink) |
| 2 | 2/3 | `#DEBC6F` | 10.664 | 1.499 | pass (ink) |
| 3 | 1 | `#E8C77A` | 11.916 | 1.341 | pass (ink) |

These discs are not theme-object keys. They do not change the one-hex rule in §1, §3, and §5. The pick rule is in `presence-motion.md` §1.4: `list[hashString(trimmed name) % 4]`.

### 6.4 Paired foregrounds on action fills

| Ink | Fill | Ratio | Verdict |
|---|---|---|---|
| `#0E0D0B` | `#C9A55A` primary | 8.337 | pass, frozen |
| `#000000` | `#C9A55A` | 9.013 | pass, not used (base ink is enough) |
| `#F2E8D5` | `#C9A55A` | 1.917 | fail, forbidden |
| `#FFFFFF` | `#C9A55A` | 2.330 | fail, forbidden |
| `#0E0D0B` | `#E8C77A` | 11.916 | pass, if that gold is a fill |
| `#F2E8D5` | `#E8C77A` | 1.341 | fail, forbidden |
| `#FFFFFF` | `#B4533C` destructive | 4.949 | pass, frozen |
| `#000000` | `#B4533C` | 4.243 | fail |
| `#0E0D0B` | `#B4533C` | 3.925 | fail |
| `#F2E8D5` | `#B4533C` | 4.072 | fail |

State copy for blocked is `#BF6D59` on reading surfaces, not ivory on the garnet fill. The destructive button's label is `#FFFFFF` on `#B4533C`. Those are different pairs. Do not swap them.

## 7. W1–W12 contract (colour only)

Every W screen uses this sheet. No screen gets a local palette. ASCII wireframes and the screenshot index are P0-08.

| Screen | Must use |
|---|---|
| W1, W1b | Reading surfaces, 24 px gutter, focus ring, fresh-count colours from `presence-motion.md` |
| W2 | Legend colours from that file, why footer `#9A8F7A` on panel |
| W3 | Monogram ink `#0E0D0B` on the hashed disc from §6.3 (ivory on any of those discs is ≤ 1.917:1 and is forbidden) |
| W4 | Node surfaces are panel/raised. Why line is the why tier. |
| W5 | Card surface panel, hairline 8%, sigil pair above |
| W6, W7, W8 | Text tiers only. Tokens and ages are tabular. |
| W9 | Theme row opens Desktop settings (D5). It does not embed a second palette. |
| W10 | Empty / error / stale copy use tiers in §6.1. Loading shimmer is `--gn-hairline-card` (8% gold), not a text colour. |
| W11, W12 | Text tiers. Table row 32 px. One gutter. |

R30 skeletons, empty, and error use these colours. Their motion is in `presence-motion.md`.
