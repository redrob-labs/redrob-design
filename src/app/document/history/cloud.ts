import { cloudFileIdOf } from '@/app/assistant/thread/store'
import {
  MAX_VERSION_BYTES,
  canEditFile,
  cloudBindingForKey,
  deleteFileVersion,
  listFileVersions,
  readFileVersion,
  renameFileVersion,
  uploadFileVersion
} from '@/app/cloud/files'
import type { ConsoleVersionSummary } from '@/app/integrations/console'

import type { VersionMeta, VersionStore } from './types'

/**
 * Versions in Redrob Cloud, for shared files only: a file on this computer keeps its versions on
 * this computer. Each is a sealed `.fig` uploaded on a presigned link, with a sealed name; editors
 * and owners save them, and everyone with access can list and open them.
 */
export const MAX_CLOUD_VERSION_BYTES = MAX_VERSION_BYTES

function sharedFile(documentKey: string) {
  const fileId = cloudFileIdOf(documentKey)
  const binding = fileId ? cloudBindingForKey(documentKey) : null
  return binding && fileId === binding.fileId ? binding : null
}

/** Versions Redrob Cloud keeps for the file, newest first; empty for a file on this computer. */
export async function listCloudVersions(documentKey: string): Promise<ConsoleVersionSummary[]> {
  const binding = sharedFile(documentKey)
  if (!binding) return []
  return listFileVersions(binding.fileId, binding.link ?? undefined)
}

/** Uploads a local version Redrob Cloud does not have yet. Editors and owners only. */
export async function uploadVersion(store: VersionStore, meta: VersionMeta): Promise<VersionMeta> {
  const binding = sharedFile(meta.documentKey)
  if (!binding || !canEditFile(binding.role) || meta.remoteId) return meta
  if (meta.byteLength > MAX_CLOUD_VERSION_BYTES) return meta
  const bytes = await store.readBytes(meta.id)
  if (!bytes) return meta
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const remoteId = await uploadFileVersion(binding.fileId, binding.epoch, {
    kind: meta.kind,
    name: meta.name,
    revision: binding.revision,
    bytes: copy
  })
  const uploaded = { ...meta, remoteId }
  await store.update(uploaded)
  return uploaded
}

/** Uploads every local version Redrob Cloud is missing, oldest first. */
export async function uploadPendingVersions(
  store: VersionStore,
  documentKey: string
): Promise<number> {
  const binding = sharedFile(documentKey)
  if (!binding || !canEditFile(binding.role)) return 0
  const pending = (await store.list(documentKey))
    .filter((meta) => !meta.remoteId && meta.byteLength <= MAX_CLOUD_VERSION_BYTES)
    .toReversed()
  for (const meta of pending) await uploadVersion(store, meta)
  return pending.length
}

/** Names a version in Redrob Cloud too, which keeps it past retention there. */
export async function renameCloudVersion(meta: VersionMeta): Promise<void> {
  const binding = sharedFile(meta.documentKey)
  if (!binding || !canEditFile(binding.role) || !meta.remoteId) return
  await renameFileVersion(binding.fileId, binding.epoch, meta.remoteId, meta.name)
}

/** Deletes a version from Redrob Cloud; one already gone counts as deleted. */
export async function deleteCloudVersion(meta: VersionMeta): Promise<void> {
  const binding = sharedFile(meta.documentKey)
  if (!binding || !canEditFile(binding.role) || !meta.remoteId) return
  await deleteFileVersion(binding.fileId, meta.remoteId)
}

/** The `.fig` bytes of a version only Redrob Cloud has. */
export async function readCloudVersion(
  documentKey: string,
  versionId: string
): Promise<Uint8Array> {
  const binding = sharedFile(documentKey)
  if (!binding) throw new Error('This version is in Redrob Cloud; open the shared file to read it')
  return readFileVersion(binding.fileId, versionId, binding.link ?? undefined)
}
