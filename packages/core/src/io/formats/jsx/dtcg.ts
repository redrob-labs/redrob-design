import type {
  SceneGraph,
  Variable,
  VariableCollection,
  VariableValue
} from '@redrob-design/scene-graph'

import { colorToHex8 } from '#core/color'

/**
 * Design tokens in the Design Tokens Community Group format: groups are
 * objects, a token is an object with `$value` and `$type`. Mode values other
 * than the default sit under `$extensions["design.redrob.modes"]`.
 */
export interface DTCGToken {
  $type: 'color' | 'number' | 'string' | 'boolean'
  $value: string | number | boolean
  $description?: string
  $extensions?: { 'design.redrob.modes': Record<string, string | number | boolean> }
}

export interface DTCGGroup {
  [key: string]: DTCGGroup | DTCGToken
}

const DTCG_TYPE: Record<Variable['type'], DTCGToken['$type']> = {
  COLOR: 'color',
  FLOAT: 'number',
  STRING: 'string',
  BOOLEAN: 'boolean'
}

function segment(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[{}.$]/g, '-')
}

/** Path segments of a variable: its collection, then its name split at `/`. */
function tokenPath(graph: SceneGraph, variable: Variable): string[] {
  const collection = graph.variableCollections.get(variable.collectionId)
  return [collection?.name ?? 'Tokens', ...variable.name.split('/')].map(segment).filter(Boolean)
}

/**
 * The CSS custom property a variable becomes: `Brand/Action primary` is
 * `--action-primary`. The collection is left out so a token keeps its name
 * across collections, the way design systems name them.
 */
export function tokenCSSName(variable: Pick<Variable, 'name'>): string {
  const slug = variable.name
    .split('/')
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)
    .join('-')
  return `--${slug || 'token'}`
}

function tokenValue(graph: SceneGraph, value: VariableValue): string | number | boolean {
  if (typeof value === 'object' && 'aliasId' in value) {
    const target = graph.variables.get(value.aliasId)
    return target ? `{${tokenPath(graph, target).join('.')}}` : ''
  }
  if (typeof value === 'object') return colorToHex8(value, value.a).toUpperCase()
  return value
}

function tokenFor(
  graph: SceneGraph,
  variable: Variable,
  collection?: VariableCollection
): DTCGToken {
  const defaultMode = collection?.defaultModeId ?? Object.keys(variable.valuesByMode)[0]
  const token: DTCGToken = {
    $type: DTCG_TYPE[variable.type],
    $value: tokenValue(graph, variable.valuesByMode[defaultMode] ?? '')
  }
  if (variable.description) token.$description = variable.description
  const otherModes = (collection?.modes ?? []).filter(
    (mode) => mode.modeId !== defaultMode && Object.hasOwn(variable.valuesByMode, mode.modeId)
  )
  if (otherModes.length > 0) {
    token.$extensions = {
      'design.redrob.modes': Object.fromEntries(
        otherModes.map((mode) => [mode.name, tokenValue(graph, variable.valuesByMode[mode.modeId])])
      )
    }
  }
  return token
}

function isToken(entry: DTCGGroup | DTCGToken): entry is DTCGToken {
  return '$type' in entry && typeof entry.$type === 'string'
}

function place(root: DTCGGroup, path: string[], token: DTCGToken): void {
  let group = root
  for (const key of path.slice(0, -1)) {
    const next = Object.hasOwn(group, key) ? group[key] : undefined
    if (next && !isToken(next)) {
      group = next
      continue
    }
    const created: DTCGGroup = {}
    group[key] = created
    group = created
  }
  group[path[path.length - 1]] = token
}

/** Every variable in the document as one DTCG token file, aliases kept as references. */
export function exportDTCG(graph: SceneGraph): DTCGGroup {
  const root: DTCGGroup = {}
  for (const variable of graph.variables.values()) {
    const collection = graph.variableCollections.get(variable.collectionId)
    place(root, tokenPath(graph, variable), tokenFor(graph, variable, collection))
  }
  return root
}

function cssValue(graph: SceneGraph, variable: Variable, value: VariableValue | undefined): string {
  if (value === undefined) return ''
  if (typeof value === 'object' && 'aliasId' in value) {
    const target = graph.variables.get(value.aliasId)
    return target ? `var(${tokenCSSName(target)})` : ''
  }
  if (typeof value === 'object') return colorToHex8(value, value.a).toUpperCase()
  if (typeof value === 'number') return variable.type === 'FLOAT' ? `${value}px` : String(value)
  return typeof value === 'string' ? JSON.stringify(value) : String(value)
}

/**
 * The same tokens as CSS custom properties in their default mode, the file
 * the Tailwind classes from `sceneNodeToJSX(..., 'tailwind')` read.
 */
export function exportTokensCSS(graph: SceneGraph): string {
  const lines: string[] = []
  for (const variable of graph.variables.values()) {
    if (variable.type === 'BOOLEAN') continue
    const collection = graph.variableCollections.get(variable.collectionId)
    const modeId = collection?.defaultModeId ?? Object.keys(variable.valuesByMode)[0]
    const value = cssValue(graph, variable, variable.valuesByMode[modeId])
    if (value) lines.push(`  ${tokenCSSName(variable)}: ${value};`)
  }
  return lines.length > 0 ? `:root {\n${lines.join('\n')}\n}\n` : ''
}
