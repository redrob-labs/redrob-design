/**
 * The engine connection's "key" is the engine's own Redrob account.
 *
 * This app never stores a Console key. Signing in hands the key to the shared daemon
 * (`PUT /auth/redrob`); whether a profile is configured is read from the daemon's provider list,
 * the same way Cowork reads it. The daemon itself is stubbed: `connectEngine` is primed with the
 * record `redrob service start --json` would print, and `fetch` answers for the daemon.
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { deriveEngineAccountStatus } from '@/app/ai/engine/auth'
import { connectEngine, resetEngineConnection } from '@/app/ai/engine/daemon'
import {
  modelConnectionCredentialStatus,
  modelConnectionKeySource,
  modelSettingsSnapshot,
  replaceAIModelSettings,
  resolveModelConnectionAPIKey,
  setModelConnectionAPIKey,
  type AIModelSettings
} from '@/app/ai/models'

const DAEMON = {
  id: 'd1',
  version: 'test',
  url: 'http://127.0.0.1:4096',
  port: 4096,
  pid: 1,
  secret: 's3cret'
}

function settingsFixture(): AIModelSettings {
  return {
    version: 1,
    connections: [
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
        id: 'model-auto',
        name: 'Redrob Auto',
        connectionId: 'connection-engine',
        modelID: 'redrob/auto',
        customModelID: '',
        maxOutputTokens: 16_384,
        capabilities: ['tools']
      }
    ],
    assignments: { design: 'model-auto', review: 'design', fast: 'design', vision: 'design' }
  }
}

type Call = { url: string; method: string; body: string | null; authorization: string | null }
let calls: Call[] = []
/** What the daemon's `/provider` answers; mutated per test. */
let providerList: unknown = { all: [] }
let original: AIModelSettings
const realFetch = globalThis.fetch

beforeEach(async () => {
  original = modelSettingsSnapshot()
  replaceAIModelSettings(settingsFixture())
  calls = []
  providerList = { all: [] }
  await connectEngine({
    fresh: true,
    spawn: async () => ({ code: 0, stdout: JSON.stringify(DAEMON), stderr: '' })
  })
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    calls.push({
      url,
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : null,
      authorization: headers.get('authorization')
    })
    if (url.endsWith('/provider')) return Response.json(providerList)
    if (url.includes('/auth/redrob')) return new Response(null, { status: 200 })
    return new Response('not found', { status: 404 })
  }) as typeof fetch
})

afterEach(() => {
  globalThis.fetch = realFetch
  resetEngineConnection()
  replaceAIModelSettings(original)
})

describe('deriveEngineAccountStatus', () => {
  test('is connected only when the engine lists a Redrob credential that is not the public placeholder', () => {
    expect(deriveEngineAccountStatus(null).connected).toBe(false)
    expect(deriveEngineAccountStatus({ all: [{ id: 'anthropic', source: 'api' }] }).connected).toBe(
      false
    )
    expect(
      deriveEngineAccountStatus({ all: [{ id: 'redrob', options: { apiKey: 'public' } }] })
        .connected
    ).toBe(false)
    expect(deriveEngineAccountStatus({ all: [{ id: 'redrob', source: 'api' }] })).toEqual({
      connected: true,
      source: 'api'
    })
    expect(deriveEngineAccountStatus({ all: [{ id: 'redrob', source: 'launcher' }] })).toEqual({
      connected: true,
      source: 'launcher'
    })
    expect(deriveEngineAccountStatus({ all: [{ id: 'redrob', key: 'rk_x' }] })).toEqual({
      connected: true,
      source: 'api'
    })
  })
})

describe('the engine connection', () => {
  test('is missing until the engine is signed in, then configured, with the launcher flagged as the source', async () => {
    expect(await modelConnectionCredentialStatus('connection-engine')).toBe('missing')
    expect(await modelConnectionKeySource('connection-engine')).toBeNull()
    providerList = { all: [{ id: 'redrob', source: 'launcher' }] }
    expect(await modelConnectionCredentialStatus('connection-engine')).toBe('configured')
    expect(await modelConnectionKeySource('connection-engine')).toBe('launcher')
    // Every read went to the daemon with its secret, never anywhere else.
    expect(
      calls.every(
        (call) => call.url.startsWith(DAEMON.url) && call.authorization?.startsWith('Basic ')
      )
    ).toBe(true)
  })

  test('a key is handed to the engine and never kept here; clearing removes it there', async () => {
    await setModelConnectionAPIKey('connection-engine', 'rk_live_secret')
    const put = calls.find((call) => call.method === 'PUT')
    expect(put?.url).toBe(`${DAEMON.url}/auth/redrob`)
    expect(put?.body).toBe(JSON.stringify({ type: 'api', key: 'rk_live_secret' }))
    // What the adapter authenticates with is the daemon's secret, not the Redrob key.
    expect(await resolveModelConnectionAPIKey('connection-engine')).toBe(DAEMON.secret)
    await setModelConnectionAPIKey('connection-engine', '')
    expect(
      calls.some((call) => call.method === 'DELETE' && call.url.endsWith('/auth/redrob'))
    ).toBe(true)
  })

  test('an ACP connection has no key of any kind', async () => {
    const settings = modelSettingsSnapshot()
    settings.connections.push({
      id: 'connection-acp',
      providerID: 'acp:redrob-code',
      customBaseURL: '',
      customAPIType: 'completions',
      credentialProfileId: 'connection-acp'
    })
    replaceAIModelSettings(settings)
    expect(await modelConnectionCredentialStatus('connection-acp')).toBe('missing')
    expect(await resolveModelConnectionAPIKey('connection-acp')).toBeNull()
  })
})
