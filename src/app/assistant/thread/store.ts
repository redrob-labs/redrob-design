import { useDebounceFn } from '@vueuse/core'
import type { UIMessage } from 'ai'
import { shallowReactive } from 'vue'

import type { TurnReceipt } from '@/app/assistant/turn/usage'

import { getThreadStorage, toolCallIdsOf, type PlanAnswers } from './storage'

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

/** Answered Plan cards in every open thread, by tool call id. */
export const planAnswersByCall = shallowReactive(new Map<string, PlanAnswers>())

export function receiptFor(messageId: string): TurnReceipt | null {
  return receiptsByMessage.get(messageId) ?? null
}

export function setReceipt(messageId: string, receipt: TurnReceipt): void {
  receiptsByMessage.set(messageId, receipt)
}

/** The answers given on one Plan card, or null while it is still open. */
export function planAnswersFor(toolCallId: string): PlanAnswers | null {
  return planAnswersByCall.get(toolCallId) ?? null
}

/** Records a Plan card as answered; it stays answered after a reload. */
export function setPlanAnswers(toolCallId: string, answers: PlanAnswers): void {
  planAnswersByCall.set(toolCallId, { ...answers })
}

/** Reads a thread from this computer and registers its receipts and Plan answers. */
export async function loadThread(key: string): Promise<UIMessage[]> {
  const thread = await getThreadStorage().read(key)
  if (!thread) return []
  for (const [id, receipt] of Object.entries(thread.receipts)) receiptsByMessage.set(id, receipt)
  for (const [id, answers] of Object.entries(thread.planAnswers ?? {})) {
    planAnswersByCall.set(id, answers)
  }
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

function planAnswersOf(messages: readonly UIMessage[]): Record<string, PlanAnswers> {
  const answers: Record<string, PlanAnswers> = {}
  for (const id of toolCallIdsOf(messages)) {
    const given = planAnswersByCall.get(id)
    if (given) answers[id] = { ...given }
  }
  return answers
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
    planAnswers: planAnswersOf(messages),
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
