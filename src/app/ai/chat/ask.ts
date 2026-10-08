import { ref } from 'vue'

import { useAIChat } from '@/app/ai/chat/use'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'

/**
 * Bumped each time someone asks Redrob, so the composer in the Redrob tab can
 * take focus once it is on screen.
 */
export const composerFocusRequest = ref(0)

/** Opens the Redrob tab beside the canvas and puts the cursor in its composer. */
export function askRedrob(): void {
  const store = getActiveEditorStoreOrNull()
  if (store && !store.state.showUI) store.state.showUI = true
  useAIChat().activeTab.value = 'ai'
  composerFocusRequest.value += 1
}
