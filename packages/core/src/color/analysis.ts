import type { Color } from '@redrob-design/scene-graph/primitives'

export interface ColorUsageEntry {
  hex: string
  color: Color
  count: number
  variableName: string | null
}
