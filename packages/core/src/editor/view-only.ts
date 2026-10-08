import type { EditorContext } from './types'

/**
 * View-only: the person looks, pans and zooms, and nothing they click or type
 * edits the document. Entering it ends whatever direct edit was in progress.
 */
export function createViewOnlyActions(ctx: EditorContext) {
  function setViewOnly(viewOnly: boolean) {
    if (ctx.state.viewOnly === viewOnly) return
    ctx.state.viewOnly = viewOnly
    if (viewOnly) {
      ctx.state.editingTextId = null
      ctx.state.penState = null
      ctx.state.nodeEditState = null
      ctx.state.enteredContainerId = null
      ctx.state.hoveredNodeId = null
      ctx.state.measurementMode = 'off'
      ctx.state.marquee = null
      ctx.state.snapGuides = []
      ctx.setActiveTool('SELECT')
      ctx.setSelectedIds(new Set())
    }
    ctx.emitEditorEvent('view-only:changed', viewOnly)
    ctx.requestRepaint()
  }

  return { setViewOnly }
}
