/**
 * List prices per million tokens, in US dollars, for the models Redrob Design
 * most often runs, so a receipt can say what an answer cost. Matched by model
 * id substring, most specific first. A model that is not listed has no price
 * and its receipt says so rather than guessing.
 *
 * Source: each maker's published API price list at the time of writing.
 * Replace with the Redrob Leaderboard's price feed when it publishes one.
 */
export interface ModelRate {
  match: string
  inputPerMillion: number
  outputPerMillion: number
}

export const MODEL_RATES: readonly ModelRate[] = [
  { match: 'opus', inputPerMillion: 15, outputPerMillion: 75 },
  { match: 'sonnet', inputPerMillion: 3, outputPerMillion: 15 },
  { match: 'haiku', inputPerMillion: 0.8, outputPerMillion: 4 },
  { match: 'gpt-4o-mini', inputPerMillion: 0.15, outputPerMillion: 0.6 },
  { match: 'gpt-4o', inputPerMillion: 2.5, outputPerMillion: 10 },
  { match: 'gemini-2.5-pro', inputPerMillion: 1.25, outputPerMillion: 10 },
  { match: 'gemini-2.5-flash', inputPerMillion: 0.3, outputPerMillion: 2.5 },
  { match: 'deepseek', inputPerMillion: 0.27, outputPerMillion: 1.1 }
]

export function rateForModel(model: string): ModelRate | null {
  const id = model.toLowerCase()
  return MODEL_RATES.find((rate) => id.includes(rate.match)) ?? null
}

/** The dollar cost of a turn, or null when the model or token counts are unknown. */
export function priceTurn(
  model: string,
  inputTokens: number | null,
  outputTokens: number | null
): number | null {
  const rate = rateForModel(model)
  if (!rate || inputTokens === null || outputTokens === null) return null
  return (inputTokens * rate.inputPerMillion + outputTokens * rate.outputPerMillion) / 1_000_000
}
