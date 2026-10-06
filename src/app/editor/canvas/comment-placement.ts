import { useEventListener } from '@vueuse/core'
import { computed, type Ref } from 'vue'

import { commentPinCenter } from '@redrob-design/core/canvas'
import type { Vector } from '@redrob-design/scene-graph/primitives'

import { nodeAtPoint } from '@/app/assistant/pointing/store'
import { threadKeyFor } from '@/app/assistant/thread/store'
import { DRAFT_PIN_ID, anchorAt, anchorPosition } from '@/app/comments/pins'
import { commentMode, draftAnchor, stopCommenting } from '@/app/comments/service'
import { activeThreadId, threadsFor } from '@/app/comments/store'
import type { EditorStore } from '@/app/editor/active-store'

/** A press that moves less than this is a click, not a pan. */
const CLICK_SLOP_PX = 4

/**
 * Comments on the canvas: a click on a pin opens its thread, and while
 * placing, a click anywhere starts a thread there, on the layer under it.
 * Both work in Describe, since a comment changes nothing in the file.
 */
export function useCommentPlacement(canvasRef: Ref<HTMLCanvasElement | null>, store: EditorStore) {
  let pressed: Vector | null = null

  function localPoint(event: MouseEvent): Vector | null {
    const canvas = canvasRef.value
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function pinAt(screen: Vector): string | null {
    for (const pin of (store.state.commentPins ?? []).toReversed()) {
      if (pin.id === DRAFT_PIN_ID) continue
      const head = commentPinCenter(pin, store.state)
      if (Math.hypot(screen.x - head.x, screen.y - head.y) <= head.radius) return pin.id
    }
    return null
  }

  // Capture runs before the editor's own handlers, so a pin click does not also select.
  useEventListener(
    canvasRef,
    'mousedown',
    (event: MouseEvent) => {
      pressed = null
      if (event.button !== 0) return
      const screen = localPoint(event)
      const pinId = screen ? pinAt(screen) : null
      if (pinId) {
        event.stopImmediatePropagation()
        draftAnchor.value = null
        activeThreadId.value = pinId
        return
      }
      if (!commentMode.value) return
      event.stopImmediatePropagation()
      pressed = { x: event.clientX, y: event.clientY }
    },
    { capture: true }
  )

  useEventListener(canvasRef, 'mouseup', (event: MouseEvent) => {
    const start = pressed
    pressed = null
    if (!start || !commentMode.value) return
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > CLICK_SLOP_PX) return
    const screen = localPoint(event)
    if (!screen) return
    const point = store.screenToCanvas(screen.x, screen.y)
    const pageId = store.state.currentPageId
    activeThreadId.value = null
    draftAnchor.value = anchorAt(store.graph, pageId, point, nodeAtPoint(store, point.x, point.y))
  })

  useEventListener(window, 'keydown', (event: KeyboardEvent) => {
    if (event.code !== 'Escape') return
    if (commentMode.value) stopCommenting()
    else if (activeThreadId.value) activeThreadId.value = null
  })

  const documentKey = computed(() => threadKeyFor(store))
  /** Where the open thread or the draft sits on this page, for the popover. */
  const anchor = computed<Vector | null>(() => {
    const thread = threadsFor(documentKey.value).find((t) => t.id === activeThreadId.value)
    const target = draftAnchor.value ?? thread?.root.anchor
    if (target?.pageId !== store.state.currentPageId) return null
    // Layers move; the anchor follows them.
    void store.state.sceneVersion
    return anchorPosition(store.graph, target)
  })
  return { documentKey, anchor }
}
