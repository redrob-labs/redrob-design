import { consoleCache, type SnapshotCache } from './cache'
import type { ConsoleClient, ConsoleData } from './client'
import type { ConsoleOperationId } from './contract/routes'

/** A feed is fetched at most this often; the cache answers in between and offline. */
export const FEED_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** `stale` is a cached copy older than a day that Console could not refresh. */
export type FeedSource = 'fixture' | 'cache' | 'stale' | 'console'

export interface FeedDependencies {
  client: () => ConsoleClient
  cache: () => SnapshotCache
  now: () => number
}

export interface FeedDefinition<Op extends ConsoleOperationId> {
  operationId: Op
  /** Cache key; one snapshot per feed. */
  key: string
  /** Checks a cached value, which may predate a schema change. */
  isValue: (value: unknown) => value is ConsoleData<Op>
  /** Puts a feed value to use. */
  apply: (value: ConsoleData<Op>, source: FeedSource) => void
}

/**
 * Loads one public feed: the cached copy first, then Console when the copy
 * is missing or older than a day. Any failure leaves what is already in use,
 * which starts as the fixture, so the picker and receipts never go blank.
 */
export async function loadFeed<Op extends ConsoleOperationId>(
  feed: FeedDefinition<Op>,
  dependencies: FeedDependencies
): Promise<FeedSource> {
  let source: FeedSource = 'fixture'
  const cached = await dependencies
    .cache()
    .get(feed.key, feed.isValue)
    .catch(() => null)
  if (cached) {
    feed.apply(cached.value, 'cache')
    source = 'cache'
    if (dependencies.now() - cached.fetchedAt < FEED_MAX_AGE_MS) return source
  }
  try {
    const { data, etag } = await dependencies.client().call(feed.operationId)
    feed.apply(data, 'console')
    await dependencies
      .cache()
      .put(feed.key, data, etag, dependencies.now())
      .catch(() => undefined)
    return 'console'
  } catch (error) {
    console.warn(`[Feeds] Could not refresh ${feed.key}; keeping the ${source} copy`, error)
    return source === 'cache' ? 'stale' : source
  }
}

export function appFeedDependencies(client: () => ConsoleClient): FeedDependencies {
  return { client, cache: consoleCache, now: () => Date.now() }
}
