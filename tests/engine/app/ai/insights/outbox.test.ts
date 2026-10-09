import 'fake-indexeddb/auto'
import { describe, expect, test } from 'bun:test'

import type { LabeledSession } from '@redrob-labs/work-labeller'

import { createIDBInsightsOutbox, OUTBOX_LIMIT } from '@/app/ai/insights/outbox'
import { createInsightsSync } from '@/app/ai/insights/sync'

function session(id: number): LabeledSession {
  return {
    externalId: `dz_${String(id).padStart(32, '0')}`,
    startedAt: '2026-10-09T10:00:00Z',
    toolKey: 'design',
    mode: 2,
    producedOutput: true,
    brief: false,
    context: false,
    checked: false,
    steerApplicable: false,
    steered: false,
    outward: false,
    sensitiveTouched: false,
    sensitiveOk: false,
    turns: 1,
    labelerId: 'design',
    labelerVersion: '1'
  }
}

async function clearOutbox() {
  const outbox = createIDBInsightsOutbox()
  await outbox.remove((await outbox.list()).map((entry) => entry.session.externalId))
  return outbox
}

describe('insights outbox', () => {
  test('is bounded to 2000 entries, dropping the oldest', async () => {
    const outbox = await clearOutbox()
    expect(OUTBOX_LIMIT).toBe(2000)
    for (let i = 0; i < OUTBOX_LIMIT + 5; i += 1) await outbox.add(session(i))
    expect(await outbox.size()).toBe(OUTBOX_LIMIT)
    const ids = (await outbox.list()).map((entry) => entry.session.externalId)
    expect(ids[0]).toBe(session(5).externalId)
    expect(ids.at(-1)).toBe(session(OUTBOX_LIMIT + 4).externalId)
  }, 60_000)

  test('a session queued again replaces its entry, and survives reopening', async () => {
    const outbox = await clearOutbox()
    await outbox.add(session(1))
    await outbox.add({ ...session(1), turns: 3 })
    const reopened = createIDBInsightsOutbox()
    const entries = await reopened.list()
    expect(entries).toHaveLength(1)
    expect(entries[0].session.turns).toBe(3)
  })
})

describe('insights sync', () => {
  test('posts the batch with the key and removes what the Console answered', async () => {
    const outbox = await clearOutbox()
    for (let i = 0; i < 3; i += 1) await outbox.add(session(i))
    const requests: { url: string; headers: Headers; body: unknown }[] = []
    const sync = createInsightsSync({
      outbox,
      resolveTarget: async () => ({ key: 'rrk_test', baseUrl: 'https://console.example/api/v1/' }),
      fetch: async (input, init) => {
        requests.push({
          url: String(input),
          headers: new Headers(init?.headers),
          body: JSON.parse(String(init?.body))
        })
        return Response.json({
          accepted: 2,
          updated: 0,
          rejected: [{ externalId: session(2).externalId, reason: 'x' }]
        })
      }
    })
    expect(await sync.run()).toEqual({ status: 'sent', accepted: 2, updated: 0, rejected: 1 })
    expect(requests).toHaveLength(1)
    expect(requests[0].url).toBe('https://console.example/api/v1/insights/sessions')
    expect(requests[0].headers.get('authorization')).toBe('Bearer rrk_test')
    expect(requests[0].body).toEqual({ sessions: [session(0), session(1), session(2)] })
    expect(await outbox.size()).toBe(0)
  })

  test('keeps the outbox when the Console is unreachable or refuses', async () => {
    const outbox = await clearOutbox()
    await outbox.add(session(1))
    const unreachable = createInsightsSync({
      outbox,
      resolveTarget: async () => ({ key: 'k', baseUrl: 'https://console.example' }),
      fetch: async () => {
        throw new TypeError('offline')
      }
    })
    expect(await unreachable.run()).toEqual({ status: 'unreachable' })
    const refused = createInsightsSync({
      outbox,
      resolveTarget: async () => ({ key: 'k', baseUrl: 'https://console.example' }),
      fetch: async () => new Response('', { status: 401 })
    })
    expect(await refused.run()).toEqual({ status: 'refused', code: 401 })
    expect(await outbox.size()).toBe(1)
  })

  test('reads no key for an empty outbox, and sends nothing without one', async () => {
    const outbox = await clearOutbox()
    let resolved = 0
    let fetched = 0
    const sync = createInsightsSync({
      outbox,
      resolveTarget: async () => {
        resolved += 1
        return null
      },
      fetch: async () => {
        fetched += 1
        return Response.json({})
      }
    })
    expect(await sync.run()).toEqual({ status: 'nothing' })
    expect(resolved).toBe(0)
    await outbox.add(session(1))
    expect(await sync.run()).toEqual({ status: 'no-key' })
    expect(fetched).toBe(0)
    expect(await outbox.size()).toBe(1)
  })
})
