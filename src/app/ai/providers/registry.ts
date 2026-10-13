import { createOpenAI } from '@ai-sdk/openai'

import type { AIProviderID } from '@redrob-design/core/constants'

import type { ModelProviderAdapter } from '@/app/ai/providers/types'

/**
 * The one model adapter: the shared Redrob Code daemon's OpenAI-compatible route. `apiKey` carries
 * the daemon's secret as the Basic password and `customBaseURL` the daemon's `/v1` base, both
 * resolved at request time by `createAIModelRuntime` (engine/daemon.ts). The engine picks the real
 * provider behind the model id and masks personal details before anything leaves this machine.
 */
const ENGINE_ADAPTER: ModelProviderAdapter = {
  create(config, runtime) {
    const provider = createOpenAI({
      apiKey: 'redrob-code',
      baseURL: config.customBaseURL,
      headers: { Authorization: `Basic ${btoa(`redrob:${config.apiKey}`)}` },
      fetch: runtime.fetch
    })
    return provider.chat(config.customModelID.trim() || config.modelID)
  }
}

export function modelProviderAdapter(providerID: AIProviderID): ModelProviderAdapter {
  if (providerID !== 'engine') {
    throw new Error('ACP agents do not use direct API models')
  }
  return ENGINE_ADAPTER
}
