import type { UIMessage } from 'ai'
import { onScopeDispose, watch } from 'vue'

import { useShipMessages } from '@redrob-design/vue'

import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { deliverWatchUpdates, registerWatchDelivery } from '@/app/ship/watch/service'
import { activeTab } from '@/app/tabs'

/**
 * While the thread is open, changes in a shipped page's watched sources
 * land on the page and post here; a page that is not open waits for it.
 * `ready` reads reactively, so changes wait until the thread can take them.
 */
export function useWatchUpdates(post: (message: UIMessage) => void, ready: () => boolean): void {
  const t = useShipMessages()
  const stop = registerWatchDelivery({
    ready,
    words: (source, summary) => ({
      changed: t.value.watchUpdated({ source, summary }),
      nothing: t.value.watchNoMatch({ source, summary })
    }),
    post
  })
  watch(
    () => [ready(), activeTab.value?.id, getActiveEditorStoreOrNull()?.state.currentPageId],
    () => deliverWatchUpdates()
  )
  onScopeDispose(stop)
}
