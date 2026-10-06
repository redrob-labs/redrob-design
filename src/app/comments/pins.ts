import type { CommentPin } from '@redrob-design/core/canvas'
import type { SceneGraph } from '@redrob-design/scene-graph'
import type { Vector } from '@redrob-design/scene-graph/primitives'

import type { CommentAnchor, CommentThread } from './types'

/** The draft pin's id, while a new comment is being written. */
export const DRAFT_PIN_ID = 'draft'

/**
 * Where an anchor is on the canvas: the layer's corner plus the offset, or
 * the canvas position itself when there is no layer or it is gone.
 */
export function anchorPosition(graph: SceneGraph, anchor: CommentAnchor): Vector {
  if (!anchor.nodeId || !graph.getNode(anchor.nodeId)) return { x: anchor.x, y: anchor.y }
  const corner = graph.getAbsolutePosition(anchor.nodeId)
  return { x: corner.x + anchor.x, y: corner.y + anchor.y }
}

/** The anchor for a click at a canvas point, on the layer under it when there is one. */
export function anchorAt(
  graph: SceneGraph,
  pageId: string,
  point: Vector,
  nodeId: string | null
): CommentAnchor {
  if (!nodeId) return { nodeId: null, x: point.x, y: point.y, pageId }
  const corner = graph.getAbsolutePosition(nodeId)
  return { nodeId, x: point.x - corner.x, y: point.y - corner.y, pageId }
}

/**
 * The pins for one page: open threads always, resolved ones only when
 * asked, numbered in the order the threads were started.
 */
export function commentPinsFor(
  graph: SceneGraph,
  pageId: string,
  threads: readonly CommentThread[],
  options: { activeId: string | null; showResolved: boolean; draft: CommentAnchor | null }
): CommentPin[] {
  const pins: CommentPin[] = []
  for (const [index, thread] of threads.entries()) {
    const { anchor, resolved } = thread.root
    if (anchor.pageId !== pageId || (resolved && !options.showResolved)) continue
    const position = anchorPosition(graph, anchor)
    pins.push({
      id: thread.id,
      ...position,
      label: String(index + 1),
      resolved,
      active: thread.id === options.activeId
    })
  }
  const draft = options.draft
  if (draft?.pageId === pageId) {
    pins.push({
      id: DRAFT_PIN_ID,
      ...anchorPosition(graph, draft),
      label: '',
      resolved: false,
      active: true
    })
  }
  return pins
}
