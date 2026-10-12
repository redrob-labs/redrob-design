import type { LanguageModel } from 'ai'

import { createLanguageModel } from '@/app/ai/chat/model'
import { readSharedAccount } from '@/app/ai/connect/app-shared-account'
import { resolveWorkspaceKey, type WorkspaceKey } from '@/app/ai/connect/shared-account'
import { modelConnection, resolveAIModelRole } from '@/app/ai/models/store'
import type { AIModelConnection, AIModelRole, ResolvedAIModelRole } from '@/app/ai/models/types'
import { appCredentialServices } from '@/app/settings/credentials/app'
import {
  initializeCredentialMigration,
  providerCredentialRef
} from '@/app/settings/credentials/migration'
import type { CredentialRef, CredentialStatus } from '@/app/settings/credentials/types'

export type DirectAIModelRuntime = {
  kind: 'direct'
  role: ResolvedAIModelRole
  model: LanguageModel
}

export type ACPModelRuntime = {
  kind: 'acp'
  role: ResolvedAIModelRole
}

export type HarnessModelRuntime = {
  kind: 'harness'
  role: ResolvedAIModelRole
}

export type AIModelRuntime = DirectAIModelRuntime | ACPModelRuntime | HarnessModelRuntime

export function modelConnectionCredentialRef(connection: AIModelConnection): CredentialRef {
  return providerCredentialRef(connection.providerID, connection.credentialProfileId)
}

/** Only Console-issued keys have a launcher-shared counterpart; other providers never fall back. */
function usesRedrobWorkspaceKey(connection: AIModelConnection): boolean {
  return connection.providerID === 'redrob'
}

/**
 * The key a connection uses, with where it came from. The app's own stored key wins; a
 * Redrob connection without one falls back to Redrob Launcher's shared sign-in, read at
 * this moment so a launcher sign-in or sign-out while the app runs is honoured.
 */
export async function resolveModelConnectionKey(
  connectionId: string
): Promise<WorkspaceKey | null> {
  await initializeCredentialMigration()
  const connection = modelConnection(connectionId)
  if (!connection || connection.providerID.startsWith('acp:')) return null
  const reference = modelConnectionCredentialRef(connection)
  return resolveWorkspaceKey(
    () => appCredentialServices.resolver.resolve(reference),
    usesRedrobWorkspaceKey(connection) ? readSharedAccount : async () => null
  )
}

export async function modelConnectionCredentialStatus(
  connectionId: string
): Promise<CredentialStatus> {
  const connection = modelConnection(connectionId)
  if (!connection || connection.providerID.startsWith('acp:')) return 'missing'
  const status = await appCredentialServices.manager.status(
    modelConnectionCredentialRef(connection)
  )
  if (status !== 'missing' || !usesRedrobWorkspaceKey(connection)) return status
  return (await readSharedAccount()) ? 'configured' : 'missing'
}

/** `launcher` when the key in use is Redrob Launcher's, `own` for the app's, `null` for none. */
export async function modelConnectionKeySource(
  connectionId: string
): Promise<WorkspaceKey['source'] | null> {
  return (await resolveModelConnectionKey(connectionId))?.source ?? null
}

/**
 * Stores or clears the app's OWN key. Clearing never touches the launcher's shared file,
 * so after a clear the connection may still resolve to the launcher's key.
 */
export async function setModelConnectionAPIKey(connectionId: string, value: string): Promise<void> {
  const connection = modelConnection(connectionId)
  if (!connection || connection.providerID.startsWith('acp:')) return
  const reference = modelConnectionCredentialRef(connection)
  const key = value.trim()
  if (key) await appCredentialServices.manager.set(reference, key)
  else await appCredentialServices.manager.clear(reference)
}

export async function resolveModelConnectionAPIKey(connectionId: string): Promise<string | null> {
  return (await resolveModelConnectionKey(connectionId))?.apiKey ?? null
}

export async function createAIModelRuntime(role: AIModelRole): Promise<AIModelRuntime | null> {
  const resolved = resolveAIModelRole(role)
  if (!resolved) return null
  if (role === 'design' && !resolved.profile.capabilities.includes('tools')) {
    throw new Error('The Design model must support tools')
  }
  if (role === 'vision' && !resolved.profile.capabilities.includes('vision')) {
    throw new Error('The Vision model must support image input')
  }
  if (resolved.connection.providerID === 'harness:pi') {
    if (role !== 'design') {
      throw new Error('Harness agents can only be assigned to the Design agent role')
    }
    return { kind: 'harness', role: resolved }
  }
  if (resolved.connection.providerID.startsWith('acp:')) {
    if (role !== 'design') {
      throw new Error('ACP agents can only be assigned to the Design agent role')
    }
    return { kind: 'acp', role: resolved }
  }

  const apiKey = await resolveModelConnectionAPIKey(resolved.connection.id)
  if (!apiKey) throw new Error(`Credential is unavailable for the ${role} model role`)
  return {
    kind: 'direct',
    role: resolved,
    model: createLanguageModel({
      providerID: resolved.connection.providerID,
      apiKey,
      modelID: resolved.profile.modelID,
      customModelID: resolved.profile.customModelID,
      customBaseURL: resolved.connection.customBaseURL,
      customAPIType: resolved.connection.customAPIType
    })
  }
}
