import { canvasLabelForeground, resolvePageColor } from '@redrob-design/core/canvas'
import type { Editor } from '@redrob-design/core/editor'
import type { Color, SceneNode } from '@redrob-design/scene-graph'

export interface CanvasLabelPresentation {
  background: Color
  foreground: 'dark' | 'light'
}

const DEFAULT_LABEL_BACKGROUND: Color = { r: 0.37, g: 0.37, b: 0.37, a: 1 }

export function canvasLabelPresentation(
  editor: Editor,
  node: SceneNode | null
): CanvasLabelPresentation {
  const fill = node?.fills[0]
  const background =
    node && fill?.visible
      ? (editor.renderer?.resolveFillColor(fill, 0, node, editor.graph) ?? fill.color)
      : DEFAULT_LABEL_BACKGROUND
  const pageColor = resolvePageColor(editor.state.pageColor, editor.state.canvasTheme)
  const foreground = canvasLabelForeground(background, pageColor)
  return { background, foreground: foreground.r === 0 ? 'dark' : 'light' }
}
