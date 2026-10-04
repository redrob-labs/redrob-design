/**
 * The choices made per message in the composer bar (Plan or Run, the model,
 * its effort) and the two promises under it a person can tune (Memory and
 * Cross-check). Privacy is the admin's and is not stored here.
 */
export type AssistantMode = 'plan' | 'run'
export type MemoryScopeValue = 'project' | 'all' | 'none'
export type CrossCheckLevel = 'off' | 'auto' | 'always'

export interface CrossCheckChoice {
  factCheck: CrossCheckLevel
  challenge: CrossCheckLevel
}

export interface AssistantControls {
  mode: AssistantMode
  /** The pinned pick, or null for Redrob Auto. */
  pickId: string | null
  /** The effort set on the pinned pick, or null for the ranked one. */
  effort: number | null
  memory: MemoryScopeValue
  crossCheck: CrossCheckChoice
}

export const DEFAULT_ASSISTANT_CONTROLS: AssistantControls = {
  mode: 'plan',
  pickId: null,
  effort: null,
  memory: 'project',
  crossCheck: { factCheck: 'always', challenge: 'auto' }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function level(value: unknown, fallback: CrossCheckLevel): CrossCheckLevel {
  return value === 'off' || value === 'auto' || value === 'always' ? value : fallback
}

/** Reads stored controls, keeping only valid fields and filling the rest from defaults. */
export function normalizeAssistantControls(raw: unknown): AssistantControls {
  const defaults = DEFAULT_ASSISTANT_CONTROLS
  if (!isRecord(raw)) return structuredClone(defaults)
  const crossCheck = isRecord(raw.crossCheck) ? raw.crossCheck : {}
  return {
    mode: raw.mode === 'run' || raw.mode === 'plan' ? raw.mode : defaults.mode,
    pickId: typeof raw.pickId === 'string' ? raw.pickId : null,
    effort:
      typeof raw.effort === 'number' && Number.isInteger(raw.effort) && raw.effort > 0
        ? raw.effort
        : null,
    memory:
      raw.memory === 'project' || raw.memory === 'all' || raw.memory === 'none'
        ? raw.memory
        : defaults.memory,
    crossCheck: {
      factCheck: level(crossCheck.factCheck, defaults.crossCheck.factCheck),
      challenge: level(crossCheck.challenge, defaults.crossCheck.challenge)
    }
  }
}
