import { shallowRef } from 'vue'

import { composerFocusRequest } from '@/app/ai/chat/ask'

/** The part of a scene graph pointing needs. */
interface PointableGraph {
  hitTestDeep(x: number, y: number, scopeId?: string): { id: string; type: string } | null
  hitTest(x: number, y: number, scopeId?: string): { id: string; type: string } | null
}

export interface PointTarget {
  graph: PointableGraph
  state: { currentPageId: string }
}

/** A node the person pointed at in Describe, for the active composer to pick up. */
export interface PointRequest {
  nodeId: string
  /** Increases on every point, so pointing at the same node twice still fires. */
  sequence: number
}

export const pointRequest = shallowRef<PointRequest | null>(null)
let sequence = 0

/**
 * The node under a canvas point in Describe: the deepest layer there, so a
 * person can point at one word as easily as at a whole card.
 */
export function nodeAtPoint(target: PointTarget, x: number, y: number): string | null {
  const pageId = target.state.currentPageId
  // An empty part of a frame has no leaf under it; the frame itself is the answer.
  const node = target.graph.hitTestDeep(x, y, pageId) ?? target.graph.hitTest(x, y, pageId)
  if (!node || node.type === 'CANVAS') return null
  return node.id
}

/** Hands a pointed node to the composer and moves focus there. */
export function pointAt(nodeId: string): void {
  pointRequest.value = { nodeId, sequence: ++sequence }
  composerFocusRequest.value++
}
