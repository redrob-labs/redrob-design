import type { LanguageModel } from 'ai'

import type { AIProviderID } from '@redrob-design/core/constants'

import type { SessionIDSource } from '@/app/ai/providers/session'
import type { FetchFunction } from '@/app/http/types'

export type ModelConfig = {
  providerID: AIProviderID
  apiKey: string
  modelID: string
  customModelID: string
  customBaseURL: string
  customAPIType: 'completions' | 'responses'
}

export type ModelProviderRuntime = {
  fetch?: FetchFunction
  /** The AI work-insights session of the chat, read per request. Only the Redrob adapter uses it. */
  sessionID?: SessionIDSource
}

export interface ModelProviderAdapter {
  create(config: ModelConfig, runtime: ModelProviderRuntime): LanguageModel
}
