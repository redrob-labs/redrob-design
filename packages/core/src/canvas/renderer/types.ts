import type { VectorRegion, VectorVertex } from '@redrob-design/scene-graph'
import type { Color, Rect, Vector } from '@redrob-design/scene-graph/primitives'
import type { SnapGuide } from '@redrob-design/scene-graph/snap'

import type { GuideOverlayState } from '#core/canvas/guides/types'
import type { TextEditor } from '#core/text/editor'

export interface RulerTheme {
  background: Color
  tick: Color
  text: Color
  label: Color
}

/**
 * Overlay colours the host app resolves from its design tokens and hands to the renderer, because
 * CanvasKit cannot read CSS. Every field is optional per frame: `null`/absent falls back to the
 * constants in `#core/constants`, which carry the same design-system light values, so headless and
 * CLI rendering match the app's light theme.
 */
export interface CanvasTheme {
  selection: Color
  component: Color
  snap: Color
  measurement: Color
  /** Auto-layout padding hover: ticks and striped padding bands. */
  layoutPadding: Color
  /** Auto-layout gap hover: striped spacing bands between children. */
  layoutGap: Color
}

export type CanvasThemeColor = keyof CanvasTheme

export type MeasurementMode = 'off' | 'shallow' | 'deep'

export interface RenderOverlays {
  hoveredNodeId?: string | null
  measurementMode?: MeasurementMode
  enteredContainerId?: string | null
  editingTextId?: string | null
  textEditor?: TextEditor | null
  marquee?: Rect | null
  snapGuides?: SnapGuide[]
  guides?: GuideOverlayState
  rotationPreview?: { nodeId: string; angle: number } | null
  dropTargetId?: string | null
  layoutInsertIndicator?: {
    x: number
    y: number
    length: number
    direction: 'HORIZONTAL' | 'VERTICAL'
  } | null
  autoLayoutHover?: {
    nodeId: string
    kind: 'frame' | 'children' | 'spacing' | 'spacing-value' | 'padding' | 'padding-value'
    index?: number
    side?: 'top' | 'right' | 'bottom' | 'left'
  } | null
  penState?: {
    vertices: Vector[]
    segments: Array<{
      start: number
      end: number
      tangentStart: Vector
      tangentEnd: Vector
    }>
    dragTangent: Vector | null
    oppositeDragTangent?: Vector | null
    closingToFirst: boolean
    pendingClose?: boolean
    cursorX?: number
    cursorY?: number
  } | null
  nodeEditState?: {
    nodeId: string
    vertices: VectorVertex[]
    segments: Array<{
      start: number
      end: number
      tangentStart: Vector
      tangentEnd: Vector
    }>
    regions: VectorRegion[]
    selectedVertexIndices: Set<number>
    selectedHandles?: Set<number>
    hoveredHandleInfo?: { segmentIndex: number; tangentField: 'tangentStart' | 'tangentEnd' } | null
  } | null
  remoteCursors?: Array<{
    name: string
    color: Color
    x: number
    y: number
    selection?: string[]
  }>
}
