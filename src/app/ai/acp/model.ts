/** Canonical Redrob Code model for Design ACP sessions. */
export const REDROB_CODE_DEFAULT_MODEL = 'redrob/auto'

const REDROB_CODE_MODEL_ALIASES = new Set([
  '',
  'auto',
  'design',
  'design.genie',
  'genie',
  'redrob',
  'redrob-ai',
  'redrob/auto'
])

/**
 * Map Design UI / legacy model ids onto a Redrob Code provider/model selection.
 * Empty ACP profiles and Design-only aliases become `redrob/auto`.
 */
export function normalizeRedrobCodeModelId(modelId: string | null | undefined): string {
  const trimmed = modelId?.trim() ?? ''
  if (!trimmed) return REDROB_CODE_DEFAULT_MODEL

  const lower = trimmed.toLowerCase()
  if (REDROB_CODE_MODEL_ALIASES.has(lower)) return REDROB_CODE_DEFAULT_MODEL

  if (trimmed.includes('/')) return trimmed
  return `redrob/${trimmed}`
}
