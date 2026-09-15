---
version: "1"
name: Redrob 브랜드
description: >
  Redrob brand design system (Redrob 브랜드). The shared Redrob token set: brand
  primitives, light and dark semantic roles, Pretendard typography, spacing and
  radius scales. Values are the ones on merged main in packages/ui/src/tokens.css,
  which transcribes Console's globals.css. Copy to DESIGN.md to put a workspace on
  Redrob brand, or resolve it as tokens with @redrob-design/decks.
colors:
  # ── Layer 1. Brand primitives ────────────────────────────────────────────
  # Theme-independent. Blue 6 is Redrob Blue. Keys mirror the --rr-* custom
  # properties in packages/ui/src/tokens.css one for one, so a resolver maps
  # rr-blue-6 to --rr-blue-6 with no lookup table in the middle.
  rr-black: "#0a0b0c"
  rr-white: "#ffffff"
  rr-blue-1: "#eff4ff"
  rr-blue-3: "#bad2ff"
  rr-blue-4: "#8aafff"
  rr-blue-5: "#507fff"
  rr-blue-6: "#2b52ff"
  rr-blue-7: "#1733d5"
  rr-blue-9: "#061460"
  rr-blue-10: "#030c34"
  rr-gray-1: "#f8f9fb"
  rr-gray-2: "#eff1f4"
  rr-gray-3: "#dfe2e8"
  rr-gray-4: "#cbcfd7"
  rr-gray-5: "#aab0bb"
  rr-gray-6: "#7c8390"
  rr-gray-7: "#576071"
  rr-gray-8: "#292e37"
  rr-gray-9: "#141719"
  rr-orange-3: "#ff9c1b"
  rr-orange-4: "#ae5100"
  rr-green-3: "#29e474"
  rr-green-4: "#00864a"
  rr-red-3: "#ff5452"
  rr-red-4: "#a31310"

  # ── Layer 2a. Semantic roles, light ──────────────────────────────────────
  # The only layer product surfaces read. Keys mirror the --color-* properties.
  color-background: "#f8f9fb"
  color-background-secondary: "#eff1f4"
  color-surface: "#ffffff"
  color-surface-active: "#dfe2e8"
  color-surface-muted: "#eff1f4"
  color-border: "#dfe2e8"
  color-border-subtle: "#eff1f4"
  color-border-strong: "#cbcfd7"
  color-text-primary: "#141719"
  color-text-secondary: "#576071"
  color-text-muted: "#7c8390"
  color-accent: "#2b52ff"
  color-accent-hover: "#1733d5"
  color-accent-muted: "#bad2ff"
  color-accent-soft: "#eff4ff"
  color-on-accent: "#ffffff"
  color-focus-ring: "#2b52ff"
  color-success: "#00864a"
  color-warning: "#ae5100"
  color-error: "#a31310"

  # ── Layer 2b. Semantic roles, dark ───────────────────────────────────────
  # Same roles re-pointed, never new primitives. Gray 9 is the dark page and
  # Redrob Black is the deeper layer beneath it. Accent steps one tint lighter
  # because Blue 6 does not carry enough contrast on Gray 9.
  dark-color-background: "#141719"
  dark-color-background-secondary: "#0a0b0c"
  dark-color-surface-active: "#292e37"
  dark-color-surface-muted: "#292e37"
  dark-color-border: "#292e37"
  dark-color-border-strong: "#576071"
  dark-color-text-primary: "#f8f9fb"
  dark-color-text-secondary: "#aab0bb"
  dark-color-text-muted: "#7c8390"
  dark-color-accent: "#507fff"
  dark-color-accent-hover: "#8aafff"
  dark-color-accent-muted: "#061460"
  dark-color-accent-soft: "#030c34"
  dark-color-on-accent: "#0a0b0c"
  dark-color-focus-ring: "#507fff"
  dark-color-success: "#29e474"
  dark-color-warning: "#ff9c1b"
  dark-color-error: "#ff5452"
typography:
  display:
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 64px
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: -0.032em
  heading:
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 34px
    fontWeight: 600
    lineHeight: 1.24
    letterSpacing: -0.022em
  subhead:
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 21px
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: -0.012em
  body:
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.62
    letterSpacing: -0.004em
  caption:
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  label:
    fontFamily: '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 0.08em
  mono:
    fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.5
    fontFeature: '"tnum"'
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  xl: 14px
  2xl: 18px
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
    backgroundColor: "{colors.color-accent}"
    textColor: "{colors.color-on-accent}"
    typography: "{typography.subhead}"
    rounded: "{rounded.full}"
    padding: "{spacing.lg}"
  card:
    backgroundColor: "{colors.color-surface}"
    textColor: "{colors.color-text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "{spacing.xl}"
  chip:
    backgroundColor: "{colors.color-accent-soft}"
    textColor: "{colors.color-accent}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "{spacing.sm}"
---

## Overview

Redrob's own design system. One brand, six product surfaces: Console, Code,
Design, Work, Office, Browser. The point of this file is that a colour is decided
in exactly one place, so the products cannot drift apart.

Two layers, and only two. Primitives (`rr-*`) are the brand's confirmed HEX
values and carry no meaning. Semantic roles (`color-*`, and `dark-color-*` for
the dark theme) are the only layer a surface should name. If a value here is
wrong, it is wrong in the brand document first.

These values are the ones on merged main in `packages/ui/src/tokens.css`, which
transcribes Console's `apps/web/src/app/globals.css`. Do not edit a value here
without changing it there.

## Colors

Redrob Blue is Blue 6, `#2b52ff`. It is the one accent, and a second accent is a
tint of the first rather than a new hue.

Light surfaces stack Gray 1 as the page and White as the panel, because a card
sits above the page and not below it. Dark reverses the brand order: Gray 9 is
the page and Redrob Black is the deeper layer beneath it.

Text has three steps. `color-text-primary` for anything you must read,
`color-text-secondary` for supporting sentences, `color-text-muted` for labels,
captions and other non-body text. Gray 6 clears 3:1 and not 4.5:1, so it never
carries body copy.

Status colours come from the accent spectrum, level 4 on light and level 3 on
dark. The brand document defines no status hues of its own.

## Typography

Pretendard is the single Redrob product family and the only approved product
typeface. One face carries Latin and Hangul, which is why a Korean surface needs
no second family and no fallback stack beyond the system last resort. Ship the
variable file with the artifact; do not fetch it at render time.

Six roles: `display` for one line per slide or page, `heading`, `subhead`,
`body`, `caption`, `label`. `label` is the only role with positive tracking, and
it is uppercase Latin or short Korean only.

There is no second display face. Brand moments use the same family at a heavier
weight and tighter tracking. `mono` is code, keys, and figures only, never a UI
label and never Korean body copy.

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
and as three named recipes. Cool tinted with Gray 8 on light, re-mixed against
Redrob Black on dark, because a shadow has to be darker than its surface to read
at all.

- soft: `0 1px 2px` Gray 8 at 5%
- card: `0 1px 2px` Gray 8 at 5%, plus `0 4px 16px` Gray 8 at 7%
- elevated: `0 2px 4px` Gray 8 at 6%, plus `0 12px 32px` Gray 8 at 12%

Reach for tonal separation and a one pixel border before reaching for a shadow.
A raised surface should feel attached to the system, not floating above it.

## Shapes

`sm` for controls and chips, `md` for inputs and small tiles, `lg` for cards and
panels, `2xl` for a full bleed hero plate, `full` for pills and avatars. A nested
surface never takes a larger radius than its parent.

## Components

`button-primary` is Redrob Blue with White ink on light and Redrob Black ink on
dark, which is why `color-on-accent` is a role and not a constant.

`card` holds exactly one job: a status, a record, a comparison, a form group, or
one content module. `chip` is a label on an accent wash, and it never carries a
sentence.

## Do's and Don'ts

Do name the semantic layer. Do promote a repeated visual choice back into this
file. Do keep light and dark in the same file so a role cannot exist in one theme
only.

Don't name a primitive from a component. Don't invent an alpha of a border when a
lighter border already has a name. Don't add a hue outside this file, and don't
paste a brand value here that has not been confirmed in
`packages/ui/src/tokens.css`.
