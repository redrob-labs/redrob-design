import { beforeAll, describe, expect, test } from 'bun:test'

import { DEFAULT_CANVAS_THEME, SkiaRenderer } from '@redrob-design/core/canvas'
import { createDefaultEditorState } from '@redrob-design/core/editor'
import { SceneGraph } from '@redrob-design/scene-graph'
import type { Color } from '@redrob-design/scene-graph/primitives'

import { initCanvasKit } from '#cli/headless'

import { expectDefined } from '#tests/helpers/assert'

const SIZE = 64
const DARK_PAGE: Color = { r: 28 / 255, g: 31 / 255, b: 38 / 255, a: 1 }
const LIGHT_PAGE: Color = { r: 245 / 255, g: 245 / 255, b: 245 / 255, a: 1 }

let ck: Awaited<ReturnType<typeof initCanvasKit>>

beforeAll(async () => {
  ck = await initCanvasKit()
})

function theme(page: Color) {
  return { ...DEFAULT_CANVAS_THEME, page }
}

/** The colour the pipeline paints in the middle of an empty page, as 0-255 RGB. */
function paintedPage(
  renderer: SkiaRenderer,
  state: ReturnType<typeof createDefaultEditorState>,
  graph: SceneGraph,
  layer: 'full' | 'scene'
): number[] {
  // The scene version stays put: a theme switch repaints without touching the scene, so the
  // retained backing and tiles must notice the new page colour on their own.
  renderer.renderFromEditorState(state, graph, null, SIZE, SIZE, false, layer)
  renderer.surface.flush()
  const image = renderer.surface.makeImageSnapshot()
  const pixels = expectDefined(
    image.readPixels(SIZE / 2, SIZE / 2, {
      width: 1,
      height: 1,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB
    }),
    'page pixel'
  )
  image.delete()
  return Array.from(pixels.subarray(0, 3))
}

function rgb255(color: Color): number[] {
  return [color.r, color.g, color.b].map((channel) => Math.round(channel * 255))
}

function expectPainted(actual: number[], expected: Color): void {
  const want = rgb255(expected)
  for (const [index, channel] of actual.entries()) {
    expect(Math.abs(channel - want[index])).toBeLessThanOrEqual(1)
  }
}

describe('canvas page colour', () => {
  test.each(['full', 'scene'] as const)(
    'a page with no colour of its own follows the theme (%s layer)',
    (layer) => {
      const graph = new SceneGraph()
      const page = expectDefined(graph.getPages()[0], 'page')
      const state = createDefaultEditorState(page.id)
      const surface = expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface')
      const renderer = new SkiaRenderer(ck, surface)
      renderer.pageId = page.id
      // The app's scene layer: retained backing and tiles, both cleared with the page colour.
      renderer.tiledSceneEnabled = layer === 'scene'
      state.sceneVersion = 1

      state.canvasTheme = theme(DARK_PAGE)
      expectPainted(paintedPage(renderer, state, graph, layer), DARK_PAGE)

      // A theme switch is a repaint with a new theme object, nothing else.
      state.canvasTheme = theme(LIGHT_PAGE)
      expectPainted(paintedPage(renderer, state, graph, layer), LIGHT_PAGE)

      renderer.destroy()
    }
  )

  test("a page's own colour wins over the theme", () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    const state = createDefaultEditorState(page.id)
    const surface = expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.pageId = page.id
    const own: Color = { r: 0.8, g: 0.2, b: 0.2, a: 1 }

    state.pageColor = own
    state.canvasTheme = theme(DARK_PAGE)
    expectPainted(paintedPage(renderer, state, graph, 'scene'), own)
    state.canvasTheme = theme(LIGHT_PAGE)
    expectPainted(paintedPage(renderer, state, graph, 'scene'), own)

    renderer.destroy()
  })

  test('without a theme the page is the .fig page default', () => {
    const graph = new SceneGraph()
    const page = expectDefined(graph.getPages()[0], 'page')
    const state = createDefaultEditorState(page.id)
    const surface = expectDefined(ck.MakeSurface(SIZE, SIZE), 'surface')
    const renderer = new SkiaRenderer(ck, surface)
    renderer.pageId = page.id

    expectPainted(paintedPage(renderer, state, graph, 'full'), LIGHT_PAGE)

    renderer.destroy()
  })
})
