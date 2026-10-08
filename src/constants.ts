import ACP_DESIGN_CONTEXT from '@/app/ai/acp/design-context.md'

export {
  IS_BROWSER,
  IS_TAURI,
  SELECTION_COLOR,
  COMPONENT_COLOR,
  SNAP_COLOR,
  CANVAS_BG_COLOR,
  SNAP_THRESHOLD_SCREEN_PX,
  RULER_SIZE,
  RULER_BG_COLOR,
  RULER_TICK_COLOR,
  RULER_TEXT_COLOR,
  RULER_BADGE_HEIGHT,
  RULER_BADGE_PADDING,
  RULER_BADGE_RADIUS,
  RULER_BADGE_EXCLUSION,
  RULER_TEXT_BASELINE,
  RULER_MAJOR_TICK,
  RULER_MINOR_TICK,
  RULER_HIGHLIGHT_ALPHA,
  PEN_HANDLE_RADIUS,
  PEN_VERTEX_RADIUS,
  PEN_CLOSE_RADIUS_BOOST,
  PEN_PATH_STROKE_WIDTH,
  PARENT_OUTLINE_ALPHA,
  PARENT_OUTLINE_DASH,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  LABEL_FONT_SIZE,
  SIZE_FONT_SIZE,
  HANDLE_HALF_SIZE,
  LABEL_OFFSET_Y,
  SIZE_PILL_PADDING_X,
  SIZE_PILL_PADDING_Y,
  SIZE_PILL_HEIGHT,
  SIZE_PILL_RADIUS,
  SIZE_PILL_TEXT_OFFSET_Y,
  MARQUEE_FILL_ALPHA,
  SELECTION_DASH_ALPHA,
  DROP_HIGHLIGHT_ALPHA,
  DROP_HIGHLIGHT_STROKE,
  LAYOUT_INDICATOR_STROKE,
  SECTION_CORNER_RADIUS,
  SECTION_TITLE_HEIGHT,
  SECTION_TITLE_PADDING_X,
  SECTION_TITLE_RADIUS,
  SECTION_TITLE_FONT_SIZE,
  SECTION_TITLE_GAP,
  COMPONENT_SET_DASH,
  COMPONENT_SET_DASH_GAP,
  COMPONENT_SET_BORDER_WIDTH,
  COMPONENT_LABEL_FONT_SIZE,
  COMPONENT_LABEL_GAP,
  COMPONENT_LABEL_ICON_SIZE,
  COMPONENT_LABEL_ICON_GAP,
  RULER_TARGET_PIXEL_SPACING,
  RULER_MAJOR_TOLERANCE
} from '@redrob-design/core/constants'

import type { Color } from '@redrob-design/scene-graph/primitives'

export const WEB_APP_ORIGIN = 'https://app.redrob.design'

/**
 * Remote collaborator colours, from the Redrob design system accent families (tokens.json). Each is
 * vivid enough to read as a cursor on either canvas theme and carries white avatar initials.
 */
export const PEER_COLORS: Color[] = [
  { r: 0.1843, g: 0.5529, b: 1, a: 1 }, // accent-sky-3 #2f8dff
  { r: 0.5373, g: 0.2667, b: 1, a: 1 }, // accent-violet-3 #8944ff
  { r: 1, g: 0.2235, b: 0.7294, a: 1 }, // accent-pink-3 #ff39ba
  { r: 0, g: 0.5255, b: 0.2902, a: 1 }, // accent-green-4 #00864a
  { r: 0.6824, g: 0.3176, b: 0, a: 1 }, // accent-orange-4 #ae5100
  { r: 1, g: 0.2941, b: 0.2941, a: 1 }, // accent-red-3 #ff4b4b
  { r: 0, g: 0.4157, b: 0.4784, a: 1 }, // accent-teal-5 #006a7a
  { r: 0.0549, g: 0.3176, b: 0.7137, a: 1 } // accent-sky-4 #0e51b6
]

export {
  DEFAULT_SHAPE_FILL,
  DEFAULT_FRAME_FILL,
  SECTION_DEFAULT_FILL,
  SECTION_DEFAULT_STROKE,
  ZOOM_DIVISOR,
  ZOOM_SCALE_MIN,
  ZOOM_SCALE_MAX
} from '@redrob-design/core/constants'

export const ASSET_GRID_THUMBNAIL_SIZE = 96
export const ASSET_LIST_THUMBNAIL_SIZE = 40
export const ASSET_THUMBNAIL_RENDER_SCALE = 2

export const HANDLE_SIZE = 6

export const HALF_FRAC = 3 / 7
export const HUD_TOP = 12 + 32 + 6 + 32 + 12

export const SWIPE_THRESHOLD = 30
export const SWIPE_VELOCITY_THRESHOLD = 500
export const DRAWER_SPRING_STIFFNESS = 800
export const DRAWER_SPRING_DAMPING = 50

export const ACTION_TOAST_DURATION = 800
export const DRAG_DEAD_ZONE = 4
export const PEN_CLOSE_THRESHOLD = 8
export const ROTATION_SNAP_DEGREES = 15
export const CORNER_ROTATE_ZONE = 16
export const DEFAULT_TEXT_WIDTH = 200
export const DEFAULT_TEXT_HEIGHT = 24
export const AUTO_LAYOUT_BREAK_THRESHOLD = 8
export const HANDLE_HIT_RADIUS = 6

export const ACP_PERMISSION_TIMEOUT_MS = 60_000

export { ACP_DESIGN_CONTEXT }
