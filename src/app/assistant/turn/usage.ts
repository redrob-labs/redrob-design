import { priceTurn } from './pricing'

/** What one AI answer used and cost, kept with the thread so its receipt survives a reload. */
export interface TurnReceipt {
  provider: string
  model: string
  /** Effort the person set on a pinned model, in the maker's words; null under Redrob Auto. */
  effort: string | null
  /** True when the person pinned the model; false when Redrob Auto chose. */
  pinned: boolean
  inputTokens: number | null
  outputTokens: number | null
  steps: number
  /** US dollars, or null when the price is not known. */
  price: number | null
  /** Private details privacy protection kept from the AI in this turn. */
  keptPrivate: number
  /** The AI that ran Fact check on this answer, when one did. */
  factCheckBy: string | null
}

export interface TurnStep {
  provider: string
  model: string
  inputTokens: number | null
  outputTokens: number | null
}

function add(total: number | null, value: number | null): number | null {
  if (value === null) return total
  return (total ?? 0) + value
}

/**
 * Adds up the steps of one turn. A turn with several model calls (tool use)
 * is still one answer and gets one receipt.
 */
export function createTurnAccumulator() {
  let steps: TurnStep[] = []

  return {
    reset(): void {
      steps = []
    },
    addStep(step: TurnStep): void {
      steps.push(step)
    },
    get stepCount(): number {
      return steps.length
    },
    /** Builds the receipt and clears the turn. Null when no model step ran. */
    finish(options: { effort: string | null; pinned: boolean }): TurnReceipt | null {
      if (steps.length === 0) return null
      const last = steps[steps.length - 1]
      let inputTokens: number | null = null
      let outputTokens: number | null = null
      for (const step of steps) {
        inputTokens = add(inputTokens, step.inputTokens)
        outputTokens = add(outputTokens, step.outputTokens)
      }
      const receipt: TurnReceipt = {
        provider: last.provider,
        model: last.model,
        effort: options.effort,
        pinned: options.pinned,
        inputTokens,
        outputTokens,
        steps: steps.length,
        price: priceTurn(last.model, inputTokens, outputTokens),
        keptPrivate: 0,
        factCheckBy: null
      }
      steps = []
      return receipt
    }
  }
}

export type TurnAccumulator = ReturnType<typeof createTurnAccumulator>
