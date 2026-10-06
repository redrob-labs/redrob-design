import { afterEach, describe, expect, test } from 'bun:test'

import { DESIGN_SCREENS_RANKING, RANKING_SOURCE } from '@/app/ai/models/ranking/fixture'
import { rankedPick, rankedPicks, rankingSource } from '@/app/ai/models/ranking/store'
import { MODEL_RATES, modelRates, priceTurn } from '@/app/assistant/turn/pricing'
import { createConsoleClient, createMemorySnapshotCache } from '@/app/integrations/console'
import {
  LEADERBOARD_FEED,
  loadConsoleFeeds,
  resetConsoleFeedsForTests
} from '@/app/integrations/console/app-feeds'
import { FEED_MAX_AGE_MS, loadFeed } from '@/app/integrations/console/feeds'

import { createMockConsole, mockConsoleFetch } from '#tests/helpers/console/server'

function setup(fetch = mockConsoleFetch(createMockConsole()), now = 1_000_000) {
  const cache = createMemorySnapshotCache()
  let calls = 0
  const client = createConsoleClient({
    baseURL: 'https://console.mock/v1',
    token: () => Promise.resolve(null),
    fetch: (url, init) => {
      calls += 1
      return fetch(url, init)
    }
  })
  const clock = { now }
  return {
    cache,
    clock,
    calls: () => calls,
    dependencies: { client: () => client, cache: () => cache, now: () => clock.now }
  }
}

afterEach(() => {
  rankedPicks.value = DESIGN_SCREENS_RANKING
  rankingSource.value = RANKING_SOURCE
  modelRates.value = MODEL_RATES
  resetConsoleFeedsForTests()
})

describe('Console feeds', () => {
  test('start on the fixture, then use the Leaderboard and price feeds without sign-in', async () => {
    expect(rankingSource.value.edition).toBe('September 2026')
    const { dependencies } = setup()
    expect(await loadConsoleFeeds(dependencies)).toEqual({
      leaderboard: 'console',
      modelRates: 'console'
    })
    expect(rankingSource.value).toEqual({
      name: 'Redrob Leaderboard',
      edition: 'October 2026',
      note: 'Updated monthly'
    })
    expect(rankedPick('screens-1')?.why).toBe('Best layouts in the October run.')
    expect(priceTurn('claude-opus-5.5', 1_000_000, 0)).toBe(15)
    expect(priceTurn('claude-sonnet-4', 1_000_000, 0)).toBeNull()
  })

  test('a fresh cached copy answers without asking Console', async () => {
    const first = setup()
    await loadFeed(LEADERBOARD_FEED, first.dependencies)
    first.clock.now += FEED_MAX_AGE_MS - 1
    expect(await loadFeed(LEADERBOARD_FEED, first.dependencies)).toBe('cache')
    expect(first.calls()).toBe(1)

    first.clock.now += 2
    expect(await loadFeed(LEADERBOARD_FEED, first.dependencies)).toBe('console')
    expect(first.calls()).toBe(2)
  })

  test('offline, a stale copy is kept; with no copy, the fixture stays', async () => {
    const online = setup()
    await loadFeed(LEADERBOARD_FEED, online.dependencies)
    const offline = setup(() => Promise.reject(new TypeError('offline')))
    const cache = online.dependencies.cache
    const stale = {
      ...offline.dependencies,
      cache,
      now: () => online.clock.now + FEED_MAX_AGE_MS * 3
    }
    rankingSource.value = RANKING_SOURCE
    expect(await loadFeed(LEADERBOARD_FEED, stale)).toBe('stale')
    expect(rankingSource.value.edition).toBe('October 2026')

    rankingSource.value = RANKING_SOURCE
    expect(await loadFeed(LEADERBOARD_FEED, offline.dependencies)).toBe('fixture')
    expect(rankingSource.value.edition).toBe('September 2026')
  })

  test('a session that could not reach Console tries again on the next load', async () => {
    let online = false
    const mock = mockConsoleFetch(createMockConsole())
    const { dependencies, calls } = setup((url, init) =>
      online ? mock(url, init) : Promise.reject(new TypeError('offline'))
    )
    expect(await loadConsoleFeeds(dependencies)).toEqual({
      leaderboard: 'fixture',
      modelRates: 'fixture'
    })
    online = true
    expect(await loadConsoleFeeds(dependencies)).toEqual({
      leaderboard: 'console',
      modelRates: 'console'
    })
    const after = calls()
    await loadConsoleFeeds(dependencies)
    expect(calls()).toBe(after)
  })

  test('a feed that breaks the contract is refused and the fixture stays', async () => {
    const broken = setup(() =>
      Promise.resolve(new Response(JSON.stringify({ name: 'x', picks: [] }), { status: 200 }))
    )
    expect(await loadFeed(LEADERBOARD_FEED, broken.dependencies)).toBe('fixture')
    expect(rankedPicks.value).toBe(DESIGN_SCREENS_RANKING)
    await broken.cache.put('feed:leaderboard', { picks: 'nope' }, null, 0)
    expect(await loadFeed(LEADERBOARD_FEED, broken.dependencies)).toBe('fixture')
  })
})
