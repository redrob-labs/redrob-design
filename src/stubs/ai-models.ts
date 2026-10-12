/**
 * UI-slice stub for `@/app/ai/models`.
 *
 * The real module owns the AI-model configuration engine: provider connections,
 * credential storage, the model catalogue, role routing and the device-connect
 * flow — all backend. The settings UI (ModelsPanel, RoleAssignments, and the
 * ProfileEditor skeleton) only needs a reactive settings object plus a set of
 * read/mutation helpers over it. This stub implements a small, fully working
 * in-memory version so the panels render real data and the list/assignment
 * interactions work with no backend. Swap for the real module to reconnect; the
 * components do not change.
 */
import { reactive, ref } from 'vue'

export type AIModelCapability = 'tools' | 'vision'
export type AIModelRole = 'design' | 'review' | 'fast' | 'vision'
export type OptionalAIModelRole = Exclude<AIModelRole, 'design'>

/** A saved model profile (a named provider+model config). */
export interface ModelProfile {
  id: string
  name: string
  connectionId: string
  providerID: string
  modelID: string
  customModelID: string
  capabilities: AIModelCapability[]
}

/** A provider connection a profile is bound to. */
export interface ModelConnection {
  id: string
  providerID: string
  customBaseURL: string
}

interface AIModelSettings {
  models: ModelProfile[]
  connections: ModelConnection[]
  assignments: Record<AIModelRole, string | null>
}

const seedConnections: ModelConnection[] = [
  { id: 'conn-openai', providerID: 'openai', customBaseURL: '' },
  { id: 'conn-redrob', providerID: 'redrob', customBaseURL: '' }
]

const seedModels: ModelProfile[] = [
  {
    id: 'profile-gpt5',
    name: 'GPT-5',
    connectionId: 'conn-openai',
    providerID: 'openai',
    modelID: 'gpt-5',
    customModelID: '',
    capabilities: ['tools', 'vision']
  },
  {
    id: 'profile-redrob',
    name: 'Redrob Auto',
    connectionId: 'conn-redrob',
    providerID: 'redrob',
    modelID: 'auto',
    customModelID: '',
    capabilities: ['tools', 'vision']
  }
]

export const aiModelSettings = ref<AIModelSettings>({
  models: seedModels,
  connections: seedConnections,
  assignments: { design: 'profile-gpt5', review: 'design', fast: null, vision: 'design' }
})

/** Credential status of a connection. The stub reports the seeded connections' status. */
const keyStatus: Record<string, 'configured' | 'missing' | 'unavailable' | 'locked'> = {
  'conn-openai': 'configured',
  'conn-redrob': 'missing'
}

export function modelConnection(id: string | undefined): ModelConnection | undefined {
  return aiModelSettings.value.connections.find((connection) => connection.id === id)
}

export function modelProfile(id: string | null | undefined): ModelProfile | undefined {
  return aiModelSettings.value.models.find((profile) => profile.id === id) ?? undefined
}

export function isAgentModelProfile(profile: ModelProfile | undefined): boolean {
  return Boolean(profile?.providerID.startsWith('acp:'))
}

export function modelConnectionCredentialStatus(
  id: string
): Promise<'configured' | 'missing' | 'unavailable' | 'locked'> {
  return Promise.resolve(keyStatus[id] ?? 'missing')
}

export function modelConnectionUsageCount(connectionId: string): number {
  return aiModelSettings.value.models.filter((profile) => profile.connectionId === connectionId)
    .length
}

export function setModelRoleAssignment(role: AIModelRole, value: string | null): void {
  aiModelSettings.value.assignments[role] = value
}

/* ----- ProfileEditor skeleton surface: working-enough, backend as no-ops ----- */

/** The editable draft a ProfileEditor binds to. */
export interface ModelProfileDraft {
  id?: string
  name: string
  connectionId: string
  providerID: string
  modelID: string
  customModelID: string
  customBaseURL: string
  customAPIType: 'completions' | 'responses'
  capabilities: AIModelCapability[]
  maxOutputTokens: number
  sourceConnectionId: string | null
  harnessThinkingLevel: string
  harnessPermissionMode: string
  reasoningEffort: string
}

export function createModelProfileDraft(profileId?: string): ModelProfileDraft {
  const existing = modelProfile(profileId)
  return reactive({
    id: existing?.id,
    name: existing?.name ?? '',
    connectionId: existing?.connectionId ?? 'conn-openai',
    providerID: existing?.providerID ?? 'openai',
    modelID: existing?.modelID ?? 'gpt-5',
    customModelID: existing?.customModelID ?? '',
    customBaseURL: '',
    customAPIType: 'completions' as const,
    capabilities: [...(existing?.capabilities ?? ['tools'])],
    maxOutputTokens: 16_384,
    sourceConnectionId: null,
    harnessThinkingLevel: 'medium',
    harnessPermissionMode: 'allow-reads',
    reasoningEffort: ''
  })
}

export function findModelConnectionForDraft(draft: ModelProfileDraft): ModelConnection | undefined {
  return aiModelSettings.value.connections.find(
    (connection) => connection.providerID === draft.providerID
  )
}

export function saveModelProfileDraft(draft: ModelProfileDraft): ModelProfile {
  // Skeleton: echoes a profile back without persisting through a backend.
  return {
    id: draft.id ?? `profile-${Date.now()}`,
    name: draft.name,
    connectionId: draft.connectionId,
    providerID: draft.providerID,
    modelID: draft.modelID,
    customModelID: draft.customModelID,
    capabilities: [...draft.capabilities]
  }
}

export function removeModelProfile(_profileId: string): void {
  // Skeleton: no backend to remove from.
}

export function setModelConnectionAPIKey(_connectionId: string, _key: string): Promise<void> {
  return Promise.resolve()
}

export function resolveModelConnectionAPIKey(_connectionId: string): Promise<string | null> {
  return Promise.resolve(null)
}
