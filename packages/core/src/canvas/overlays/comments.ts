import type { Canvas } from 'canvaskit-wasm'

import type { Vector } from '@redrob-design/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import { canvasThemeColor } from '#core/canvas/renderer/canvas-theme'
import type { CommentPin } from '#core/canvas/renderer/types'

/** A pin's radius in screen pixels; the open thread's pin is a little larger. */
export const COMMENT_PIN_RADIUS = 12
const ACTIVE_PIN_RADIUS = 14
const PIN_BORDER = 2
const LABEL_FONT_SIZE = 11
const RESOLVED_ALPHA = 0.45

function radiusOf(pin: Pick<CommentPin, 'active'>): number {
  return pin.active ? ACTIVE_PIN_RADIUS : COMMENT_PIN_RADIUS
}

/**
 * Where a pin's round head sits on screen. The pin's point is at its canvas
 * position and the head rises up and to the right of it, as in Figma.
 */
export function commentPinCenter(
  pin: Pick<CommentPin, 'x' | 'y' | 'active'>,
  viewport: { panX: number; panY: number; zoom: number }
): Vector & { radius: number } {
  const radius = radiusOf(pin)
  return {
    x: pin.x * viewport.zoom + viewport.panX + radius,
    y: pin.y * viewport.zoom + viewport.panY - radius,
    radius
  }
}

function drawPinShape(r: SkiaRenderer, canvas: Canvas, x: number, y: number, radius: number) {
  canvas.drawCircle(x, y, radius, r.auxFill)
  // The square quarter under the head makes the point at the pin's position.
  canvas.drawRect(r.ck.XYWHRect(x - radius, y, radius, radius), r.auxFill)
}

/**
 * Comment pins in screen space: a fixed size at every zoom, in the canvas
 * theme's comment colour with a white border, faded once resolved.
 */
export function drawCommentPins(r: SkiaRenderer, canvas: Canvas, pins?: CommentPin[]): void {
  if (!pins || pins.length === 0) return
  const color = canvasThemeColor(r.canvasTheme, 'commentPin')
  const font = r.labelFont
  for (const pin of pins) {
    const head = commentPinCenter(pin, r)
    const outside =
      head.x + head.radius < 0 ||
      head.y + head.radius * 2 < 0 ||
      head.x - head.radius * 2 > r.viewportWidth ||
      head.y - head.radius > r.viewportHeight
    if (outside) continue
    const alpha = pin.resolved ? RESOLVED_ALPHA : 1

    r.auxFill.setColor(r.ck.Color4f(1, 1, 1, alpha))
    drawPinShape(r, canvas, head.x, head.y, head.radius + PIN_BORDER)
    r.auxFill.setColor(r.ck.Color4f(color.r, color.g, color.b, alpha))
    drawPinShape(r, canvas, head.x, head.y, head.radius)

    if (!font || !pin.label) continue
    font.setSize(LABEL_FONT_SIZE)
    const widths = font.getGlyphWidths(font.getGlyphIDs(pin.label))
    let width = 0
    for (const glyph of widths) width += glyph
    r.auxFill.setColor(r.ck.Color4f(1, 1, 1, alpha))
    canvas.drawText(pin.label, head.x - width / 2, head.y + LABEL_FONT_SIZE * 0.36, r.auxFill, font)
  }
}
