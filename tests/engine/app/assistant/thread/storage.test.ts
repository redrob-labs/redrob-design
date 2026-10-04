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
  receiptFor,
  receiptsByMessage,
  saveThreadNow,
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

  test('forgets a thread saved empty', async () => {
    setThreadStorageForTests(createMemoryThreadStorage())
    await saveThreadNow('file:x', [message('a1')])
    await saveThreadNow('file:x', [])
    expect(await loadThread('file:x')).toEqual([])
  })
})
