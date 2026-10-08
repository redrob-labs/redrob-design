import type { UIMessage } from 'ai'
import { onScopeDispose } from 'vue'

import { crossCheckAnswer } from '@/app/assistant/cross-check/session'
import { onAnswerFinished } from '@/app/assistant/turn/finished'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'

/**
 * After each answer in this thread, runs Cross-check when the person's levels
 * call for it and posts what it found under the answer.
 */
export function useCrossCheck(post: (message: UIMessage) => void): void {
  const stop = onAnswerFinished(({ store, message, messages }) => {
    void crossCheckAnswer(store, message, messages)
      .then((result) => {
        // The person may have switched files while the check ran.
        if (result && getActiveEditorStoreOrNull() === store) post(result)
        return undefined
      })
      .catch((error: unknown) => {
        console.warn('[Cross-check] Could not check the answer', error)
      })
  })
  onScopeDispose(stop)
}
