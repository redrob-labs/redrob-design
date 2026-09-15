import { describe, expect, test } from 'bun:test'

import { AI_PROVIDERS, REDROB_CONSOLE_API_BASE, REDROB_CONSOLE_MODEL } from '@redrob-design/core/constants'

import { resolveLanguageModelID } from '@/app/ai/chat/model'
import { normalizeOpenRouterModel } from '@/app/ai/chat/provider-models'
import { createAnthropicCompatibleAdapter } from '@/app/ai/providers/compatible'
import { modelProviderAdapter } from '@/app/ai/providers/registry'
import type { ModelConfig } from '@/app/ai/providers/types'

describe('resolveLanguageModelID', () => {
  test('uses the selected OpenRouter model when no custom model is configured', () => {
    expect(
      resolveLanguageModelID({
        providerID: 'openrouter',
        modelID: 'anthropic/claude-sonnet-4.6',
        customModelID: ''
      })
    ).toBe('anthropic/claude-sonnet-4.6')
  })

  test('uses a custom OpenRouter model ID when provided', () => {
    expect(
      resolveLanguageModelID({
        providerID: 'openrouter',
        modelID: 'anthropic/claude-sonnet-4.6',
        customModelID: '  meta-llama/llama-3.3-70b-instruct  '
      })
    ).toBe('meta-llama/llama-3.3-70b-instruct')
  })
})

describe('model provider registry', () => {
  async function captureRedrobRequest(
    customBaseURL: string
  ): Promise<{ url: string; body: string; headers: Record<string, string> }> {
    let url = ''
    let body = ''
    let headers: Record<string, string> = {}
    const fetchSpy: typeof fetch = async (input, init) => {
      url = String(input)
      body = String(init?.body)
      headers = Object.fromEntries(new Headers(init?.headers).entries())
      throw new Error('stop')
    }
    const config: ModelConfig = {
      providerID: 'redrob',
      apiKey: 'rrk_test_secret',
      modelID: REDROB_CONSOLE_MODEL,
      customModelID: '',
      customBaseURL,
      customAPIType: 'completions'
    }

    const model = modelProviderAdapter('redrob').create(config, { fetch: fetchSpy })
    await model
      .doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })
      .catch(() => undefined)

    return { url, body, headers }
  }

  test('offers MiniMax-M3 as the default MiniMax model', () => {
    const provider = AI_PROVIDERS.find(({ id }) => id === 'minimax')
    expect(provider?.defaultModel).toBe('MiniMax-M3')
    expect(provider?.models[0]).toMatchObject({ id: 'MiniMax-M3' })
  })

  test('sends MiniMax-M3 through the OpenAI-compatible chat endpoint', async () => {
    let requestURL = ''
    let requestBody = ''
    const fetchSpy: typeof fetch = async (input, init) => {
      requestURL = String(input)
      requestBody = String(init?.body)
      throw new Error('stop')
    }
    const config: ModelConfig = {
      providerID: 'minimax',
      apiKey: 'test-key',
      modelID: 'MiniMax-M3',
      customModelID: '',
      customBaseURL: '',
      customAPIType: 'completions'
    }

    const model = modelProviderAdapter('minimax').create(config, { fetch: fetchSpy })
    await model
      .doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })
      .catch(() => undefined)

    expect(requestURL).toBe('https://api.minimax.io/v1/chat/completions')
    expect(requestBody).toContain('"model":"MiniMax-M3"')
  })

  test('offers Console auto as the only Redrob model', () => {
    const provider = AI_PROVIDERS.find(({ id }) => id === 'redrob')
    expect(provider?.defaultModel).toBe(REDROB_CONSOLE_MODEL)
    expect(provider?.models).toEqual([
      { id: REDROB_CONSOLE_MODEL, name: 'Redrob Auto', capabilities: ['tools'] }
    ])
  })

  test('sends Redrob requests to Console chat/completions with the workspace key', async () => {
    const { url, body, headers } = await captureRedrobRequest('')
    expect(url).toBe(`${REDROB_CONSOLE_API_BASE}/chat/completions`)
    expect(body).toContain(`"model":"${REDROB_CONSOLE_MODEL}"`)
    expect(headers).toHaveProperty('authorization', 'Bearer rrk_test_secret')
  })

  test('a key minted for a self-hosted Console keeps its own base URL', async () => {
    const { url } = await captureRedrobRequest('https://console.example.com/api/backend/v1')
    expect(url).toBe('https://console.example.com/api/backend/v1/chat/completions')
  })

  test('registers every direct provider without handling agent runtimes as models', () => {    for (const provider of AI_PROVIDERS.filter((entry) => entry.id !== 'harness:pi')) {
      expect(modelProviderAdapter(provider.id).create).toBeFunction()
    }
    expect(() => modelProviderAdapter('harness:pi')).toThrow('Harness agents')
    expect(() => modelProviderAdapter('acp:claude-code')).toThrow(
      'ACP providers and Harness agents do not use direct API models'
    )
  })
})

describe('anthropic compatible adapter', () => {
  const config: ModelConfig = {
    providerID: 'anthropic',
    apiKey: 'test-key',
    modelID: 'claude-sonnet-4.6',
    customModelID: '',
    customBaseURL: '',
    customAPIType: 'completions'
  }

  async function capturedHeaders(): Promise<Record<string, string>> {
    let captured: Record<string, string> = {}
    const fetchSpy: typeof fetch = async (_input, init) => {
      captured = Object.fromEntries(new Headers(init?.headers).entries())
      throw new Error('stop')
    }

    const model = createAnthropicCompatibleAdapter().create(config, { fetch: fetchSpy })
    await model
      .doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })
      .catch(() => undefined)

    return captured
  }

  test('opts into direct browser access so Anthropic returns CORS headers', async () => {
    // Anthropic omits Access-Control-Allow-Origin unless this header is sent, which makes the
    // web build fail with an opaque network error. See #436.
    expect(await capturedHeaders()).toHaveProperty(
      'anthropic-dangerous-direct-browser-access',
      'true'
    )
  })
})

describe('normalizeOpenRouterModel', () => {
  test('keeps tool-capable OpenRouter models', () => {
    expect(
      normalizeOpenRouterModel({
        id: 'meta-llama/llama-3.3-70b-instruct',
        name: 'Llama 3.3 70B Instruct',
        supported_parameters: ['tools'],
        architecture: { input_modalities: ['text', 'image'] },
        top_provider: { max_completion_tokens: 32_768 }
      })
    ).toEqual({
      id: 'meta-llama/llama-3.3-70b-instruct',
      name: 'Llama 3.3 70B Instruct',
      capabilities: ['tools', 'vision'],
      recommendedMaxOutputTokens: 32_768
    })
  })

  test('skips OpenRouter models without tool support', () => {
    expect(
      normalizeOpenRouterModel({
        id: 'text-only/model',
        name: 'Text Only',
        supported_parameters: []
      })
    ).toBeNull()
  })
})
