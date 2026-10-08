import { watchDebounced } from '@vueuse/core'

import { activeTab } from '@/app/tabs'

import { autoSaveVersion } from './service'

let started = false

/** Takes automatic versions of the open document while it is being edited. */
export function startVersionHistory(): void {
  if (started) return
  started = true
  watchDebounced(
    () => {
      const tab = activeTab.value
      return tab?.kind === 'document' ? tab.store.state.sceneVersion : null
    },
    () => {
      const tab = activeTab.value
      if (tab?.kind !== 'document') return
      autoSaveVersion(tab.store).catch((error: unknown) => {
        console.warn('[History] Could not save a version', error)
      })
    },
    { debounce: 5000, maxWait: 60_000 }
  )
}
