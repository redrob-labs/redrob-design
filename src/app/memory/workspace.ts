import { shallowRef, watch } from 'vue'

import type { SceneGraph } from '@redrob-design/scene-graph'

import { lockPrivacyLevel } from '@/app/assistant/privacy/store'
import {
  ConsoleError,
  activeWorkspaceId,
  consoleCache,
  consoleClient,
  refreshCloudAccount,
  signedIn,
  workspaceMemorySchema,
  workspaceSchema,
  type ConsoleWorkspace,
  type ConsoleWorkspaceMemory
} from '@/app/integrations/console'
import { demoMode } from '@/app/runtime/demo'

import { DEMO_MEMORY, DEMO_WORKSPACE } from './demo'
import { memoryFromDocument } from './document'
import { setDesignMemorySource, type DesignMemorySource } from './service'
import type { DesignMemory, WorkspaceStatus } from './types'

/** The connected workspace and its memory, from Console or its cached copy. */
export const connectedWorkspace = shallowRef<ConsoleWorkspace | null>(null)
export const workspaceMemory = shallowRef<ConsoleWorkspaceMemory | null>(null)

function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const id = key(item)
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
}

/**
 * Workspace Design Memory over the open file's: the workspace's tokens,
 * typefaces and rules come first, then whatever only the file has; the
 * components are the file's, then the workspace's.
 */
export function mergeMemory(workspace: ConsoleWorkspaceMemory, file: DesignMemory): DesignMemory {
  const workspaceTokens = new Set(
    workspace.colors.flatMap((group) => group.swatches.map((swatch) => swatch.token))
  )
  const fileColors = file.colors
    .map((group) => ({
      ...group,
      swatches: group.swatches.filter((swatch) => !workspaceTokens.has(swatch.token))
    }))
    .filter((group) => group.swatches.length > 0)
  return {
    owner: workspace.owner,
    origin: 'workspace',
    colors: [...workspace.colors, ...fileColors],
    typefaces: uniqueBy([...workspace.typefaces, ...file.typefaces], (face) => face.family),
    radii: [...new Set([...workspace.radii, ...file.radii])].sort((a, b) => a - b),
    rules: uniqueBy([...workspace.rules, ...file.rules], (rule) => rule.id),
    components: [...new Set([...file.components, ...workspace.components])],
    prices: workspace.prices
  }
}

/**
 * Design Memory for everyone: the demo's sample on /demo, a signed-in
 * person's workspace merged over the open file, and the file alone
 * otherwise. Reads are synchronous from what is already loaded, so every
 * answer can read memory without waiting on the network.
 */
export const consoleMemorySource: DesignMemorySource = {
  workspace(): WorkspaceStatus {
    if (demoMode.value) {
      return { connected: true, name: DEMO_WORKSPACE.name, sources: [...DEMO_WORKSPACE.sources] }
    }
    const workspace = connectedWorkspace.value
    if (!workspace) return { connected: false }
    return {
      connected: true,
      name: workspace.name,
      sources: workspace.sources.map((source) => source.name)
    }
  },
  read(graph: SceneGraph, documentName: string): DesignMemory {
    if (demoMode.value) return DEMO_MEMORY
    const file = memoryFromDocument(graph, documentName)
    const memory = workspaceMemory.value
    return memory ? mergeMemory(memory, file) : file
  }
}

function isWorkspace(value: unknown): value is ConsoleWorkspace {
  return workspaceSchema.safeParse(value).success
}

function isWorkspaceMemory(value: unknown): value is ConsoleWorkspaceMemory {
  return workspaceMemorySchema.safeParse(value).success
}

function apply(workspace: ConsoleWorkspace | null, memory: ConsoleWorkspaceMemory | null): void {
  connectedWorkspace.value = workspace
  workspaceMemory.value = memory
  // An admin's level holds for every member; without a workspace it is the person's again.
  lockPrivacyLevel(workspace?.policy.privacyLevel ?? null)
}

/** Forgets the workspace, for signing out or switching to none. */
export function disconnectWorkspace(): void {
  apply(null, null)
}

/**
 * Loads a workspace: the cached copy at once, then Console. Offline, the
 * cached copy stays; a workspace the account lost access to is dropped.
 */
export async function loadWorkspace(workspaceId: string): Promise<void> {
  const cache = consoleCache()
  const [cachedWorkspace, cachedMemory] = await Promise.all([
    cache.get(`workspace:${workspaceId}`, isWorkspace),
    cache.get(`memory:${workspaceId}`, isWorkspaceMemory)
  ])
  if (cachedWorkspace) apply(cachedWorkspace.value, cachedMemory?.value ?? null)
  try {
    const client = consoleClient()
    const workspace = await client.call('getWorkspace', { params: { workspaceId } })
    const memory = await client
      .call('getWorkspaceMemory', { params: { workspaceId } })
      .catch((error: unknown) => {
        if (error instanceof ConsoleError && error.kind === 'not-found') return null
        throw error
      })
    apply(workspace.data, memory?.data ?? null)
    await cache.put(`workspace:${workspaceId}`, workspace.data, workspace.etag)
    if (memory) await cache.put(`memory:${workspaceId}`, memory.data, memory.etag)
  } catch (error) {
    const gone =
      error instanceof ConsoleError && (error.kind === 'forbidden' || error.kind === 'not-found')
    if (gone) disconnectWorkspace()
    else console.warn('[Workspace] Keeping the cached workspace', error)
  }
}

let started = false

/**
 * Makes workspace memory the app's Design Memory source and keeps it in
 * step with sign-in and the workspace picked in Settings.
 */
export function startWorkspaceMemory(): void {
  if (started) return
  started = true
  setDesignMemorySource(consoleMemorySource)
  watch(
    [signedIn, activeWorkspaceId],
    ([isSignedIn, workspaceId]) => {
      if (isSignedIn && workspaceId) void loadWorkspace(workspaceId)
      else disconnectWorkspace()
    },
    { immediate: true }
  )
  void refreshCloudAccount()
}
