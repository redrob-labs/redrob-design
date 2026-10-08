import { describe, expect, test } from 'bun:test'

import {
  addFact,
  labelSession,
  LABELER_ID,
  newTally,
  SESSION_QUIET_MS,
  type InsightFact,
  type LabeledSession
} from '@/app/ai/insights/labels'
import {
  activeInsightSession,
  finishInsightSessions,
  recordInsight,
  sessionHeaderFetch
} from '@/app/ai/insights/recorder'
import { InsightsOutbox, syncInsights } from '@/app/ai/insights/sync'

const T0 = Date.UTC(2026, 9, 6, 1, 2, 3)

function label(facts: InsightFact[]) {
  const tally = newTally('dg_test', T0)
  let at = T0
  for (const fact of facts) addFact(tally, fact, (at += 60_000))
  return labelSession(tally)
}
const msg = (context = false): InsightFact => ({ kind: 'message', context })
const change: InsightFact = { kind: 'tool', changed: true }
const look: InsightFact = { kind: 'tool', changed: false }
const answer: InsightFact = { kind: 'answer' }

describe('design insights labels', () => {
  test('a question with nothing changed is a look-up, a back and forth is learning', () => {
    expect(label([msg(), answer]).mode).toBe(0)
    expect(label([msg(), answer, msg(), answer]).mode).toBe(1)
  })

  test('a change in one or two messages is a draft, in three or more iterating', () => {
    expect(label([msg(true), change, answer])).toMatchObject({
      mode: 2,
      producedOutput: true,
      context: true
    })
    expect(label([msg(), change, answer, msg(), answer, msg(), change, answer]).mode).toBe(3)
  })

  test('many steps per message ending in a change is delegating, with agent figures', () => {
    const l = label([msg(), look, look, change, change, change, change, answer])
    expect(l.mode).toBe(4)
    expect(l.agent).toMatchObject({ actions: 6, instructions: 1, agentsAtOnce: 1 })
  })

  test('a message after a stop is steering', () => {
    expect(label([msg(), { kind: 'stopped' }, msg(), change, answer])).toMatchObject({
      steerApplicable: true,
      steered: true
    })
  })

  test('carries only labels, as Design and as its own labeler', () => {
    const l = label([msg(), change, answer])
    expect(l).toMatchObject({
      toolKey: 'design',
      familyKey: 'design',
      labelerId: LABELER_ID,
      startedAt: '2026-10-06T01:02:03Z'
    })
    expect(JSON.stringify(l)).not.toMatch(/"text"|"prompt"|"content"/)
  })
})

describe('design insights sessions', () => {
  test('one session per document, a new one after a quiet stretch', () => {
    const docA = {}
    const docB = {}
    recordInsight(docA, msg(), T0)
    const first = activeInsightSession()
    recordInsight(docB, msg(), T0 + 1)
    expect(activeInsightSession()).not.toBe(first)
    recordInsight(docA, msg(), T0 + SESSION_QUIET_MS + 10)
    expect(activeInsightSession()).not.toBe(first)
    expect(first).toMatch(/^dg_[0-9a-f]{32}$/)
    const done = finishInsightSessions(T0 + 3 * SESSION_QUIET_MS)
    expect(done.map((s) => s.externalId)).toContain(first!)
    expect(finishInsightSessions(T0 + 3 * SESSION_QUIET_MS)).toEqual([])
  })

  test('the Redrob provider sends the active session as x-redrob-session', async () => {
    recordInsight({}, msg())
    let seen: Headers | null = null
    const inner = async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen = new Headers(init?.headers)
      return new Response('{}')
    }
    await sessionHeaderFetch(inner)('https://console.test/v1/chat/completions', {
      headers: { Authorization: 'Bearer k' }
    })
    expect(seen!.get('x-redrob-session')).toBe(activeInsightSession())
    expect(seen!.get('Authorization')).toBe('Bearer k')
    finishInsightSessions(Date.now(), true)
  })
})

describe('design insights sync', () => {
  const memory = () => {
    const map = new Map<string, string>()
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v)
    }
  }
  const session = (n: number): LabeledSession => ({
    ...label([msg(), answer]),
    externalId: `dg_${n}`
  })

  test('sends batches with the key and empties what the console answered', async () => {
    const outbox = new InsightsOutbox(memory())
    outbox.add(Array.from({ length: 501 }, (_, i) => session(i)))
    const calls: Array<[string, RequestInit]> = []
    const out = await syncInsights({
      outbox,
      connection: { apiKey: 'rk-1', base: 'https://console.test/v1/' },
      fetch: async (url, init) => {
        calls.push([url, init])
        return new Response('{"accepted":1,"updated":0,"rejected":[]}')
      }
    })
    expect(out).toEqual({ status: 'sent', settled: 501 })
    expect(calls).toHaveLength(2)
    expect(calls[0]![0]).toBe('https://console.test/v1/insights/sessions')
    expect((calls[0]![1].headers as Record<string, string>).Authorization).toBe('Bearer rk-1')
    expect(outbox.read()).toEqual([])
  })

  test('keeps everything without a Redrob connection, with a refused key, or offline', async () => {
    const outbox = new InsightsOutbox(memory())
    outbox.add([session(1)])
    expect(
      await syncInsights({ outbox, connection: null, fetch: async () => new Response() })
    ).toEqual({ status: 'no-key' })
    const refused = await syncInsights({
      outbox,
      connection: { apiKey: 'k', base: 'x' },
      fetch: async () => new Response('', { status: 403 })
    })
    expect(refused.status).toBe('refused')
    const offline = await syncInsights({
      outbox,
      connection: { apiKey: 'k', base: 'x' },
      fetch: async () => {
        throw new Error('offline')
      }
    })
    expect(offline.status).toBe('unreachable')
    expect(outbox.read()).toHaveLength(1)
  })
})
