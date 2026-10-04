/**
 * The model picker's sample ranking for a designer, from the approved
 * prototype (`reference/prototype/src/data.js`). Sample figures until the
 * Redrob Leaderboard publishes a feed; replace this module, not its callers.
 */
import type { RankedPick, RankingSource, RankedEffortLevel } from './types'

/** The harness this app is, for greying out picks that run elsewhere. */
export const RANKING_HERE = 'Redrob Design'

export const RANKING_SOURCE: RankingSource = {
  name: 'Redrob Leaderboard',
  edition: 'September 2026',
  note: 'Updated monthly'
}

/** Units of each currency per US dollar, supplied with the ranking. */
export const RANKING_RATES: Readonly<Record<string, number>> = { KRW: 1387.97, INR: 95.87 }

const CLAUDE_LEVELS = ['Low', 'Medium', 'High', 'Extra high', 'Max']
const CLAUDE_COST = [0.45, 0.7, 1, 1.5, 2.5]
const GPT_LEVELS = ['Instant', 'Medium', 'High', 'Extra High', 'Pro']
const GPT_COST = [0.3, 0.7, 1, 1.5, 4]
const GEMINI_LEVELS = ['Low', 'Medium', 'High']
const GEMINI_COST = [0.6, 1, 1.6]

function efforts(
  labels: readonly string[],
  cost: readonly number[],
  ranked: number,
  monthly: number,
  harness: string
): RankedEffortLevel[] {
  return labels
    .map((label, index) => ({
      label,
      level: index + 1,
      of: labels.length,
      monthly: Math.round(((monthly * cost[index]) / cost[ranked - 1]) * 100) / 100
    }))
    .filter((level) => !(level.label === 'Pro' && !harness.startsWith('ChatGPT')))
}

function pick(
  id: string,
  model: string,
  short: string,
  harness: string,
  ranked: number,
  levels: readonly string[],
  cost: readonly number[],
  monthly: number,
  why: string
): RankedPick {
  return {
    id,
    model,
    short,
    harness,
    effort: { label: levels[ranked - 1], level: ranked, of: levels.length },
    efforts: efforts(levels, cost, ranked, monthly, harness),
    why,
    monthly
  }
}

/** Top five for a designer designing screens and layouts. */
export const DESIGN_SCREENS_RANKING: readonly RankedPick[] = [
  pick(
    'screens-1',
    'Claude Opus 5.5',
    'Opus 5.5',
    'Redrob Design',
    3,
    CLAUDE_LEVELS,
    CLAUDE_COST,
    24,
    'Builds real layers on the canvas from your Design System, with auto layout and tokens, not a picture.'
  ),
  pick(
    'screens-2',
    'Gemini 3.1 Pro',
    'Gemini 3.1 Pro',
    'Redrob Design',
    3,
    GEMINI_LEVELS,
    GEMINI_COST,
    14.4,
    'Strong on reading a screenshot or sketch and rebuilding it, at a lower price.'
  ),
  pick(
    'screens-3',
    'GPT-6 Astra',
    'GPT-6 Astra',
    'ChatGPT Work',
    3,
    GPT_LEVELS,
    GPT_COST,
    36,
    'A good first idea in many directions. Returns images and code, not editable layers.'
  ),
  pick(
    'screens-4',
    'Claude Sonnet 5',
    'Sonnet 5',
    'Redrob Design',
    2,
    CLAUDE_LEVELS,
    CLAUDE_COST,
    9.6,
    'Fast edits to what is already on the canvas, at under half the price of Opus 5.5.'
  ),
  pick(
    'screens-5',
    'Claude Fable 5.1',
    'Fable 5.1',
    'Claude Design',
    3,
    CLAUDE_LEVELS,
    CLAUDE_COST,
    60,
    "Anthropic's largest model. Slightly stronger on a new visual direction, at over twice the price."
  )
]
