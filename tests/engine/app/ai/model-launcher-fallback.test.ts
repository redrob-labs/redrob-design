import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { setSharedAccountReaderForTests } from '@/app/ai/connect/app-shared-account'
import {
  modelConnectionCredentialStatus,
  modelConnectionKeySource,
  modelSettingsSnapshot,
  replaceAIModelSettings,
  resolveModelConnectionAPIKey,
  resolveModelConnectionKey,
  setModelConnectionAPIKey,
  type AIModelSettings
} from '@/app/ai/models'

let original: AIModelSettings

/** A Redrob (Console) connection and an unrelated one, neither with a stored key. */
function settingsFixture(): AIModelSettings {
  return {
    version: 1,
    connections: [
      {
        id: 'connection-redrob',
        providerID: 'redrob',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'redrob-main'
      },
      {
        id: 'connection-anthropic',
        providerID: 'anthropic',
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: 'anthropic-main'
      }
    ],
    models: [
      {
        id: 'model-redrob',
        name: 'Redrob Auto',
        connectionId: 'connection-redrob',
        modelID: 'redrob-auto',
        customModelID: '',
        maxOutputTokens: 16_384,
        capabilities: ['tools']
      }
    ],
    assignments: { design: 'model-redrob', review: 'design', fast: 'design', vision: 'design' }
  }
}

/** Stands in for the launcher's file: `null` is signed out. Mutated per test. */
let launcher: { apiKey: string; accountName?: string } | null = null

beforeEach(() => {
  original = modelSettingsSnapshot()
  replaceAIModelSettings(settingsFixture())
  launcher = null
  setSharedAccountReaderForTests(async () => launcher)
})

afterEach(async () => {
  await setModelConnectionAPIKey('connection-redrob', '')
  await setModelConnectionAPIKey('connection-anthropic', '')
  setSharedAccountReaderForTests(null)
  replaceAIModelSettings(original)
})

describe('model connections and the launcher fallback', () => {
  test('a Redrob connection with no key of its own is not configured', async () => {
    expect(await resolveModelConnectionKey('connection-redrob')).toBeNull()
    expect(await modelConnectionCredentialStatus('connection-redrob')).toBe('missing')
    expect(await modelConnectionKeySource('connection-redrob')).toBeNull()
  })

  test('the launcher sign-in configures a Redrob connection and is flagged as such', async () => {
    launcher = { apiKey: 'rrk_launcher_value', accountName: 'Redrob' }

    expect(await resolveModelConnectionKey('connection-redrob')).toEqual({
      apiKey: 'rrk_launcher_value',
      source: 'launcher',
      accountName: 'Redrob',
      apiKeyName: undefined,
      apiBaseURL: undefined
    })
    expect(await resolveModelConnectionAPIKey('connection-redrob')).toBe('rrk_launcher_value')
    expect(await modelConnectionCredentialStatus('connection-redrob')).toBe('configured')
    expect(await modelConnectionKeySource('connection-redrob')).toBe('launcher')
  })

  test('only Redrob connections fall back; other providers ignore the launcher', async () => {
    launcher = { apiKey: 'rrk_launcher_value' }

    expect(await resolveModelConnectionKey('connection-anthropic')).toBeNull()
    expect(await modelConnectionCredentialStatus('connection-anthropic')).toBe('missing')
  })

  test("the app's own key wins, and clearing it falls back to the launcher", async () => {
    launcher = { apiKey: 'rrk_launcher_value' }
    await setModelConnectionAPIKey('connection-redrob', 'rrk_own_value')

    expect(await resolveModelConnectionKey('connection-redrob')).toEqual({
      apiKey: 'rrk_own_value',
      source: 'own'
    })

    await setModelConnectionAPIKey('connection-redrob', '')

    expect(await modelConnectionKeySource('connection-redrob')).toBe('launcher')
    expect(await resolveModelConnectionAPIKey('connection-redrob')).toBe('rrk_launcher_value')
  })

  test('a launcher sign-out is seen at the next read, not at startup', async () => {
    launcher = { apiKey: 'rrk_launcher_value' }
    expect(await modelConnectionKeySource('connection-redrob')).toBe('launcher')

    launcher = null

    expect(await resolveModelConnectionKey('connection-redrob')).toBeNull()
    expect(await modelConnectionCredentialStatus('connection-redrob')).toBe('missing')
  })
})
