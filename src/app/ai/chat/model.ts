import type { LanguageModel } from 'ai'

import { modelProviderAdapter } from '@/app/ai/providers/registry'
import type { ModelConfig } from '@/app/ai/providers/types'
import type { FetchFunction } from '@/app/http/types'
import { isTauri } from '@/app/tauri/env'
import { tauriFetch } from '@/app/tauri/http'

export type { ModelConfig } from '@/app/ai/providers/types'

export function resolveLanguageModelID(
  config: Pick<ModelConfig, 'providerID' | 'modelID' | 'customModelID'>
): string {
  // The engine lists models as `provider/model`; a custom id names one the list did not offer.
  if (config.providerID === 'engine') return config.customModelID.trim() || config.modelID
  return config.modelID
}

function desktopFetch(): FetchFunction | undefined {
  return isTauri() ? tauriFetch : undefined
}

export function createLanguageModel(config: ModelConfig): LanguageModel {
  return modelProviderAdapter(config.providerID).create(config, { fetch: desktopFetch() })
}
