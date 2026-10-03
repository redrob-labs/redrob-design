import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

import { canvasThemeColor, DEFAULT_CANVAS_THEME } from '@redrob-design/core/canvas'
import { parseColor } from '@redrob-design/core/color'
import {
  AUTO_LAYOUT_HOVER_BLUE,
  AUTO_LAYOUT_HOVER_MAGENTA,
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

  test('prefers the host theme and always returns opaque RGB', () => {
    const theme = { ...DEFAULT_CANVAS_THEME, selection: { r: 0.1, g: 0.2, b: 0.3, a: 0.4 } }
    expect(canvasThemeColor(theme, 'selection')).toEqual({ r: 0.1, g: 0.2, b: 0.3, a: 1 })
  })
})

describe('readCanvasTheme', () => {
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
