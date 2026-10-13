import { describe, expect, test } from 'bun:test'

import { AI_PROVIDERS, ENGINE_AUTO_MODEL } from '@redrob-design/core/constants'

import { resolveLanguageModelID } from '@/app/ai/chat/model'
import { normalizeEngineModel } from '@/app/ai/chat/provider-models'
import { modelProviderAdapter } from '@/app/ai/providers/registry'
import type { ModelConfig } from '@/app/ai/providers/types'

describe('resolveLanguageModelID', () => {
  test('uses the selected engine model when no custom model is configured', () => {
    expect(
      resolveLanguageModelID({
        providerID: 'engine',
        modelID: 'anthropic/claude-sonnet-4.6',
        customModelID: ''
      })
    ).toBe('anthropic/claude-sonnet-4.6')
  })

  test('uses a custom model ID when provided, trimmed', () => {
    expect(
      resolveLanguageModelID({
        providerID: 'engine',
        modelID: 'anthropic/claude-sonnet-4.6',
        customModelID: '  ollama/llama3.3  '
      })
    ).toBe('ollama/llama3.3')
  })
})

describe('model provider registry', () => {
  /**
   * What `createAIModelRuntime` hands the adapter: the daemon's secret as `apiKey` and its `/v1`
   * base as `customBaseURL` (models/runtime.ts). No Console key is anywhere in this request.
   */
  async function captureEngineRequest(
    customModelID = ''
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
      providerID: 'engine',
      apiKey: 's3cret',
      modelID: ENGINE_AUTO_MODEL,
      customModelID,
      customBaseURL: 'http://127.0.0.1:4096/v1',
      customAPIType: 'completions'
    }

    const model = modelProviderAdapter('engine').create(config, { fetch: fetchSpy })
    await model
      .doGenerate({ prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }] })
      .catch(() => undefined)

    return { url, body, headers }
  }

  test('offers Redrob Auto as the engine model shown before the engine lists its own', () => {
    expect(AI_PROVIDERS.map((provider) => provider.id)).toEqual(['engine'])
    const provider = AI_PROVIDERS[0]
    expect(provider?.defaultModel).toBe(ENGINE_AUTO_MODEL)
    expect(provider?.models).toEqual([
      { id: ENGINE_AUTO_MODEL, name: 'Redrob Auto', capabilities: ['tools', 'vision'] }
    ])
    expect(provider?.supportsCustomModel).toBe(true)
  })

  test("sends requests to the shared daemon's chat/completions with its Basic secret", async () => {
    const { url, body, headers } = await captureEngineRequest()
    expect(url).toBe('http://127.0.0.1:4096/v1/chat/completions')
    expect(body).toContain(`"model":"${ENGINE_AUTO_MODEL}"`)
    expect(headers.authorization).toBe(`Basic ${btoa('redrob:s3cret')}`)
  })

  test('a custom model id names a model the list did not offer', async () => {
    const { body } = await captureEngineRequest('ollama/llama3.3')
    expect(body).toContain('"model":"ollama/llama3.3"')
  })

  test('the ACP agent is not a model', () => {
    expect(() => modelProviderAdapter('acp:redrob-code')).toThrow(
      'ACP agents do not use direct API models'
    )
  })
})

describe('normalizeEngineModel', () => {
  test("reads the engine's model list into provider/model ids with capabilities", () => {
    expect(
      normalizeEngineModel({
        id: 'claude-sonnet-4-6',
        providerID: 'anthropic',
        name: 'Claude Sonnet 4.6',
        enabled: true,
        capabilities: { tools: true, input: ['text', 'image'] }
      })
    ).toEqual({
      id: 'anthropic/claude-sonnet-4-6',
      name: 'Claude Sonnet 4.6 (anthropic)',
      capabilities: ['tools', 'vision']
    })
  })

  test('names Redrob Auto, and skips disabled or malformed entries', () => {
    expect(
      normalizeEngineModel({
        id: 'auto',
        providerID: 'redrob',
        capabilities: { tools: true, input: [] }
      })
    ).toEqual({
      id: ENGINE_AUTO_MODEL,
      name: 'Redrob Auto',
      capabilities: ['tools']
    })
    expect(normalizeEngineModel({ id: 'x', providerID: 'p', enabled: false })).toBeNull()
    expect(normalizeEngineModel({ id: 'x' })).toBeNull()
  })
})
