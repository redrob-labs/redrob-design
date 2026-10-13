import type { LanguageModel } from 'ai'

import { createLanguageModel } from '@/app/ai/chat/model'
import type { WorkspaceKey } from '@/app/ai/connect/shared-account'
import {
  clearEngineRedrobKey,
  readEngineAccountStatus,
  setEngineRedrobKey
} from '@/app/ai/engine/auth'
import { connectEngine, engineOpenAIBaseURL } from '@/app/ai/engine/daemon'
import { modelConnection, resolveAIModelRole } from '@/app/ai/models/store'
import type { AIModelRole, ResolvedAIModelRole } from '@/app/ai/models/types'
import type { CredentialStatus } from '@/app/settings/credentials/types'

export type DirectAIModelRuntime = {
  kind: 'direct'
  role: ResolvedAIModelRole
  model: LanguageModel
}

export type ACPModelRuntime = {
  kind: 'acp'
  role: ResolvedAIModelRole
}

export type AIModelRuntime = DirectAIModelRuntime | ACPModelRuntime

/**
 * What the engine connection "has" as a key: the engine's own Redrob account. This app never holds
 * a Console key; the sign-in flow hands it to the engine (engine/auth.ts), and the launcher's
 * shared sign-in counts because the engine reads that file itself.
 */
export async function resolveModelConnectionKey(
  connectionId: string
): Promise<WorkspaceKey | null> {
  const connection = modelConnection(connectionId)
  if (connection?.providerID !== 'engine') return null
  const status = await readEngineAccountStatus().catch(() => ({ connected: false }) as const)
  if (!status.connected) return null
  // The engine keeps the key; what the app knows is where it came from.
  return { apiKey: '', source: status.source === 'launcher' ? 'launcher' : 'own' }
}

export async function modelConnectionCredentialStatus(
  connectionId: string
): Promise<CredentialStatus> {
  const connection = modelConnection(connectionId)
  if (connection?.providerID !== 'engine') return 'missing'
  try {
    return (await readEngineAccountStatus()).connected ? 'configured' : 'missing'
  } catch {
    return 'unavailable'
  }
}

/** `launcher` when the engine's key is Redrob Launcher's, `own` when it was handed over here, `null` for none. */
export async function modelConnectionKeySource(
  connectionId: string
): Promise<WorkspaceKey['source'] | null> {
  return (await resolveModelConnectionKey(connectionId))?.source ?? null
}

/** Hands a Console key to the engine, or removes the engine's. The launcher's shared file is never touched. */
export async function setModelConnectionAPIKey(connectionId: string, value: string): Promise<void> {
  const connection = modelConnection(connectionId)
  if (connection?.providerID !== 'engine') return
  const key = value.trim()
  if (key) await setEngineRedrobKey(key)
  else await clearEngineRedrobKey()
}

/** The daemon's secret, which is what the engine adapter authenticates with; not a provider key. */
export async function resolveModelConnectionAPIKey(connectionId: string): Promise<string | null> {
  const connection = modelConnection(connectionId)
  if (connection?.providerID !== 'engine') return null
  return (await connectEngine()).secret
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
  if (resolved.connection.providerID.startsWith('acp:')) {
    if (role !== 'design') {
      throw new Error('ACP agents can only be assigned to the Design agent role')
    }
    return { kind: 'acp', role: resolved }
  }

  // The shared daemon, found or started now: its secret is the Basic password and its `/v1` the base.
  const daemon = await connectEngine()
  return {
    kind: 'direct',
    role: resolved,
    model: createLanguageModel({
      providerID: resolved.connection.providerID,
      apiKey: daemon.secret,
      modelID: resolved.profile.modelID,
      customModelID: resolved.profile.customModelID,
      customBaseURL: engineOpenAIBaseURL(daemon),
      customAPIType: 'completions'
    })
  }
}
