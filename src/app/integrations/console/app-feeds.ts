import { rankedPicks, rankingRates, rankingSource } from '@/app/ai/models/ranking/store'
import { modelRates } from '@/app/assistant/turn/pricing'

import {
  leaderboardFeedSchema,
  modelRatesFeedSchema,
  type LeaderboardFeed,
  type ModelRatesFeed
} from './contract/schemas'
import {
  appFeedDependencies,
  loadFeed,
  type FeedDefinition,
  type FeedDependencies,
  type FeedSource
} from './feeds'
import { consoleClient } from './session'

export const LEADERBOARD_FEED: FeedDefinition<'getLeaderboardFeed'> = {
  operationId: 'getLeaderboardFeed',
  key: 'feed:leaderboard',
  isValue: (value): value is LeaderboardFeed => leaderboardFeedSchema.safeParse(value).success,
  apply: (feed) => {
    rankedPicks.value = feed.picks
    rankingSource.value = { name: feed.name, edition: feed.edition, note: feed.note }
    rankingRates.value = feed.rates
  }
}

export const MODEL_RATES_FEED: FeedDefinition<'getModelRatesFeed'> = {
  operationId: 'getModelRatesFeed',
  key: 'feed:model-rates',
  isValue: (value): value is ModelRatesFeed => modelRatesFeedSchema.safeParse(value).success,
  apply: (feed) => {
    if (feed.rates.length > 0) modelRates.value = feed.rates
  }
}

type FeedSources = { leaderboard: FeedSource; modelRates: FeedSource }

let loading: Promise<FeedSources> | null = null
let retry: ReturnType<typeof setTimeout> | null = null
let retried = false

/** A feed that could not reach Console is tried once more after this long. */
export const FEED_RETRY_MS = 15_000

/**
 * Public feeds need no sign-in. They load once per session; a feed newer
 * than a day comes from the cache without asking Console. When Console
 * cannot be reached, the next call (or one retry shortly after) tries again
 * rather than keeping the fixture for the whole session.
 */
export function loadConsoleFeeds(
  dependencies: FeedDependencies = appFeedDependencies(consoleClient)
): Promise<FeedSources> {
  loading ??= Promise.all([
    loadFeed(LEADERBOARD_FEED, dependencies),
    loadFeed(MODEL_RATES_FEED, dependencies)
  ]).then(([leaderboard, rates]) => {
    const result = { leaderboard, modelRates: rates }
    const missed = [leaderboard, rates].some((source) => source === 'fixture' || source === 'stale')
    if (missed) {
      loading = null
      if (!retried) {
        retried = true
        retry = setTimeout(() => {
          retry = null
          void loadConsoleFeeds(dependencies)
        }, FEED_RETRY_MS)
      }
    }
    return result
  })
  return loading
}

export function resetConsoleFeedsForTests(): void {
  loading = null
  if (retry) clearTimeout(retry)
  retry = null
  retried = false
}
