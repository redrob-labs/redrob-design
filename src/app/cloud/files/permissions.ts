import { computed } from 'vue'

import { cloudFileIdOf } from '@/app/assistant/thread/store'
import type { EditorStore } from '@/app/editor/active-store'
import type { FileRole } from '@/app/integrations/console'
import { getTabsSnapshot } from '@/app/tabs'

import { activeCloudFile, cloudBindingOf } from './binding'

/**
 * What the person may do to an open document. A document on this computer allows everything; a
 * shared file allows what its role does. Console and the relay refuse anything else regardless;
 * these checks are what keep the app from pretending otherwise, including when Redrob or an
 * automation is the one asking.
 */
export class ReadOnlyFileError extends Error {
  constructor(message = 'You can view this file but not change it') {
    super(message)
    this.name = 'ReadOnlyFileError'
  }
}

const RANK: Record<FileRole, number> = { viewer: 0, commenter: 1, editor: 2, owner: 3 }

function roleOf(store: EditorStore): FileRole | null {
  return cloudBindingOf(store)?.role ?? null
}

export function canEditDocument(store: EditorStore): boolean {
  const role = roleOf(store)
  return role === null || RANK[role] >= RANK.editor
}

export function canCommentOnDocument(store: EditorStore): boolean {
  const role = roleOf(store)
  return role === null || RANK[role] >= RANK.commenter
}

export function assertCanEdit(store: EditorStore): void {
  if (!canEditDocument(store)) throw new ReadOnlyFileError()
}

/** Comments and versions are keyed by document; this finds the open shared file a key names. */
function storeFor(documentKey: string): EditorStore | null | undefined {
  const fileId = cloudFileIdOf(documentKey)
  if (!fileId) return null
  return getTabsSnapshot().find((tab) => tab.store.getSourceIdentity().cloudFileId === fileId)
    ?.store
}

export function canCommentOn(documentKey: string): boolean {
  const store = storeFor(documentKey)
  return store === null || (store !== undefined && canCommentOnDocument(store))
}

export function canEditKey(documentKey: string): boolean {
  const store = storeFor(documentKey)
  return store === null || (store !== undefined && canEditDocument(store))
}

export function assertCanComment(documentKey: string): void {
  if (!canCommentOn(documentKey)) {
    throw new ReadOnlyFileError('You can view this file but not comment on it')
  }
}

/** For the open tab's UI: whether to offer edits and comments at all. */
export const activeFilePermissions = computed(() => {
  const role = activeCloudFile.value?.role ?? null
  return {
    edit: role === null || RANK[role] >= RANK.editor,
    comment: role === null || RANK[role] >= RANK.commenter,
    role
  }
})
