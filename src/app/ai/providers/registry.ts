import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'

import { REDROB_CONSOLE_API_BASE } from '@redrob-design/core/constants'
import type { AIProviderID } from '@redrob-design/core/constants'

import {
  createAnthropicCompatibleAdapter,
  createOpenAICompatibleAdapter
} from '@/app/ai/providers/compatible'
import type { ModelProviderAdapter } from '@/app/ai/providers/types'

type DirectProviderID = Exclude<AIProviderID, `acp:${string}` | `harness:${string}`>

const MODEL_PROVIDER_ADAPTERS = {
  // Console is OpenAI-compatible on chat/completions. A key issued for a self-hosted
  // Console arrives with its own base URL, so an explicit one wins over the default.
  redrob: createOpenAICompatibleAdapter({
    baseURL: (config) => config.customBaseURL.trim() || REDROB_CONSOLE_API_BASE,
    mode: 'chat'
  }),
  openrouter: {
    create(config, runtime) {
      const provider = createOpenRouter({
        apiKey: config.apiKey,
        fetch: runtime.fetch,
        headers: {
          'X-OpenRouter-Title': 'Redrob Design',
          'HTTP-Referer': 'https://redrob.design'
        }
      })
      return provider(config.customModelID.trim() || config.modelID)
    }
  },
  anthropic: createAnthropicCompatibleAdapter(),
  openai: createOpenAICompatibleAdapter(),
  google: {
    create(config, runtime) {
      return createGoogleGenerativeAI({ apiKey: config.apiKey, fetch: runtime.fetch })(
        config.modelID
      )
    }
  },
  deepseek: {
    create(config, runtime) {
      return createDeepSeek({ apiKey: config.apiKey, fetch: runtime.fetch })(config.modelID)
    }
  },
  zai: createAnthropicCompatibleAdapter({ baseURL: 'https://api.z.ai/api/anthropic' }),
  minimax: createOpenAICompatibleAdapter({ baseURL: 'https://api.minimax.io/v1', mode: 'chat' }),
  'openai-compatible': createOpenAICompatibleAdapter({
    baseURL: (config) => config.customBaseURL,
    mode: 'configurable'
  }),
  'anthropic-compatible': createAnthropicCompatibleAdapter({
    baseURL: (config) => config.customBaseURL
  })
} satisfies Record<DirectProviderID, ModelProviderAdapter>

function isDirectProviderID(providerID: AIProviderID): providerID is DirectProviderID {
  return !providerID.startsWith('acp:') && providerID !== 'harness:pi'
}

export function modelProviderAdapter(providerID: AIProviderID): ModelProviderAdapter {
  if (!isDirectProviderID(providerID)) {
    throw new Error('ACP providers and Harness agents do not use direct API models')
  }
  return MODEL_PROVIDER_ADAPTERS[providerID]
}
