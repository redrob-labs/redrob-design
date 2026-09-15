import type { SceneNode, TextPathData } from '@redrob-design/scene-graph'

export * from './fitting'
export * from './layout'
export * from './sampling'
export * from './selection'

export function getTextPathData(node: SceneNode): TextPathData | null {
  return node.textPathData
}
