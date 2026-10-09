import { describe, expect, test } from 'bun:test'

import type { LabeledSession, WorkClassifier } from '@redrob-labs/work-labeller'

import { toDesignSession } from '@/app/ai/insights/app'
import { createChatInsights, SESSION_QUIET_MS } from '@/app/ai/insights/sessions'

const FIRST = 'Draft a pricing page for our refund policy, customer acme-corp, ticket 4411'

function setup(options: { classifier?: WorkClassifier | null } = {}) {
  let clock = Date.parse('2026-10-09T10:00:00Z')
  let ids = 0
  const queued: LabeledSession[] = []
  const read: string[] = []
  let finished = 0
  const classifier: WorkClassifier = {
    id: 'test',
    async label(text) {
      read.push(text)
      return { action: null, family: 'design', confidence: 0.9 }
    }
  }
  const insights = createChatInsights<object>({
    queue: (session) => {
      queued.push(session)
    },
    classifier: () => (options.classifier === undefined ? classifier : options.classifier),
    onRedrobChatFinished: () => {
      finished += 1
    },
    now: () => clock,
    newRootID: () => `root-${++ids}`
  })
  return {
    insights,
    queued,
    read,
    finished: () => finished,
    advance: (ms: number) => {
      clock += ms
    }
  }
}

const done = { isAbort: false, isError: false, isDisconnect: false }

describe('chat insights recorder', () => {
  test('classifies the first message once and keeps none of its text', async () => {
    const { insights, queued, read, advance } = setup()
    const tab = {}
    insights.bindChat(tab, 'redrob')
    insights.userTurn(tab, { text: FIRST, attachedSource: false })
    insights.toolCall(tab, { failed: false, changedScene: true })
    insights.toolCall(tab, { failed: false, changedScene: false })
    advance(30_000)
    insights.chatFinished(tab, done)
    insights.userTurn(tab, { text: 'Make the headline bigger', attachedSource: false })
    insights.chatFinished(tab, done)
    await insights.end(tab)

    expect(read).toEqual([FIRST])
    expect(queued).toHaveLength(1)
    const session = queued[0]
    const serialized = JSON.stringify(session)
    for (const fragment of ['pricing', 'refund', 'acme', '4411', 'headline', 'root-1']) {
      expect(serialized).not.toContain(fragment)
    }
    expect(session).toMatchObject({
      toolKey: 'design',
      labelerId: 'design',
      labelerVersion: '1',
      familyKey: 'design',
      producedOutput: true,
      turns: 2,
      mode: 2
    })
    expect(session.externalId).toMatch(/^dz_[0-9a-f]{32}$/)
  })

  test('records only the Redrob provider', async () => {
    const { insights, queued, read } = setup()
    const tab = {}
    for (const provider of ['openrouter', 'acp:claude', 'harness:pi', null] as const) {
      insights.bindChat(tab, provider)
      insights.userTurn(tab, { text: FIRST, attachedSource: false })
      insights.chatFinished(tab, done)
      expect(insights.sessionID(tab)).toBeNull()
    }
    await insights.end(tab)
    expect(queued).toEqual([])
    expect(read).toEqual([])
  })

  test('moving a tab off Redrob ends its session', async () => {
    const { insights, queued } = setup()
    const tab = {}
    insights.bindChat(tab, 'redrob')
    insights.userTurn(tab, { text: FIRST, attachedSource: false })
    insights.chatFinished(tab, done)
    insights.bindChat(tab, 'openrouter')
    await insights.settled()
    expect(queued).toHaveLength(1)
  })

  test('one session per tab, from the first message until reset', async () => {
    const { insights, queued } = setup()
    const a = {}
    const b = {}
    insights.bindChat(a, 'redrob')
    insights.bindChat(b, 'redrob')
    insights.userTurn(a, { text: 'one', attachedSource: false })
    insights.userTurn(b, { text: 'two', attachedSource: true })
    expect(insights.sessionID(a)).not.toBe(insights.sessionID(b))
    await insights.end(a)
    expect(queued).toHaveLength(1)
    expect(insights.liveCount()).toBe(1)
    insights.userTurn(a, { text: 'again', attachedSource: false })
    await insights.end(a)
    await insights.end(b)
    expect(new Set(queued.map((s) => s.externalId)).size).toBe(3)
    expect(queued.find((s) => s.context)).toBeDefined()
  })

  test('15 quiet minutes end a session; a busy one waits', async () => {
    const { insights, queued, advance } = setup()
    const tab = {}
    insights.bindChat(tab, 'redrob')
    insights.userTurn(tab, { text: FIRST, attachedSource: false })
    advance(SESSION_QUIET_MS + 1)
    await insights.sweep()
    expect(queued).toHaveLength(0)
    insights.chatFinished(tab, done)
    advance(SESSION_QUIET_MS - 1)
    await insights.sweep()
    expect(queued).toHaveLength(0)
    advance(1)
    await insights.sweep()
    expect(queued).toHaveLength(1)
  })

  test('a message after 15 quiet minutes starts a new session', async () => {
    const { insights, queued, advance, read } = setup()
    const tab = {}
    insights.bindChat(tab, 'redrob')
    insights.userTurn(tab, { text: 'first', attachedSource: false })
    insights.chatFinished(tab, done)
    const firstID = insights.sessionID(tab)
    advance(SESSION_QUIET_MS)
    insights.userTurn(tab, { text: 'second', attachedSource: false })
    await insights.settled()
    expect(queued).toHaveLength(1)
    expect(insights.sessionID(tab)).not.toBe(firstID)
    expect(read).toEqual(['first', 'second'])
  })

  test('an abort counts, and the next message is a redirect', async () => {
    const { insights, queued } = setup()
    const tab = {}
    insights.bindChat(tab, 'redrob')
    insights.userTurn(tab, { text: FIRST, attachedSource: false })
    insights.chatFinished(tab, { ...done, isAbort: true })
    insights.userTurn(tab, { text: 'no, like this', attachedSource: false })
    insights.chatFinished(tab, done)
    await insights.end(tab)
    expect(queued[0]).toMatchObject({ steerApplicable: true, steered: true })
  })

  test('an export is output sent outward', async () => {
    const { insights, queued } = setup()
    const tab = {}
    insights.bindChat(tab, 'redrob')
    insights.exported(tab)
    insights.userTurn(tab, { text: FIRST, attachedSource: false })
    insights.chatFinished(tab, done)
    insights.exported(tab)
    await insights.end(tab)
    expect(queued[0]).toMatchObject({ outward: true, producedOutput: true })
  })

  test('without the model, sessions get structural labels only', async () => {
    const { insights, queued } = setup({ classifier: null })
    const tab = {}
    insights.bindChat(tab, 'redrob')
    insights.userTurn(tab, { text: FIRST, attachedSource: false })
    insights.toolCall(tab, { failed: false, changedScene: true })
    insights.chatFinished(tab, done)
    await insights.end(tab)
    expect(queued[0].familyKey).toBeUndefined()
    expect(queued[0].actionKey).toBeUndefined()
    expect(queued[0].producedOutput).toBe(true)
  })

  test('a long tool loop is capped at Iterate and sends no agent figures', async () => {
    const { insights, queued } = setup()
    const tab = {}
    insights.bindChat(tab, 'redrob')
    insights.userTurn(tab, { text: FIRST, attachedSource: false })
    for (let i = 0; i < 12; i += 1) insights.toolCall(tab, { failed: false, changedScene: true })
    insights.chatFinished(tab, done)
    await insights.end(tab)
    expect(queued[0].mode).toBe(2)
    expect(queued[0].agent).toBeUndefined()
  })

  test('a finished Redrob run is the cue to fetch the model', () => {
    const { insights, finished } = setup()
    const tab = {}
    insights.chatFinished(tab, done)
    expect(finished()).toBe(0)
    insights.bindChat(tab, 'redrob')
    insights.userTurn(tab, { text: FIRST, attachedSource: false })
    expect(finished()).toBe(0)
    insights.chatFinished(tab, done)
    expect(finished()).toBe(1)
  })
})

describe('toDesignSession', () => {
  const base: LabeledSession = {
    externalId: 'dz_x',
    startedAt: '2026-10-09T10:00:00Z',
    toolKey: 'design',
    mode: 4,
    producedOutput: true,
    brief: false,
    context: false,
    checked: false,
    steerApplicable: true,
    steered: false,
    outward: false,
    sensitiveTouched: false,
    sensitiveOk: false,
    turns: 4,
    agent: {
      actions: 30,
      instructions: 4,
      agentMinutes: 3,
      attentionMinutes: 1,
      autoApproved: true,
      interrupted: false,
      agentsAtOnce: 1,
      humanEquivHours: 0
    },
    labelerId: 'design',
    labelerVersion: '1'
  }

  test('caps Delegate and Orchestrate by the produced-output rule', () => {
    expect(toDesignSession(base).mode).toBe(3)
    expect(toDesignSession({ ...base, mode: 5, turns: 1 }).mode).toBe(2)
    expect(toDesignSession(base).agent).toBeUndefined()
    expect('agent' in toDesignSession(base)).toBe(false)
  })

  test('leaves lower modes alone', () => {
    for (const mode of [0, 1, 2, 3]) {
      expect(toDesignSession({ ...base, mode }).mode).toBe(mode)
    }
  })
})
