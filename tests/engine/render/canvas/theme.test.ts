import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import {
  canvasThemeColor,
  DEFAULT_CANVAS_THEME,
  resolvePageColor
} from '@redrob-design/core/canvas'
import { parseColor } from '@redrob-design/core/color'
import {
  AUTO_LAYOUT_HOVER_BLUE,
  AUTO_LAYOUT_HOVER_MAGENTA,
  CANVAS_BG_COLOR,
  COMMENT_PIN_COLOR,
  COMPONENT_COLOR,
  MEASUREMENT_COLOR,
  RULER_BG_COLOR,
  RULER_TEXT_COLOR,
  RULER_TICK_COLOR,
  SELECTION_COLOR,
  SNAP_COLOR
} from '@redrob-design/core/constants'
import type { Color } from '@redrob-design/scene-graph/primitives'

import { CANVAS_THEME_PROPERTIES, readCanvasTheme } from '@/app/shell/theme'
import { PEER_COLORS } from '@/constants'

import { readDesignSystemTokens } from '#tests/helpers/design-tokens'
import { repoPath } from '#tests/helpers/paths'

const tokens = readDesignSystemTokens()

function token(name: string, theme: 'light' | 'dark' = 'light'): Color {
  const value = tokens.get(name)?.[theme]
  if (!value) throw new Error(`@redrob-labs/ui has no token ${name}`)
  return parseColor(value)
}

function expectPage(page: Color | undefined): Color {
  if (!page) throw new Error('readCanvasTheme left the page out')
  return page
}

function expectSameRGB(actual: Color, expected: Color, label: string) {
  for (const channel of ['r', 'g', 'b'] as const) {
    expect(Math.abs(actual[channel] - expected[channel]), `${label}.${channel}`).toBeLessThan(
      1 / 255
    )
  }
}

describe('core canvas defaults', () => {
  test('equal the design system light values, so headless output matches the light app', () => {
    expectSameRGB(SELECTION_COLOR, token('action-primary'), 'selection')
    expectSameRGB(COMPONENT_COLOR, token('product-design'), 'component')
    expectSameRGB(SNAP_COLOR, token('accent-pink-3'), 'snap')
    expectSameRGB(MEASUREMENT_COLOR, token('accent-orange-3'), 'measurement')
    expectSameRGB(AUTO_LAYOUT_HOVER_BLUE, token('accent-sky-3'), 'layout padding')
    expectSameRGB(AUTO_LAYOUT_HOVER_MAGENTA, token('accent-pink-3'), 'layout gap')
    expectSameRGB(COMMENT_PIN_COLOR, token('action-primary'), 'comment pin')
    expectSameRGB(RULER_BG_COLOR, token('surface-raised'), 'ruler bg')
    expectSameRGB(RULER_TICK_COLOR, token('border-strong'), 'ruler tick')
    expectSameRGB(RULER_TEXT_COLOR, token('ink-muted'), 'ruler text')
  })

  test('collaborator colours all come from the design system accent families', () => {
    const accents = [...tokens.values()]
      .filter((t) => t.name.startsWith('accent-'))
      .map((t) => parseColor(t.light))
    for (const [index, color] of PEER_COLORS.entries()) {
      const match = accents.some((accent) =>
        (['r', 'g', 'b'] as const).every((c) => Math.abs(accent[c] - color[c]) < 1 / 255)
      )
      expect(match, `PEER_COLORS[${index}]`).toBe(true)
    }
  })
})

describe('canvasThemeColor', () => {
  test('falls back to the defaults without a theme', () => {
    expect(canvasThemeColor(null, 'snap')).toEqual({ ...DEFAULT_CANVAS_THEME.snap, a: 1 })
  })

  test('the default page is the .fig page default', () => {
    expect(canvasThemeColor(null, 'page')).toEqual({ ...CANVAS_BG_COLOR, a: 1 })
  })

  test('prefers the host theme and always returns opaque RGB', () => {
    const theme = { ...DEFAULT_CANVAS_THEME, selection: { r: 0.1, g: 0.2, b: 0.3, a: 0.4 } }
    expect(canvasThemeColor(theme, 'selection')).toEqual({ r: 0.1, g: 0.2, b: 0.3, a: 1 })
  })
})

describe('resolvePageColor', () => {
  const dark = { ...DEFAULT_CANVAS_THEME, page: token('surface-sunken', 'dark') }

  test('a page with no colour of its own follows the theme', () => {
    expectSameRGB(resolvePageColor(null, dark), token('surface-sunken', 'dark'), 'dark page')
    expectSameRGB(resolvePageColor(null, null), CANVAS_BG_COLOR, 'default page')
  })

  test("a page's own colour wins over the theme", () => {
    const own = { r: 0.2, g: 0.4, b: 0.6, a: 0.5 }
    expect(resolvePageColor(own, dark)).toEqual(own)
  })
})

describe('readCanvasTheme', () => {
  test('the light page matches the .fig page default', () => {
    // app.css mixes 4% ink into the light page, in sRGB.
    const base = token('surface-base')
    const ink = token('ink-primary')
    const mix = (channel: 'r' | 'g' | 'b') => base[channel] * 0.96 + ink[channel] * 0.04
    expectSameRGB({ r: mix('r'), g: mix('g'), b: mix('b'), a: 1 }, CANVAS_BG_COLOR, 'light page')
    const css = readFileSync(repoPath('src/app.css'), 'utf8')
    expect(css).toContain(
      '--color-canvas-page: color-mix(in srgb, var(--surface-base) 96%, var(--ink-primary));'
    )
    expect(css).toContain('--color-canvas-page: var(--surface-sunken);')
  })

  test('leaves the page out when the browser hands back no usable colour', () => {
    for (const value of ['', 'rgba(0, 0, 0, 0)', 'color-mix(in srgb, #fff 96%, #000)']) {
      const { canvas } = readCanvasTheme((name) => (name === '--color-canvas-page' ? value : ''))
      expect(canvas.page, value).toBeUndefined()
    }
    const { canvas } = readCanvasTheme((name) =>
      name === '--color-canvas-page' ? 'rgb(28, 31, 38)' : ''
    )
    expectSameRGB(expectPage(canvas.page), token('surface-sunken', 'dark'), 'resolved page')
  })

  test('reads every canvas property app.css publishes', () => {
    const css = readFileSync(repoPath('src/app.css'), 'utf8')
    for (const property of Object.values(CANVAS_THEME_PROPERTIES)) {
      expect(css, property).toContain(`${property}:`)
    }
  })

  test('resolves computed custom properties into renderer colours', () => {
    const values: Record<string, string> = {
      '--color-ruler-bg': '#141719',
      '--color-ruler-tick': ' #7c8390',
      '--color-ruler-text': '#838a97',
      '--color-ruler-label': '#ffffff',
      '--color-canvas-selection': '#2b52ff',
      '--color-canvas-component': '#c162f4',
      '--color-canvas-snap': '#ff39ba',
      '--color-canvas-measurement': '#ff9c1b',
      '--color-canvas-layout-padding': '#2f8dff',
      '--color-canvas-layout-gap': '#ff39ba'
    }
    const { ruler, canvas } = readCanvasTheme((name) => values[name] ?? '')
    expectSameRGB(ruler.background, token('surface-raised', 'dark'), 'ruler bg')
    expectSameRGB(ruler.tick, token('border-strong', 'dark'), 'ruler tick')
    expectSameRGB(canvas.selection, token('action-primary', 'dark'), 'selection')
    expectSameRGB(canvas.layoutGap, token('accent-pink-3'), 'gap')
  })
})
