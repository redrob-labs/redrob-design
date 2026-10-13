import type { AIProviderID } from '@redrob-design/core/constants'

type JSONValue = null | boolean | number | string | JSONValue[] | { [key: string]: JSONValue }
export type AIProviderOptions = Record<string, { [key: string]: JSONValue }>

export function buildReasoningProviderOptions(
  providerID: AIProviderID,
  reasoningEffort: string
): AIProviderOptions | undefined {
  if (!reasoningEffort) return undefined
  // The engine's route is OpenAI-compatible, so the effort travels as OpenAI's `reasoning_effort`.
  if (providerID === 'engine') return { openai: { reasoningEffort } }
  return undefined
}
