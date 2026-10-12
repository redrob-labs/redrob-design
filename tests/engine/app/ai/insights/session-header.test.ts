import { describe, expect, test } from 'bun:test'

import { REDROB_CONSOLE_MODEL } from '@redrob-design/core/constants'
import type { AIProviderID } from '@redrob-design/core/constants'

import { modelProviderAdapter } from '@/app/ai/providers/registry'
import { redrobSessionHeaders, REDROB_SESSION_HEADER } from '@/app/ai/providers/session'
import type { ModelConfig } from '@/app/ai/providers/types'

async function headersSent(providerID: AIProviderID, sessionID: string | null) {
  let headers: Record<string, string> = {}
  const fetchSpy: typeof fetch = async (_input, init) => {
    headers = Object.fromEntries(new Headers(init?.headers).entries())
    throw new Error('stop')
  }
  const config: ModelConfig = {
    providerID,
    apiKey: 'test-key',
    modelID: providerID === 'redrob' ? REDROB_CONSOLE_MODEL : 'gpt-5',
    customModelID: '',
    customBaseURL: providerID === 'openai-compatible' ? 'https://llm.example/v1' : '',
    customAPIType: 'completions'
  }
  const model = modelProviderAdapter(providerID).create(config, {
    fetch: fetchSpy,
    sessionID: () => sessionID
  })
  await model
    .doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })
    .catch(() => undefined)
  return headers
}

describe('x-redrob-session', () => {
  test('is sent on Redrob requests while a session runs', async () => {
    const headers = await headersSent('redrob', 'dz_0123456789abcdef0123456789abcdef')
    expect(headers[REDROB_SESSION_HEADER]).toBe('dz_0123456789abcdef0123456789abcdef')
    expect(headers.authorization).toBe('Bearer test-key')
  })

  test('is absent without a session', async () => {
    expect(await headersSent('redrob', null)).not.toHaveProperty(REDROB_SESSION_HEADER)
  })

  test('is never sent to other providers', async () => {
    for (const provider of ['openai', 'openai-compatible', 'minimax', 'openrouter'] as const) {
      const headers = await headersSent(provider, 'dz_0123456789abcdef')
      expect(headers).not.toHaveProperty(REDROB_SESSION_HEADER)
    }
  })

  test('is sent only for ids in the agreed format', async () => {
    for (const bad of ['', 'a b', 'dz_\r\nx-evil: 1', 'é', 'x'.repeat(129), 'a/b']) {
      expect(redrobSessionHeaders('redrob', bad)).toEqual({})
      expect(await headersSent('redrob', bad)).not.toHaveProperty(REDROB_SESSION_HEADER)
    }
    for (const good of ['dz_abc', 'A.b:c-d_e', 'x'.repeat(128)]) {
      expect(redrobSessionHeaders('redrob', good)).toEqual({ [REDROB_SESSION_HEADER]: good })
    }
    expect(redrobSessionHeaders('openai', 'dz_abc')).toEqual({})
  })
})
