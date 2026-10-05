/**
 * Which AI company a model comes from, so Cross-check can say when the
 * checker is not from "another company" as the composer promises. Null when
 * the provider hides it (custom OpenAI- or Anthropic-compatible endpoints).
 */
const BY_PROVIDER: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  google: 'google',
  deepseek: 'deepseek',
  zai: 'zhipu',
  minimax: 'minimax',
  'acp:claude-code': 'anthropic',
  'acp:codex': 'openai',
  'acp:gemini-cli': 'google'
}

/** Model id prefixes OpenRouter and Redrob use: `anthropic/claude-…`. */
const BY_PREFIX: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  google: 'google',
  'meta-llama': 'meta',
  mistralai: 'mistral',
  deepseek: 'deepseek',
  'x-ai': 'xai',
  qwen: 'alibaba',
  'z-ai': 'zhipu',
  minimax: 'minimax'
}

function byModelName(model: string): string | null {
  const name = model.toLowerCase()
  if (name.startsWith('claude')) return 'anthropic'
  if (name.startsWith('gpt') || /^o\d/.test(name)) return 'openai'
  if (name.startsWith('gemini')) return 'google'
  if (name.startsWith('deepseek')) return 'deepseek'
  return null
}

export function companyOf(providerID: string, modelID: string): string | null {
  const direct = BY_PROVIDER[providerID]
  if (direct) return direct
  const slash = modelID.indexOf('/')
  if (slash > 0) {
    const prefix = BY_PREFIX[modelID.slice(0, slash).toLowerCase()]
    if (prefix) return prefix
  }
  return byModelName(slash > 0 ? modelID.slice(slash + 1) : modelID)
}

/** True only when both companies are known and match. */
export function sameCompany(
  a: { provider: string; model: string },
  b: { provider: string; model: string }
): boolean {
  const left = companyOf(a.provider, a.model)
  const right = companyOf(b.provider, b.model)
  return left !== null && left === right
}
