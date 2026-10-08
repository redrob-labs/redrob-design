import type { LanguageModel } from 'ai'

import type { AIModelRuntime } from '@/app/ai/models'
import type { CrossCheckLevel } from '@/app/assistant/controls/model'

import { sameCompany } from './company'
import {
  NO_OBJECTION,
  factCheckPrompt,
  objectionPrompt,
  responsePrompt,
  verdictPrompt,
  type ChallengeRound,
  type CheckMaterial
} from './prompts'
import { factCheckReplySchema, type CrossCheckData, type FactFinding } from './types'

/** Challenge argues for at most this many rounds before the verdict. */
export const MAX_CHALLENGE_ROUNDS = 3
const FACT_CHECK_TOKENS = 1200
const DEBATE_TOKENS = 300

/** The Review model, as much of it as Cross-check needs. */
export interface ReviewRuntime {
  model: LanguageModel
  providerID: string
  modelID: string
}

/** The assigned Review model when it is a direct model; local agents cannot review. */
export function reviewRuntimeOf(runtime: AIModelRuntime | null): ReviewRuntime | null {
  if (runtime?.kind !== 'direct') return null
  const { profile, connection } = runtime.role
  return {
    model: runtime.model,
    providerID: connection.providerID,
    modelID: profile.customModelID || profile.modelID
  }
}

export interface CrossCheckDependencies {
  createRuntime: () => Promise<ReviewRuntime | null>
  generate: (options: {
    model: LanguageModel
    prompt: string
    maxOutputTokens?: number
  }) => Promise<{ text: string }>
}

/**
 * When a check runs: `auto` when the answer changed the page, `always` on
 * every answer, `off` never.
 */
export function shouldRun(level: CrossCheckLevel, changedPage: boolean): boolean {
  if (level === 'always') return true
  if (level === 'auto') return changedPage
  return false
}

/** Reads the JSON a reviewer returned, tolerating a fenced block around it. */
export function parseFactCheck(text: string): FactFinding[] | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const parsed = factCheckReplySchema.safeParse(JSON.parse(text.slice(start, end + 1)))
    return parsed.success ? parsed.data.findings : null
  } catch {
    return null
  }
}

function isNoObjection(text: string): boolean {
  return text.trim().replace(/[.!]$/, '').toUpperCase() === NO_OBJECTION
}

export interface CrossCheckRequest {
  answerId: string
  material: CheckMaterial
  factCheck: boolean
  challenge: boolean
  /** The model that drew, to tell whether the checker is from another company. */
  drewWith: { provider: string; model: string }
}

export async function runCrossCheck(
  request: CrossCheckRequest,
  dependencies: CrossCheckDependencies
): Promise<CrossCheckData> {
  const base: CrossCheckData = {
    answerId: request.answerId,
    status: 'done',
    by: null,
    sameCompany: false,
    factCheck: null,
    challenge: null,
    error: null
  }
  let runtime: ReviewRuntime | null
  try {
    runtime = await dependencies.createRuntime()
  } catch (error) {
    return { ...base, status: 'failed', error: errorText(error) }
  }
  if (!runtime) return { ...base, status: 'no-model' }
  const { model, modelID: by } = runtime
  const result: CrossCheckData = {
    ...base,
    by,
    sameCompany: sameCompany(request.drewWith, { provider: runtime.providerID, model: by })
  }
  const ask = async (prompt: string, maxOutputTokens: number) =>
    (await dependencies.generate({ model, prompt, maxOutputTokens })).text.trim()

  try {
    if (request.factCheck) {
      const reply = await ask(factCheckPrompt(request.material), FACT_CHECK_TOKENS)
      const findings = parseFactCheck(reply)
      if (!findings) throw new Error('The Review model did not return a readable check.')
      result.factCheck = findings
    }
    if (request.challenge) {
      const rounds: ChallengeRound[] = []
      while (rounds.length < MAX_CHALLENGE_ROUNDS) {
        const objection = await ask(objectionPrompt(request.material, rounds), DEBATE_TOKENS)
        if (!objection || isNoObjection(objection)) break
        const response = await ask(
          responsePrompt(request.material, rounds, objection),
          DEBATE_TOKENS
        )
        rounds.push({ objection, response })
      }
      const heldUp =
        rounds.length > 0 ? await ask(verdictPrompt(request.material, rounds), DEBATE_TOKENS) : ''
      result.challenge = { rounds, heldUp }
    }
  } catch (error) {
    return { ...result, status: 'failed', error: errorText(error) }
  }
  return result
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
