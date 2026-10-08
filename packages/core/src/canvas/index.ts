export {
  canMakeBooleanSourceNode,
  canMakeBooleanSourcePath,
  hasVisibleStrokeSourceNode,
  nodeHasVisibleStroke
} from './boolean'
export {
  distanceToGuideSegment,
  getGuideScreenSegment,
  type GuideScreenSegment,
  type GuideViewport
} from './guides/geometry'
export { computeGuideRedline } from './guides/redlines'
export { hitTestGuides, type GuideHit } from './guides/hit-test'
export type { GuideOverlayState, GuidePreview, GuideSelection } from './guides/types'
export { canvasLabelForeground } from './labels/color'
export {
  SkiaRenderer,
  type CanvasTheme,
  type CanvasThemeColor,
  type CommentPin,
  type RenderOverlays,
  type RulerTheme
} from './renderer'
export { canvasThemeColor, DEFAULT_CANVAS_THEME, resolvePageColor } from './renderer/canvas-theme'
export { COMMENT_PIN_RADIUS, commentPinCenter } from './overlays/comments'
