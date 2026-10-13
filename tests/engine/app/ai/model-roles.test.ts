import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { buildReasoningProviderOptions } from '@/app/ai/chat/reasoning'
import { connectEngine, resetEngineConnection } from '@/app/ai/engine/daemon'
import {
  aiModelSettings,
  createAIModelRuntime,
  createModelProfileDraft,
  designModelProfiles,
  modelSettingsSnapshot,
  removeModelProfile,
  replaceAIModelSettings,
  resolveAIModelRole,
  saveModelProfileDraft,
  setModelRoleAssignment,
  type AIModelSettings
} from '@/app/ai/models'
import { appCredentialRefs } from '@/app/settings/credentials/persistence'
import { credentialKey } from '@/app/settings/credentials/reference'

let original: AIModelSettings

function settingsFixture(): AIModelSettings {
  return {
    version: 1,
    connections: [
      // One engine, one connection: every profile is a model the engine reaches.
      {
        id: 'connection-engine',
        providerID: 'engine',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'connection-engine'
      }
    ],
    models: [
      {
        id: 'model-design',
        name: 'Design model',
        connectionId: 'connection-engine',
        modelID: 'anthropic/claude-sonnet-4-6-20260301',
        customModelID: '',
        maxOutputTokens: 16_384,
        capabilities: ['tools', 'vision']
      },
      {
        id: 'model-fast',
        name: 'Fast model',
        connectionId: 'connection-engine',
        modelID: 'google/gemini-3-flash-preview',
        customModelID: '',
        maxOutputTokens: 8192,
        capabilities: ['tools']
      }
    ],
    assignments: {
      design: 'model-design',
      review: 'design',
      fast: 'model-fast',
      vision: 'design'
    }
  }
}

beforeEach(() => {
  original = modelSettingsSnapshot()
  replaceAIModelSettings(settingsFixture())
})

afterEach(() => {
  replaceAIModelSettings(original)
})

describe('AI model profiles and role assignments', () => {
  test('resolves inherited and independent assignments', () => {
    expect(resolveAIModelRole('review')).toMatchObject({
      requestedRole: 'review',
      profile: { id: 'model-design' },
      connection: { id: 'connection-engine' }
    })
    expect(resolveAIModelRole('fast')).toMatchObject({
      requestedRole: 'fast',
      profile: { id: 'model-fast' },
      connection: { id: 'connection-engine' }
    })
  })

  test('enforces role capability requirements', () => {
    setModelRoleAssignment('design', 'model-fast')
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-fast')

    setModelRoleAssignment('vision', 'model-fast')
    expect(resolveAIModelRole('vision')).toBeNull()

    setModelRoleAssignment('vision', null)
    expect(resolveAIModelRole('vision')).toBeNull()
  })

  test('switches the design agent between saved profiles', () => {
    const switchable = designModelProfiles()
    expect(switchable.map((profile) => profile.id)).toEqual(['model-design', 'model-fast'])

    setModelRoleAssignment('design', 'model-fast')
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-fast')
    expect(resolveAIModelRole('design')?.connection.id).toBe('connection-engine')

    setModelRoleAssignment('design', 'model-design')
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-design')
  })

  test('refuses to assign a profile that cannot use tools as the design agent', () => {
    aiModelSettings.value.models.push({
      id: 'model-textonly',
      name: 'Text only',
      connectionId: 'connection-engine',
      modelID: 'text-only',
      customModelID: '',
      maxOutputTokens: 4096,
      capabilities: []
    })

    setModelRoleAssignment('design', 'model-textonly')
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-design')
  })

  test('reuses matching provider connections when adding models', () => {
    const draft = createModelProfileDraft()
    draft.name = 'Review model'
    draft.providerID = 'engine'
    draft.modelID = 'anthropic/claude-opus-4-6-20260301'
    draft.sourceConnectionId = null

    const profile = saveModelProfileDraft(draft)
    expect(profile.connectionId).toBe('connection-engine')
    expect(modelSettingsSnapshot().connections).toHaveLength(1)
  })

  test('keeps ACP agents exclusive to the Design role', () => {
    const settings = modelSettingsSnapshot()
    settings.connections.push({
      id: 'connection-acp',
      providerID: 'acp:redrob-code',
      customBaseURL: '',
      customAPIType: 'completions',
      credentialProfileId: 'connection-acp'
    })
    settings.models.push({
      id: 'model-acp',
      name: 'Claude Code',
      connectionId: 'connection-acp',
      modelID: '',
      customModelID: '',
      maxOutputTokens: 16_384,
      capabilities: ['tools']
    })
    replaceAIModelSettings(settings)

    setModelRoleAssignment('review', null)
    setModelRoleAssignment('review', 'model-acp')
    expect(resolveAIModelRole('review')).toBeNull()

    setModelRoleAssignment('design', 'model-acp')
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-acp')
    setModelRoleAssignment('fast', null)
    setModelRoleAssignment('fast', 'design')
    expect(resolveAIModelRole('fast')).toBeNull()
  })

  test('normalizes invalid output limits before persistence', () => {
    const draft = createModelProfileDraft('model-fast')
    draft.maxOutputTokens = Number.NaN
    expect(saveModelProfileDraft(draft).maxOutputTokens).toBe(16_384)
  })

  test('persists provider-specific reasoning effort', () => {
    const draft = createModelProfileDraft('model-fast')
    draft.reasoningEffort = 'none'
    expect(saveModelProfileDraft(draft).reasoningEffort).toBe('none')
    expect(createModelProfileDraft('model-fast').reasoningEffort).toBe('none')
  })

  test('maps reasoning effort onto the engine route as OpenAI reasoning_effort', () => {
    // The engine's route is OpenAI-compatible whatever provider sits behind the model.
    expect(buildReasoningProviderOptions('engine', 'none')).toEqual({
      openai: { reasoningEffort: 'none' }
    })
    expect(buildReasoningProviderOptions('acp:redrob-code', 'high')).toBeUndefined()
    expect(buildReasoningProviderOptions('engine', '')).toBeUndefined()
  })

  test('repairs assignments when removing a model', () => {
    removeModelProfile('model-design')
    const settings = modelSettingsSnapshot()
    expect(settings.assignments.design).toBe('model-fast')
    expect(settings.assignments.vision).toBeNull()
    expect(settings.connections.map((connection) => connection.id)).toEqual(['connection-engine'])
  })

  test('keeps the assigned design profile when no capable fallback exists', () => {
    const settings = settingsFixture()
    settings.models = [
      settings.models[0],
      {
        id: 'model-text-only',
        name: 'Text-only model',
        connectionId: 'connection-engine',
        modelID: 'text-only',
        customModelID: '',
        maxOutputTokens: 4096,
        capabilities: []
      }
    ]
    replaceAIModelSettings(settings)

    removeModelProfile('model-design')

    expect(modelSettingsSnapshot().models.map((profile) => profile.id)).toEqual([
      'model-design',
      'model-text-only'
    ])
    expect(resolveAIModelRole('design')?.profile.id).toBe('model-design')
  })

  test('keeps no model credential in this app: the engine holds the Redrob key', () => {
    const keys = appCredentialRefs().map(credentialKey)
    expect(keys.some((key) => key.includes(':connection-engine:'))).toBe(false)
    expect(keys.some((key) => key.startsWith('v1:engine:'))).toBe(false)
  })

  test('creates a role runtime on the shared daemon without exposing its secret', async () => {
    // The daemon record `redrob service start --json` would print, without running anything.
    await connectEngine({
      fresh: true,
      spawn: async () => ({
        code: 0,
        stdout: JSON.stringify({
          id: 'd1',
          version: 'test',
          url: 'http://127.0.0.1:4096',
          port: 4096,
          pid: 1,
          secret: 's3cret'
        })
      })
    })
    try {
      const runtime = await createAIModelRuntime('review')
      expect(runtime?.kind).toBe('direct')
      expect(runtime?.role.profile.id).toBe('model-design')
      expect(runtime).not.toHaveProperty('apiKey')
      expect(JSON.stringify(runtime)).not.toContain('s3cret')
    } finally {
      resetEngineConnection()
    }
  })
})
