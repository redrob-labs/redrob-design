import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import { reactive, watch } from 'vue'

import type { EditorStore } from '@/app/editor/active-store'

import { type AssistantControls, normalizeAssistantControls } from './model'

const CONTROLS_KEY = 'redrob-design:assistant-controls'

/** The last choices made anywhere, used as the starting point for a new thread. */
const lastUsed = useLocalStorage<unknown>(CONTROLS_KEY, null, {
  serializer: StorageSerializers.object,
  writeDefaults: false
})

const byThread = new WeakMap<EditorStore, AssistantControls>()

/**
 * The composer controls for one document's thread. Each thread keeps its own
 * choices, as Desk remembers the last choice in a chat, and every change also
 * becomes the default for the next new thread.
 */
export function assistantControlsFor(store: EditorStore): AssistantControls {
  const existing = byThread.get(store)
  if (existing) return existing
  const controls = reactive(normalizeAssistantControls(lastUsed.value))
  watch(
    controls,
    (value) => {
      lastUsed.value = structuredClone({ ...value, crossCheck: { ...value.crossCheck } })
    },
    { deep: true }
  )
  byThread.set(store, controls)
  return controls
}
