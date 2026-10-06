import { ref } from 'vue'

import { exportFigFile } from '@redrob-design/core/io/formats/fig'
import { renderThumbnail } from '@redrob-design/core/io/formats/raster'

import { threadKeyFor, type ThreadIdentity } from '@/app/assistant/thread/store'

import {
  deleteCloudVersion,
  listCloudVersions,
  readCloudVersion,
  renameCloudVersion,
  uploadPendingVersions
} from './cloud'
import { restoreDocumentBytes, type RestoreTarget } from './restore'
import { autoVersionDue, saveVersion } from './ring'
import { getVersionStore } from './store'
import type { VersionKind, VersionMeta } from './types'

type ThumbnailRenderer = Parameters<typeof renderThumbnail>[1]

/** The open document a version is taken from and restored into. */
export interface HistoryDocument extends RestoreTarget, ThreadIdentity {
  state: { currentPageId: string; sceneVersion: number; documentName: string }
  renderer?: ThumbnailRenderer | null
}

/** One row in History: a version here, in Redrob Cloud, or both. */
export interface HistoryEntry {
  key: string
  origin: 'local' | 'cloud'
  kind: VersionKind
  name: string | null
  createdAt: string
  byteLength: number
  /** Who saved it, for versions from Redrob Cloud. */
  createdBy: string | null
  synced: boolean
  local: VersionMeta | null
  remoteId: string | null
}

const PREVIEW_SIZE = 240
const RESTORE_LABEL = 'Restore version'

export const versionHistoryOpen = ref(false)
/** Moves whenever versions change, so an open History list reads them again. */
export const historyRevision = ref(0)

export function openVersionHistory(): void {
  versionHistoryOpen.value = true
}

/** The scene version each open document was last versioned at in this session. */
const versionedAt = new WeakMap<HistoryDocument, number>()

function previewOf(document: HistoryDocument): Uint8Array | null {
  const renderer = document.renderer
  if (!renderer) return null
  try {
    const { graph, state } = document
    return renderThumbnail(
      renderer.ck,
      renderer,
      graph,
      state.currentPageId,
      PREVIEW_SIZE,
      PREVIEW_SIZE
    )
  } catch (error) {
    console.warn('[History] Could not draw the preview', error)
    return null
  }
}

async function syncToCloud(documentKey: string, dropped: readonly VersionMeta[]): Promise<void> {
  try {
    for (const version of dropped) await deleteCloudVersion(version)
    if ((await uploadPendingVersions(getVersionStore(), documentKey)) > 0) historyRevision.value++
  } catch (error) {
    console.warn('[History] Keeping versions on this computer until Redrob Cloud answers', error)
  }
}

/** Saves the document as it is now; a named version stays until it is deleted. */
export async function saveDocumentVersion(
  document: HistoryDocument,
  kind: VersionKind,
  name: string | null = null
): Promise<VersionMeta> {
  const documentKey = threadKeyFor(document)
  const sceneVersion = document.state.sceneVersion
  const figBytes = await exportFigFile(
    document.graph,
    undefined,
    undefined,
    document.state.currentPageId
  )
  const { saved, dropped } = await saveVersion(getVersionStore(), {
    documentKey,
    documentName: document.state.documentName,
    kind,
    name,
    sceneVersion,
    figBytes,
    preview: previewOf(document)
  })
  versionedAt.set(document, sceneVersion)
  historyRevision.value++
  void syncToCloud(documentKey, dropped)
  return saved
}

/**
 * Takes an automatic version when the document changed since the last one
 * and the last one is old enough. Returns null when none was due.
 */
export async function autoSaveVersion(
  document: HistoryDocument,
  now = Date.now()
): Promise<VersionMeta | null> {
  if (versionedAt.get(document) === document.state.sceneVersion) return null
  const [latest] = await getVersionStore().list(threadKeyFor(document))
  if (!autoVersionDue(latest, now)) return null
  return saveDocumentVersion(document, 'auto')
}

/**
 * Every version of the document, newest first: those on this computer, and
 * those only Redrob Cloud has. Offline, it is the ones on this computer.
 */
export async function listHistory(document: HistoryDocument): Promise<HistoryEntry[]> {
  const documentKey = threadKeyFor(document)
  const local = await getVersionStore().list(documentKey)
  const entries: HistoryEntry[] = local.map((meta) => ({
    key: meta.id,
    origin: 'local',
    kind: meta.kind,
    name: meta.name,
    createdAt: meta.createdAt,
    byteLength: meta.byteLength,
    createdBy: null,
    synced: meta.remoteId !== null,
    local: meta,
    remoteId: meta.remoteId
  }))
  const known = new Set(local.map((meta) => meta.remoteId))
  const cloud = await listCloudVersions(documentKey).catch((error: unknown) => {
    console.warn('[History] Showing versions on this computer only', error)
    return []
  })
  for (const summary of cloud) {
    if (known.has(summary.id)) continue
    entries.push({
      key: `cloud:${summary.id}`,
      origin: 'cloud',
      kind: summary.kind,
      name: summary.name,
      createdAt: summary.createdAt,
      byteLength: summary.size,
      createdBy: summary.createdBy.name,
      synced: true,
      local: null,
      remoteId: summary.id
    })
  }
  return entries.toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
}

/** Names a version, which keeps it past the automatic limit. */
export async function renameVersion(meta: VersionMeta, name: string): Promise<VersionMeta> {
  const trimmed = name.trim()
  const named: VersionMeta = { ...meta, kind: 'named', name: trimmed === '' ? null : trimmed }
  await getVersionStore().update(named)
  historyRevision.value++
  await renameCloudVersion(named)
  return named
}

/** Deletes a version here and in Redrob Cloud. */
export async function deleteVersion(meta: VersionMeta): Promise<void> {
  await getVersionStore().remove(meta.id)
  historyRevision.value++
  await deleteCloudVersion(meta)
}

/** The preview saved with a local version, as PNG bytes. */
export function versionPreview(meta: VersionMeta): Promise<Uint8Array | null> {
  return getVersionStore().readPreview(meta.id)
}

function bytesOf(documentKey: string, entry: HistoryEntry): Promise<Uint8Array | null> {
  if (entry.local) return getVersionStore().readBytes(entry.local.id)
  if (entry.remoteId) return readCloudVersion(documentKey, entry.remoteId)
  return Promise.resolve(null)
}

/**
 * Restores a version in one undo step. Unsaved changes since the last
 * version are kept as a version first, so restoring never loses work.
 */
export async function restoreVersion(
  document: HistoryDocument,
  entry: HistoryEntry
): Promise<void> {
  const bytes = await bytesOf(threadKeyFor(document), entry)
  if (!bytes) throw new Error('This version is no longer on this computer')
  if (versionedAt.get(document) !== document.state.sceneVersion) {
    await saveDocumentVersion(document, 'auto')
  }
  await restoreDocumentBytes(document, bytes, RESTORE_LABEL)
  versionedAt.set(document, document.state.sceneVersion)
}
