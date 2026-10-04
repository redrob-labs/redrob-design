/**
 * The leaderboard's ranking, in the shapes the shared agent UI already
 * defines, so a ranked pick passes to the model picker unchanged.
 */
import type {
  Effort,
  EffortLevel,
  ModelPick,
  ModelRankingSource
} from '@/components/ui/agent/types'

export type RankedEffort = Effort
export type RankedEffortLevel = EffortLevel
/** One ranked combination of model, effort and harness. */
export type RankedPick = ModelPick
export type RankingSource = ModelRankingSource
