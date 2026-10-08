import type { ChangeDetail } from '@/app/assistant/changes/store'
import type { ChangeItem } from '@/components/ui/agent/types'

export type PropertyGroup =
  | 'fill'
  | 'stroke'
  | 'position'
  | 'size'
  | 'text'
  | 'name'
  | 'opacity'
  | 'effects'
  | 'corners'
  | 'type'
  | 'layout'
  | 'order'
  | 'visibility'
  | 'other'

export interface ChangeItemWords {
  properties: Record<PropertyGroup, string>
  textOf: (name: string) => string
}

const GROUP_BY_KEY: Record<string, PropertyGroup> = {
  fills: 'fill',
  strokes: 'stroke',
  x: 'position',
  y: 'position',
  rotation: 'position',
  width: 'size',
  height: 'size',
  text: 'text',
  name: 'name',
  opacity: 'opacity',
  effects: 'effects',
  cornerRadius: 'corners',
  topLeftRadius: 'corners',
  topRightRadius: 'corners',
  bottomLeftRadius: 'corners',
  bottomRightRadius: 'corners',
  fontSize: 'type',
  fontFamily: 'type',
  fontWeight: 'type',
  italic: 'type',
  lineHeight: 'type',
  letterSpacing: 'type',
  textAlignHorizontal: 'type',
  textAlignVertical: 'type',
  parentId: 'order',
  childIds: 'order',
  visible: 'visibility'
}

/** Fields the renderer derives from the ones a person sets; never a change on their own. */
function isDerived(key: string): boolean {
  return /^derived|Geometry$|^textPath|^styleRuns$/.test(key)
}

function groupOf(key: string): PropertyGroup {
  if (key in GROUP_BY_KEY) return GROUP_BY_KEY[key]
  if (key.startsWith('layout') || key.startsWith('padding') || key.endsWith('Spacing')) {
    return 'layout'
  }
  return 'other'
}

/** The property groups a change touched, in a stable order, "Other" last. */
export function propertyGroups(keys: readonly string[]): PropertyGroup[] {
  const groups = new Set<PropertyGroup>()
  for (const key of keys) if (!isDerived(key)) groups.add(groupOf(key))
  const ordered: PropertyGroup[] = [...groups].filter((group) => group !== 'other')
  if (groups.has('other') && ordered.length === 0) ordered.push('other')
  return ordered
}

/** One answer's changes as `Changes` items, in plain words. */
export function changeItems(
  details: readonly ChangeDetail[],
  words: ChangeItemWords
): ChangeItem[] {
  const items: ChangeItem[] = []
  for (const detail of details) {
    if (detail.kind !== 'changed') {
      items.push({ id: detail.id, kind: detail.kind, label: detail.name })
      continue
    }
    if (detail.textBefore !== undefined && detail.textAfter !== undefined) {
      items.push({
        id: `${detail.id}-text`,
        kind: 'changed',
        label: words.textOf(detail.name),
        before: detail.textBefore,
        after: detail.textAfter
      })
    }
    const groups = propertyGroups(detail.keys).filter((group) => group !== 'text')
    if (groups.length === 0) continue
    items.push({
      id: detail.id,
      kind: 'changed',
      label: detail.name,
      note: groups.map((group) => words.properties[group]).join(', ')
    })
  }
  return items
}
