import { StorageSerializers, useLocalStorage } from '@vueuse/core'
import { reactive, watch } from 'vue'

import { type AssistantControls, normalizeAssistantControls } from './model'

/** Whatever a thread belongs to; in the app, the document's editor store. */
export type ControlsOwner = object

const CONTROLS_KEY = 'redrob-design:assistant-controls'

/** The last choices made anywhere, used as the starting point for a new thread. */
const lastUsed = useLocalStorage<unknown>(CONTROLS_KEY, null, {
  serializer: StorageSerializers.object,
  writeDefaults: false
})

const byThread = new WeakMap<ControlsOwner, AssistantControls>()

/**
 * The composer controls for one document's thread. Each thread keeps its own
 * choices, as Desk remembers the last choice in a chat, and every change also
 * becomes the default for the next new thread.
 */
export function assistantControlsFor(store: ControlsOwner): AssistantControls {
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
