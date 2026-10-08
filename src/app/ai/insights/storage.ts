import { StorageSerializers, useLocalStorage } from '@vueuse/core'

/** The outbox of labeled sessions, as a JSON string, in the app's own storage prefix. */
const outbox = useLocalStorage<string | null>('redrob-design:insights-outbox', null, {
  serializer: StorageSerializers.string,
  writeDefaults: false
})

/** The outbox's storage, in the shape InsightsOutbox reads and writes. */
export const insightsOutboxStorage = {
  getItem: (): string | null => outbox.value,
  setItem: (_key: string, value: string): void => {
    outbox.value = value
  }
}
