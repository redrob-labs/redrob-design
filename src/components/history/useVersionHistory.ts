import { onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'

import {
  historyRevision,
  listHistory,
  versionPreview,
  type HistoryDocument,
  type HistoryEntry
} from '@/app/document/history/service'

/**
 * The open document's versions while History is open, with object URLs for
 * the previews saved beside them. URLs are revoked when the list changes.
 */
export function useVersionHistory(open: Ref<boolean>, document: () => HistoryDocument | null) {
  const entries = shallowRef<HistoryEntry[]>([])
  const previews = shallowRef(new Map<string, string>())
  const loading = ref(false)
  let generation = 0

  function revokePreviews(): void {
    for (const url of previews.value.values()) URL.revokeObjectURL(url)
    previews.value = new Map()
  }

  async function loadPreviews(rows: readonly HistoryEntry[]): Promise<Map<string, string>> {
    const urls = new Map<string, string>()
    for (const row of rows) {
      if (!row.local) continue
      const bytes = await versionPreview(row.local)
      if (!bytes) continue
      const blob = new Blob([Uint8Array.from(bytes)], { type: 'image/png' })
      urls.set(row.key, URL.createObjectURL(blob))
    }
    return urls
  }

  async function reload(): Promise<void> {
    const target = document()
    if (!open.value || !target) return
    const current = ++generation
    loading.value = true
    try {
      const rows = await listHistory(target)
      const urls = await loadPreviews(rows)
      if (current !== generation) {
        for (const url of urls.values()) URL.revokeObjectURL(url)
        return
      }
      revokePreviews()
      entries.value = rows
      previews.value = urls
    } finally {
      if (current === generation) loading.value = false
    }
  }

  watch([open, historyRevision], () => void reload(), { immediate: true })
  watch(open, (isOpen) => {
    if (!isOpen) revokePreviews()
  })
  onScopeDispose(revokePreviews)

  return { entries, previews, loading, reload }
}
