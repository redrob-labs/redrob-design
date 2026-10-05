import { afterEach, describe, expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import {
  MAX_STORED_MESSAGES,
  createMemoryThreadStorage,
  setThreadStorageForTests,
  trimThread
} from '@/app/assistant/thread/storage'
import {
  loadThread,
  planAnswersByCall,
  planAnswersFor,
  receiptFor,
  receiptsByMessage,
  saveThreadNow,
  setPlanAnswers,
  setReceipt,
  threadKeyFor
} from '@/app/assistant/thread/store'
import type { TurnReceipt } from '@/app/assistant/turn/usage'

function message(id: string, role: UIMessage['role'] = 'assistant'): UIMessage {
  return { id, role, parts: [{ type: 'text', text: id }] }
}

const receipt: TurnReceipt = {
  provider: 'anthropic',
  model: 'claude-sonnet-4',
  effort: null,
  pinned: false,
  inputTokens: 10,
  outputTokens: 5,
  steps: 1,
  price: 0.0001,
  keptPrivate: 0,
  factCheckBy: null
}

afterEach(() => {
  setThreadStorageForTests(null)
  receiptsByMessage.clear()
  planAnswersByCall.clear()
})

describe('thread keys', () => {
  test('use the file path when the document has one', () => {
    const key = threadKeyFor({
      getSourceIdentity: () => ({ path: '/work/app.fig' }),
      getRecoveryId: () => 'r1'
    })
    expect(key).toBe('file:/work/app.fig')
  })

  test('fall back to the recovery id for unsaved documents', () => {
    const key = threadKeyFor({
      getSourceIdentity: () => ({ path: null }),
      getRecoveryId: () => 'r1'
    })
    expect(key).toBe('doc:r1')
  })
})

describe('thread storage', () => {
  test('trims long threads to the most recent messages and their receipts', () => {
    const messages = Array.from({ length: MAX_STORED_MESSAGES + 5 }, (_, i) => message(`m${i}`))
    const trimmed = trimThread({
      key: 'k',
      messages,
      receipts: { m0: receipt, [`m${MAX_STORED_MESSAGES + 4}`]: receipt },
      updatedAt: 0
    })
    expect(trimmed.messages).toHaveLength(MAX_STORED_MESSAGES)
    expect(trimmed.messages[0].id).toBe('m5')
    expect(Object.keys(trimmed.receipts)).toEqual([`m${MAX_STORED_MESSAGES + 4}`])
  })

  test('round-trips a thread with its receipts', async () => {
    setThreadStorageForTests(createMemoryThreadStorage())
    setReceipt('a1', receipt)
    await saveThreadNow('file:x', [message('u1', 'user'), message('a1')])
    receiptsByMessage.clear()

    const messages = await loadThread('file:x')
    expect(messages.map((m) => m.id)).toEqual(['u1', 'a1'])
    expect(receiptFor('a1')).toEqual(receipt)
    expect(receiptFor('u1')).toBeNull()
  })

  test('keeps answered Plan cards with the thread', async () => {
    setThreadStorageForTests(createMemoryThreadStorage())
    const asked: UIMessage = {
      id: 'a1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-ask_plan_questions',
          toolCallId: 'call-1',
          state: 'output-available',
          input: { questions: '[]' },
          output: 'asked'
        }
      ]
    }
    setPlanAnswers('call-1', { who: 'Teams of 5 to 50' })
    await saveThreadNow('file:x', [message('u1', 'user'), asked])
    planAnswersByCall.clear()

    await loadThread('file:x')
    expect(planAnswersFor('call-1')).toEqual({ who: 'Teams of 5 to 50' })
    expect(planAnswersFor('call-2')).toBeNull()
  })

  test('reads threads saved before Plan answers were kept', async () => {
    const storage = createMemoryThreadStorage()
    setThreadStorageForTests(storage)
    await storage.write({ key: 'file:old', messages: [message('a1')], receipts: {}, updatedAt: 0 })
    expect((await loadThread('file:old')).map((m) => m.id)).toEqual(['a1'])
    expect(planAnswersByCall.size).toBe(0)
  })

  test('trims Plan answers whose card is no longer kept', () => {
    const messages = Array.from({ length: MAX_STORED_MESSAGES + 1 }, (_, i) => message(`m${i}`))
    const trimmed = trimThread({
      key: 'k',
      messages,
      receipts: {},
      planAnswers: { gone: { q: 'a' } },
      updatedAt: 0
    })
    expect(trimmed.planAnswers).toEqual({})
  })

  test('forgets a thread saved empty', async () => {
    setThreadStorageForTests(createMemoryThreadStorage())
    await saveThreadNow('file:x', [message('a1')])
    await saveThreadNow('file:x', [])
    expect(await loadThread('file:x')).toEqual([])
  })
})
