import { shallowRef } from 'vue'

import { DESIGN_SCREENS_RANKING, RANKING_RATES, RANKING_SOURCE } from './fixture'
import type { RankedPick, RankingSource } from './types'

/**
 * The ranking in use: the prototype's sample until the Redrob Leaderboard
 * feed arrives, then the feed's picks and edition.
 */
export const rankedPicks = shallowRef<readonly RankedPick[]>(DESIGN_SCREENS_RANKING)
export const rankingSource = shallowRef<RankingSource>(RANKING_SOURCE)
/** Units of each currency per US dollar, supplied with the ranking. */
export const rankingRates = shallowRef<Readonly<Record<string, number>>>(RANKING_RATES)

export function rankedPick(id: string | null): RankedPick | null {
  if (!id) return null
  return rankedPicks.value.find((pick) => pick.id === id) ?? null
}
