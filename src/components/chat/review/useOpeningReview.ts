import type { Chat } from '@ai-sdk/vue'
import type { UIMessage } from 'ai'
import { watch, type ShallowRef } from 'vue'

import { useReviewMessages } from '@redrob-design/vue'

import { saveThread, threadKeyFor } from '@/app/assistant/thread/store'
import { getActiveEditorStore } from '@/app/editor/active-store'
import { openingReview, reviewMessage } from '@/app/review/store'
import { activeTabMode } from '@/app/tabs'

/**
 * Opening a file in Describe costs nothing: Redrob checks the page on this
 * computer and posts what it found, once per change to the page.
 */
export function useOpeningReview(chat: ShallowRef<Chat<UIMessage> | null>): void {
  const t = useReviewMessages()

  function post(): void {
    const current = chat.value
    if (!current || activeTabMode.value !== 'describe' || current.status !== 'ready') return
    const store = getActiveEditorStore()
    const review = openingReview(
      store,
      store.graph,
      store.state.currentPageId,
      store.state.sceneVersion
    )
    if (!review) return
    current.messages = [
      ...current.messages,
      reviewMessage(review, store.state.documentName, {
        checked: (name, count) => t.value.checked({ name, count }),
        checkedClean: (name) => t.value.checkedClean({ name })
      })
    ]
    saveThread(threadKeyFor(store), current.messages)
  }

  watch([chat, activeTabMode], post, { immediate: true })
}
