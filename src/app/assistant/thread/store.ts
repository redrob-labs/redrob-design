import { useDebounceFn } from '@vueuse/core'
import type { UIMessage } from 'ai'
import { shallowReactive } from 'vue'

import type { TurnReceipt } from '@/app/assistant/turn/usage'

import { getThreadStorage } from './storage'

/** What a thread is keyed by: the file's path when it has one, else its recovery id. */
export interface ThreadIdentity {
  getSourceIdentity(): { path?: string | null }
  getRecoveryId(): string
}

export function threadKeyFor(store: ThreadIdentity): string {
  const path = store.getSourceIdentity().path
  return path ? `file:${path}` : `doc:${store.getRecoveryId()}`
}

/** Receipts for every answer in every open thread, by message id. */
export const receiptsByMessage = shallowReactive(new Map<string, TurnReceipt>())

export function receiptFor(messageId: string): TurnReceipt | null {
  return receiptsByMessage.get(messageId) ?? null
}

export function setReceipt(messageId: string, receipt: TurnReceipt): void {
  receiptsByMessage.set(messageId, receipt)
}

/** Reads a thread from this computer and registers its receipts. */
export async function loadThread(key: string): Promise<UIMessage[]> {
  const thread = await getThreadStorage().read(key)
  if (!thread) return []
  for (const [id, receipt] of Object.entries(thread.receipts)) receiptsByMessage.set(id, receipt)
  return thread.messages
}

function receiptsOf(messages: readonly UIMessage[]): Record<string, TurnReceipt> {
  const receipts: Record<string, TurnReceipt> = {}
  for (const message of messages) {
    const receipt = receiptsByMessage.get(message.id)
    if (receipt) receipts[message.id] = receipt
  }
  return receipts
}

export async function saveThreadNow(key: string, messages: readonly UIMessage[]): Promise<void> {
  if (messages.length === 0) {
    await getThreadStorage().remove(key)
    return
  }
  await getThreadStorage().write({
    key,
    messages: [...messages],
    receipts: receiptsOf(messages),
    updatedAt: Date.now()
  })
}

const pendingSaves = new Map<string, readonly UIMessage[]>()
const flush = useDebounceFn(async () => {
  const saves = [...pendingSaves]
  pendingSaves.clear()
  for (const [key, messages] of saves) {
    await saveThreadNow(key, messages).catch((error: unknown) => {
      console.warn('[Thread] Could not keep the conversation on this computer', error)
    })
  }
}, 500)

/** Saves a thread shortly after it last changed. */
export function saveThread(key: string, messages: readonly UIMessage[]): void {
  pendingSaves.set(key, messages)
  void flush()
}
