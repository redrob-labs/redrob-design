import { copyInstanceComponentProps, type SceneNode } from '@redrob-design/scene-graph'

export function cloneInstanceUpdate(
  source: SceneNode,
  componentId: string | null,
  extra: Partial<SceneNode> = {}
): Partial<SceneNode> {
  return {
    ...copyInstanceComponentProps(source),
    componentId,
    derivedLayout: source.derivedLayout ? { ...source.derivedLayout } : null,
    ...extra
  }
}
