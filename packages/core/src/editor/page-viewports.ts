import type { Color } from '@redrob-design/scene-graph/primitives'

import type { EditorContext } from './types'

interface PageViewport {
  panX: number
  panY: number
  zoom: number
  /** The page's own colour, or `null` when it follows the theme. */
  pageColor: Color | null
}

function copyPageColor(color: Color | null): Color | null {
  return color ? { ...color } : null
}

export function createPageViewportStore(ctx: EditorContext) {
  const pageViewports = new Map<string, PageViewport>()

  function saveCurrentPageViewport() {
    pageViewports.set(ctx.state.currentPageId, {
      panX: ctx.state.panX,
      panY: ctx.state.panY,
      zoom: ctx.state.zoom,
      pageColor: copyPageColor(ctx.state.pageColor)
    })
  }

  function restorePageViewport(pageId: string) {
    const viewport = pageViewports.get(pageId)
    if (viewport) {
      ctx.state.panX = viewport.panX
      ctx.state.panY = viewport.panY
      ctx.state.zoom = viewport.zoom
      ctx.state.pageColor = copyPageColor(viewport.pageColor)
      return
    }

    ctx.state.panX = 0
    ctx.state.panY = 0
    ctx.state.zoom = 1
    ctx.state.pageColor = null
  }

  function deletePageViewport(pageId: string) {
    pageViewports.delete(pageId)
  }

  function clearPageViewports() {
    pageViewports.clear()
  }

  return { saveCurrentPageViewport, restorePageViewport, deletePageViewport, clearPageViewports }
}
