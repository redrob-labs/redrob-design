import type { Color } from '@redrob-design/scene-graph/primitives'

import type { SkiaRenderer } from '#core/canvas/renderer'
import type { CanvasTheme, CanvasThemeColor } from '#core/canvas/renderer/types'
import {
  AUTO_LAYOUT_HOVER_BLUE,
  AUTO_LAYOUT_HOVER_MAGENTA,
  COMMENT_PIN_COLOR,
  COMPONENT_COLOR,
  MEASUREMENT_COLOR,
  PARENT_OUTLINE_ALPHA,
  SELECTION_COLOR,
  SNAP_COLOR
} from '#core/constants'

/** The colours a renderer uses when the host supplies no theme: the design system's light values. */
export const DEFAULT_CANVAS_THEME: CanvasTheme = {
  selection: SELECTION_COLOR,
  component: COMPONENT_COLOR,
  snap: SNAP_COLOR,
  measurement: MEASUREMENT_COLOR,
  layoutPadding: { ...AUTO_LAYOUT_HOVER_BLUE, a: 1 },
  layoutGap: { ...AUTO_LAYOUT_HOVER_MAGENTA, a: 1 },
  commentPin: COMMENT_PIN_COLOR
}

/** An overlay colour, from the active theme when there is one, as opaque RGB. */
export function canvasThemeColor(
  theme: CanvasTheme | null | undefined,
  key: CanvasThemeColor
): Color {
  const color = theme?.[key] ?? DEFAULT_CANVAS_THEME[key]
  return { r: color.r, g: color.g, b: color.b, a: 1 }
}

/** The same colour at a given alpha, for the stroke/fill pairs overlays draw. */
export function canvasThemeColorAt(
  theme: CanvasTheme | null | undefined,
  key: CanvasThemeColor,
  alpha: number
): Color {
  return { ...canvasThemeColor(theme, key), a: alpha }
}

/**
 * Paints are created once and keep their colour, so a theme change has to re-colour the ones that
 * hold an overlay colour. Called by the pipeline only when the theme object changes.
 */
export function applyCanvasThemePaints(r: SkiaRenderer): void {
  r.selectionPaint.setColor(r.selColor())
  r.parentOutlinePaint.setColor(r.selColor(PARENT_OUTLINE_ALPHA))
  r.penHandlePaint.setColor(r.selColor(PARENT_OUTLINE_ALPHA))
  r.penVertexStroke.setColor(r.selColor())
  const snap = canvasThemeColor(r.canvasTheme, 'snap')
  r.snapPaint.setColor(r.ck.Color4f(snap.r, snap.g, snap.b, 1))
}
