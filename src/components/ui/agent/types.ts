/**
 * Props contracts for the agent surfaces, after the Redrob Group Design System
 * 2026 `index.d.ts`. React node props become slots in the Vue components.
 */

/** Effort in the maker's own words and scale. */
export interface Effort {
  label: string
  level: number
  of: number
}

export interface EffortLevel extends Effort {
  /** A month of the task at this level, in USD. */
  monthly?: number
  place?: number
}

/** One ranked combination: a model, how hard it thinks, and where it runs. */
export interface ModelPick {
  id: string
  /** Full model name, e.g. "Claude Opus 5.5". */
  model: string
  /** Shorter name for the composer trigger, e.g. "Opus 5.5". */
  short?: string
  /** Where the model runs, e.g. "Redrob Design". */
  harness: string
  effort: Effort
  efforts?: EffortLevel[]
  why?: string
  monthly?: number
}

export interface ModelTask {
  id: string
  label: string
  title?: string
  usage?: string
  picks: ModelPick[]
}

export interface ModelProfession {
  id: string
  label: string
  disabled?: boolean
  tasks?: ModelTask[]
}

export interface ModelRankingSource {
  name: string
  edition?: string
  note?: string
}

export type ComposerModeValue = 'plan' | 'run'

export interface ComposerModeOption {
  value: ComposerModeValue
  label: string
  hint?: string
}

export type ComposerStatusTone = 'safe' | 'on' | 'warn' | 'plain'

export interface ComposerStatusItem {
  id: string
  tone?: ComposerStatusTone
  /** "Privacy", "Memory", "Cross-check". */
  name: string
  /** "High", "On for every AI", "When it matters". */
  value: string
  level?: { n: number; of: number }
  /** Shows a running light with this text, e.g. "Running on this computer". */
  live?: string
  panelLabel?: string
}

export interface MemoryScopeOption {
  value: string
  label: string
  detail?: string
  summary?: string
  off?: boolean
}

export type CrossCheckLevel = 'off' | 'auto' | 'always'
export type CrossCheckValue = Record<string, CrossCheckLevel>

export interface CrossCheckDefinition {
  id: string
  name: string
  text: string
}

export interface CrossCheckLevelOption {
  value: CrossCheckLevel
  label: string
}

export interface PrivacyLevel {
  id: string
  label: string
  n: number
  detail: string
}

export type ProtectionTone = 'safe' | 'warn' | 'brand' | 'plain'

export interface PromptSuggestion {
  label: string
  /** What goes in the field; defaults to the label. */
  value?: string
}

export type AnswerReceiptIcon = 'auto' | 'pin' | 'price' | 'privacy' | 'check' | 'memory'

export interface AnswerReceiptItem {
  id: string
  icon?: AnswerReceiptIcon
  tone?: 'plain' | 'agree' | 'differ'
  label: string
  sub?: string
}

export type AgentStepState = 'done' | 'active' | 'todo' | 'error'

export interface AgentStep {
  id: string
  label: string
  state: AgentStepState
}
