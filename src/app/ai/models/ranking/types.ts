/** One ranked combination of model, effort and harness, as the leaderboard reports it. */
export interface RankedEffort {
  label: string
  level: number
  of: number
}

export interface RankedEffortLevel extends RankedEffort {
  /** A month of the task at this level, in USD. */
  monthly?: number
}

export interface RankedPick {
  id: string
  model: string
  short?: string
  harness: string
  effort: RankedEffort
  efforts?: RankedEffortLevel[]
  why?: string
  monthly?: number
}

export interface RankingSource {
  name: string
  edition?: string
  note?: string
}
