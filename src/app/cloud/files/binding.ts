import { computed, ref } from 'vue'

import type { EditorStore } from '@/app/editor/active-store'
import type { FileRole } from '@/app/integrations/console'
import { activeTab, getTabForStore, setTabReadOnly } from '@/app/tabs'

/** What an open tab knows about the Redrob Cloud file it shows. */
export interface CloudFileBinding {
  fileId: string
  /** The plain name, decrypted. */
  name: string
  role: FileRole
  /** The content key epoch the file is sealed under now. */
  epoch: number
  /** The snapshot revision this tab last loaded or saved. */
  revision: number
  /** The view link's token, when the tab was opened through one. */
  link: string | null
}

const bindings = new WeakMap<EditorStore, CloudFileBinding>()
/** WeakMaps are not reactive; this is what tells computed state a binding changed. */
const version = ref(0)

/** Viewers and commenters, and anyone opening a view link, cannot change the canvas. */
export function canEditFile(role: FileRole): boolean {
  return role === 'editor' || role === 'owner'
}

export function cloudBindingOf(store: EditorStore): CloudFileBinding | null {
  void version.value
  return bindings.get(store) ?? null
}

export function bindCloudFile(store: EditorStore, binding: CloudFileBinding): void {
  bindings.set(store, binding)
  store.setCloudDocumentSource(binding.fileId, binding.name)
  const tab = getTabForStore(store)
  if (tab) setTabReadOnly(tab.id, !canEditFile(binding.role))
  version.value += 1
}

export function updateCloudBinding(store: EditorStore, patch: Partial<CloudFileBinding>): void {
  const current = bindings.get(store)
  if (!current) return
  const next = { ...current, ...patch }
  bindings.set(store, next)
  if (patch.role) {
    const tab = getTabForStore(store)
    if (tab) setTabReadOnly(tab.id, !canEditFile(next.role))
  }
  version.value += 1
}

/** The active tab's cloud file, if it shows one. */
export const activeCloudFile = computed<CloudFileBinding | null>(() => {
  const store = activeTab.value?.store
  return store ? cloudBindingOf(store) : null
})
