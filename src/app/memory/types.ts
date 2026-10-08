/** A named color in Design Memory: the token people and code use, and its value. */
export interface MemorySwatch {
  token: string
  hex: string
}

export interface MemoryColorGroup {
  name: string
  note: string
  swatches: MemorySwatch[]
}

export interface MemoryTypeface {
  family: string
  note: string
}

/** A rule every model reads before it draws, and where it came from. */
export interface MemoryRule {
  id: string
  text: string
  source: string
  /** Set by the Design System; a person cannot turn it off. */
  locked?: boolean
}

export interface MemoryPrice {
  plan: string
  price: string
}

/**
 * What Redrob knows about how this work should look and read. Every model
 * reads it before it draws, and the opening check holds the page to it.
 */
export interface DesignMemory {
  /** Who this memory belongs to: a product, or the open file. */
  owner: string
  /** `document` is read from the open file; `workspace` from a connected workspace. */
  origin: 'document' | 'workspace'
  colors: MemoryColorGroup[]
  typefaces: MemoryTypeface[]
  radii: number[]
  rules: MemoryRule[]
  components: string[]
  prices: MemoryPrice[]
}

/** Whether a workspace (sites, repositories, sheets) is connected to read from. */
export type WorkspaceStatus =
  | { connected: true; name: string; sources: string[] }
  | { connected: false }

export function colorCount(memory: DesignMemory): number {
  return memory.colors.reduce((total, group) => total + group.swatches.length, 0)
}
