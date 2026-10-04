import { ref } from 'vue'

import type { SceneGraph } from '@redrob-design/scene-graph'

import { demoMode } from '@/app/runtime/demo'

import { DEMO_MEMORY, DEMO_WORKSPACE } from './demo'
import { memoryFromDocument } from './document'
import type { DesignMemory, WorkspaceStatus } from './types'

/** Where Design Memory comes from. A connected workspace replaces the stub. */
export interface DesignMemorySource {
  workspace(): WorkspaceStatus
  read(graph: SceneGraph, documentName: string): DesignMemory
}

/**
 * The workspace reader is a stub until a workspace connector exists: demo
 * mode answers with the prototype's Redrob Office, and anywhere else the
 * workspace is not connected and memory comes from the open file.
 */
export const stubMemorySource: DesignMemorySource = {
  workspace: () =>
    demoMode.value
      ? { connected: true, name: DEMO_WORKSPACE.name, sources: [...DEMO_WORKSPACE.sources] }
      : { connected: false },
  read: (graph, documentName) =>
    demoMode.value ? DEMO_MEMORY : memoryFromDocument(graph, documentName)
}

let source: DesignMemorySource = stubMemorySource

export function designMemorySource(): DesignMemorySource {
  return source
}

export function setDesignMemorySourceForTests(next: DesignMemorySource | null): void {
  source = next ?? stubMemorySource
}

/** Whether the Design Memory drawer is open. */
export const designMemoryOpen = ref(false)

export function openDesignMemory(): void {
  designMemoryOpen.value = true
}

/**
 * Design Memory as a few lines the model reads before it draws. Kept short:
 * tokens and rules, not every swatch.
 */
export function designMemoryBrief(memory: DesignMemory): string {
  const lines = [`Design Memory for ${memory.owner}.`]
  for (const group of memory.colors) {
    lines.push(
      `${group.name}: ${group.swatches.map((swatch) => `${swatch.token} ${swatch.hex}`).join(', ')}`
    )
  }
  if (memory.typefaces.length > 0) {
    lines.push(`Type: ${memory.typefaces.map((face) => face.family).join(', ')}`)
  }
  if (memory.radii.length > 0) lines.push(`Radii: ${memory.radii.join(', ')}px`)
  for (const rule of memory.rules) lines.push(`Rule: ${rule.text}`)
  if (memory.prices.length > 0) {
    lines.push(`Prices: ${memory.prices.map((price) => `${price.plan} ${price.price}`).join(', ')}`)
  }
  return lines.join('\n')
}
