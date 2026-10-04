import { useEventListener } from '@vueuse/core'
import type { Ref } from 'vue'

import type { Vector } from '@redrob-design/scene-graph/primitives'

import { nodeAtPoint, pointAt } from '@/app/assistant/pointing/store'
import type { EditorStore } from '@/app/editor/active-store'

/** A press that moves less than this is a point, not a pan. */
const POINT_SLOP_PX = 4

/**
 * Describe pointing: in view-only, hovering outlines the layer under the
 * pointer, and a click without a drag hands it to the composer.
 */
export function useDescribePointing(canvasRef: Ref<HTMLCanvasElement | null>, store: EditorStore) {
  let pressed: Vector | null = null

  function canvasPoint(event: MouseEvent) {
    const canvas = canvasRef.value
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return store.screenToCanvas(event.clientX - rect.left, event.clientY - rect.top)
  }

  useEventListener(canvasRef, 'mousedown', (event: MouseEvent) => {
    pressed =
      store.state.viewOnly && event.button === 0 ? { x: event.clientX, y: event.clientY } : null
  })

  useEventListener(canvasRef, 'mouseup', (event: MouseEvent) => {
    const start = pressed
    pressed = null
    if (!start || !store.state.viewOnly) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > POINT_SLOP_PX) return
    const point = canvasPoint(event)
    const nodeId = point ? nodeAtPoint(store, point.x, point.y) : null
    if (nodeId) pointAt(nodeId)
  })

  useEventListener(canvasRef, 'mousemove', (event: MouseEvent) => {
    if (!store.state.viewOnly || event.buttons !== 0) return
    const point = canvasPoint(event)
    store.setHoveredNode(point ? nodeAtPoint(store, point.x, point.y) : null)
  })

  useEventListener(canvasRef, 'mouseleave', () => {
    if (store.state.viewOnly) store.setHoveredNode(null)
  })
}
