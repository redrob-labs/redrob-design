import { FigmaAPI, SceneGraph } from '@redrob-design/core'
export function createAPI(): FigmaAPI {
  return new FigmaAPI(new SceneGraph())
}
