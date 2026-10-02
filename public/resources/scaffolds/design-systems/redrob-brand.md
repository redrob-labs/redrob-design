---
version: "1"
name: Redrob 브랜드
description: >
  Redrob brand design system (Redrob 브랜드). The Redrob Group Design System 2026
  token set: brand primitives, light and dark semantic roles, Pretendard
  typography, spacing and radius scales. Values are the ones published in
  @redrob-labs/ui (tokens.css / tokens.json). Copy to DESIGN.md to put a workspace
  on Redrob brand, or resolve it as tokens with @redrob-design/brand.
colors:
  # ── Layer 1. Brand primitives ────────────────────────────────────────────
  # Theme-independent. Blue 6 is Redrob Blue. Keys are the @redrob-labs/ui
  # custom-property names minus the leading dashes, so a resolver maps blue-6 to
  # --blue-6 with no lookup table in the middle.
  redrob-black: "#0a0b0c"
  redrob-white: "#ffffff"
  blue-1: "#eef4ff"
  blue-2: "#d9e6ff"
  blue-3: "#bad2ff"
  blue-4: "#8aafff"
  blue-5: "#507fff"
  blue-6: "#2b52ff"
  blue-7: "#1733d5"
  blue-8: "#09209c"
  blue-9: "#061460"
  blue-10: "#030c34"
  gray-1: "#f8f9fb"
  gray-2: "#eff1f4"
  gray-3: "#dfe2e8"
  gray-4: "#cbcfd7"
  gray-5: "#aab0bb"
  gray-6: "#7c8390"
  gray-7: "#576071"
  gray-8: "#292e37"
  gray-9: "#141719"
  accent-green-3: "#29e474"
  accent-green-4: "#00864a"
  accent-orange-3: "#ff9c1b"
  accent-orange-4: "#ae5100"
  accent-red-3: "#ff4b4b"
  accent-red-4: "#a31310"
  accent-sky-3: "#2f8dff"
  accent-sky-4: "#0e51b6"

  # ── Layer 2a. Semantic roles, light ──────────────────────────────────────
  # The only layer product surfaces read.
  surface-base: "#ffffff"
  surface-raised: "#f8f9fb"
  surface-sunken: "#eff1f4"
  surface-brand: "#2b52ff"
  surface-brand-subtle: "#eef4ff"
  surface-ai: "#eef4ff"
  border-subtle: "#dfe2e8"
  border-strong: "#7c8390"
  border-ai: "#bad2ff"
  ink-primary: "#0a0b0c"
  ink-secondary: "#576071"
  ink-muted: "#686e78"
  ink-brand: "#1733d5"
  ink-on-brand: "#ffffff"
  action-primary: "#2b52ff"
  action-primary-hover: "#1733d5"
  focus-ring: "#2b52ff"
  status-success: "#00864a"
  status-warning: "#ae5100"
  status-danger: "#a31310"
  status-info: "#0e51b6"

  # ── Layer 2b. Semantic roles, dark ───────────────────────────────────────
  # Same roles re-pointed. Redrob Black is the dark page and Gray 9 the raised
  # layer above it. Status steps from level 4 to level 3 of each accent.
  dark-surface-base: "#0a0b0c"
  dark-surface-raised: "#141719"
  dark-surface-sunken: "#1c1f26"
  dark-surface-brand: "#2b52ff"
  dark-surface-brand-subtle: "#030c34"
  dark-surface-ai: "#030c34"
  dark-border-subtle: "#292e37"
  dark-border-strong: "#7c8390"
  dark-border-ai: "#09209c"
  dark-ink-primary: "#f8f9fb"
  dark-ink-secondary: "#aab0bb"
  dark-ink-muted: "#838a97"
  dark-ink-brand: "#8aafff"
  dark-ink-on-brand: "#ffffff"
  dark-action-primary: "#2b52ff"
  dark-action-primary-hover: "#507fff"
  dark-focus-ring: "#8aafff"
  dark-status-success: "#29e474"
  dark-status-warning: "#ff9c1b"
  dark-status-danger: "#ff4b4b"
  dark-status-info: "#2f8dff"
typography:
  display:
    fontFamily: "Pretendard, 'Wanted Sans', 'Noto Sans Devanagari', system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 72px
    fontWeight: 800
    lineHeight: 72px
    letterSpacing: -0.035em
  heading:
    fontFamily: "Pretendard, 'Wanted Sans', 'Noto Sans Devanagari', system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 36px
    fontWeight: 700
    lineHeight: 42px
    letterSpacing: -0.022em
  subhead:
    fontFamily: "Pretendard, 'Wanted Sans', 'Noto Sans Devanagari', system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 21px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: -0.012em
  body:
    fontFamily: "Pretendard, 'Wanted Sans', 'Noto Sans Devanagari', system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: -0.003em
  caption:
    fontFamily: "Pretendard, 'Wanted Sans', 'Noto Sans Devanagari', system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 11px
    fontWeight: 400
    lineHeight: 16px
    letterSpacing: 0em
  label:
    fontFamily: "Pretendard, 'Wanted Sans', 'Noto Sans Devanagari', system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 18px
    letterSpacing: 0em
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 24px
  full: 9999px
spacing:
  unit: 4
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  2xl: 32px
  3xl: 48px
  4xl: 64px
components:
  button-primary:
    backgroundColor: "{colors.action-primary}"
    textColor: "{colors.ink-on-brand}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "{spacing.lg}"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  chip:
    backgroundColor: "{colors.surface-brand-subtle}"
    textColor: "{colors.ink-brand}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
---

## Overview

Redrob's own design system, the Redrob Group Design System 2026. One brand,
seven product surfaces: Router, Chat, Code, Desk, Office, Browser and Design.
The point of this file is that a colour is decided in exactly one place, so the
products cannot drift apart.

Two layers, and only two. Primitives (`blue-*`, `gray-*`, `accent-*`, Redrob
Black and White) are the brand's confirmed HEX values and carry no meaning.
Semantic roles (`surface-*`, `border-*`, `ink-*`, `action-*`, `status-*`, and
`dark-*` for the dark theme) are the only layer a surface should name.

These values are the ones published in `@redrob-labs/ui` (`tokens.css`, with
every chain resolved in `tokens.json`). `brand-tokens.test.ts` fails if this file
and the package ever disagree, so do not edit a value here without the package
changing first.

## Colors

Redrob Blue is Blue 6, `#2b52ff`. It is the one accent: `action-primary` in both
themes, with White ink on it. A second accent is a tint of the first rather than
a new hue.

Light stacks White as the page, Gray 1 as the raised layer and Gray 2 as a
sunken well. Dark uses Redrob Black as the page and Gray 9 as the raised layer.

Text has three steps. `ink-primary` for anything you must read, `ink-secondary`
for supporting sentences and labels, `ink-muted` for placeholders and disabled
text. `ink-muted` is not Gray 6: Gray 6 misses 4.5:1 on light grounds, so the
system ships a corrected value in each theme.

Status colours come from the accent spectrum, level 4 on light and level 3 on
dark. Generated and agent content sits on `surface-ai` with a `border-ai` edge,
so machine output is never mistaken for a person's.

## Typography

Pretendard is the Redrob product family. Wanted Sans leads Korean surfaces and
Noto Sans Devanagari covers Hindi, both as part of the same stack. The package
ships every face; do not fetch one at render time.

Six roles here: `display`, `heading`, `subhead`, `body`, `caption`, `label`.
`label` is SemiBold and never tracked open or set in all caps. `mono` is actual
code and machine payloads only, never a UI label.

## Layout

Work on a 12 column grid with a gutter from the spacing scale. Keep one clear
margin value per surface and hold it: a 16:9 slide uses `4xl` left and right so
projected type never runs to the edge.

Prefer one idea per surface. If a heading needs the word "and", it is two
surfaces. Leave at least a fifth of any presentation surface empty.

Korean lines break on word boundaries, so set `word-break: keep-all` and
`overflow-wrap: anywhere` together, and cap measure between 24 and 40 Korean
characters.

## Elevation & Depth

The frontmatter has no elevation field, so the shadow scale lives here as prose
and as three named recipes, tinted with Redrob Black on light and re-mixed
against pure black on dark.

- sm: `0 1px 2px` at 8%, for resting cards and inputs
- md: `0 4px 12px` at 10%, for menus, popovers and hovered cards
- lg: `0 16px 40px` at 14%, for modals and dialogs

Reach for tonal separation and a one pixel border before reaching for a shadow.

## Shapes

`xs` for tags and checkboxes, `sm` for inputs and small buttons, `md` for buttons
and menus, `lg` for cards and panels, `xl` for modals, `2xl` for hero blocks,
`full` for pills and avatars. A nested surface never takes a larger radius than
its parent.

## Components

`button-primary` is Redrob Blue with White ink in both themes. `card` holds
exactly one job: a status, a record, a comparison, a form group, or one content
module. `chip` is a label on a brand tint, and it never carries a sentence.

## Do's and Don'ts

Do name the semantic layer. Do keep light and dark in the same file so a role
cannot exist in one theme only.

Don't name a primitive from a component. Don't invent an alpha of a border when
a stronger or subtler border already has a name. Don't add a hue outside this
file, and don't paste a value here that `@redrob-labs/ui` does not publish.
