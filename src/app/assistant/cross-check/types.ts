import { z } from 'zod'

export const FACT_VERDICTS = ['supported', 'unsupported', 'unclear'] as const
export type FactVerdict = (typeof FACT_VERDICTS)[number]

export const factFindingSchema = z.object({
  claim: z.string().min(1).max(400),
  verdict: z.enum(FACT_VERDICTS),
  where: z.string().max(200).default('')
})
export type FactFinding = z.infer<typeof factFindingSchema>

export const factCheckReplySchema = z.object({
  findings: z.array(factFindingSchema).max(12)
})

export interface ChallengeResult {
  rounds: Array<{ objection: string; response: string }>
  heldUp: string
}

/**
 * What Cross-check posts under an answer, as a `data-cross-check` part. The
 * model never sees it; it is the record of who checked the work and how.
 */
export interface CrossCheckData {
  answerId: string
  /** `no-model` is never posted; the composer status shows it instead. */
  status: 'done' | 'no-model' | 'failed'
  /** The model that ran the checks, as its id. */
  by: string | null
  /** The checker comes from the same company as the model that drew. */
  sameCompany: boolean
  factCheck: FactFinding[] | null
  challenge: ChallengeResult | null
  error: string | null
}

export function isCrossCheckData(value: unknown): value is CrossCheckData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'answerId' in value &&
    typeof value.answerId === 'string' &&
    'status' in value &&
    (value.status === 'done' || value.status === 'no-model' || value.status === 'failed')
  )
}
