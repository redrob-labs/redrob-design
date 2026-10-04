import { formatHex } from 'culori'

import type { SceneGraph } from '@redrob-design/scene-graph'

import { DESIGN_SYSTEM_RULES } from './rules'
import type { DesignMemory, MemoryColorGroup, MemoryTypeface } from './types'

/** Design Memory keeps the most used of each kind; a file can hold thousands. */
const MAX_TYPEFACES = 4
const MAX_RADII = 8
const MAX_COMPONENTS = 60

function hexOf(color: { r: number; g: number; b: number }): string {
  return formatHex({ mode: 'rgb', r: color.r, g: color.g, b: color.b }).toUpperCase()
}

function colorGroups(graph: SceneGraph): MemoryColorGroup[] {
  const groups: MemoryColorGroup[] = []
  for (const collection of graph.variableCollections.values()) {
    const swatches = []
    for (const id of collection.variableIds) {
      const variable = graph.variables.get(id)
      if (variable?.type !== 'COLOR') continue
      const value = variable.valuesByMode[collection.defaultModeId]
      if (!value || typeof value !== 'object' || !('r' in value)) continue
      swatches.push({ token: variable.name, hex: hexOf(value) })
    }
    if (swatches.length > 0) {
      groups.push({ name: collection.name, note: collection.name, swatches })
    }
  }
  return groups
}

function mostUsed<T>(counts: Map<T, number>, limit: number): T[] {
  return [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value)
}

/**
 * Design Memory read from the open file alone, on this computer: its color
 * variables, the typefaces and radii it uses, its components, and the
 * Design System's own rules.
 */
export function memoryFromDocument(graph: SceneGraph, owner: string): DesignMemory {
  const fonts = new Map<string, number>()
  const radii = new Map<number, number>()
  const components = new Set<string>()
  for (const node of graph.nodes.values()) {
    if (node.type === 'TEXT' && node.fontFamily) {
      fonts.set(node.fontFamily, (fonts.get(node.fontFamily) ?? 0) + 1)
    }
    if (node.cornerRadius > 0) radii.set(node.cornerRadius, (radii.get(node.cornerRadius) ?? 0) + 1)
    if (node.type === 'COMPONENT' && components.size < MAX_COMPONENTS) components.add(node.name)
  }
  const typefaces: MemoryTypeface[] = mostUsed(fonts, MAX_TYPEFACES).map((family) => ({
    family,
    note: ''
  }))
  return {
    owner,
    origin: 'document',
    colors: colorGroups(graph),
    typefaces,
    radii: mostUsed(radii, MAX_RADII).toSorted((a, b) => a - b),
    rules: [...DESIGN_SYSTEM_RULES],
    components: [...components].toSorted((a, b) => a.localeCompare(b)),
    prices: []
  }
}
