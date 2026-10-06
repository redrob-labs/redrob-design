import { decodeBase64, encodeBase64 } from '@redrob-design/core/bytes'

import {
  ConsoleError,
  consoleClient,
  consoleDocumentId,
  signedIn,
  type ConsoleVersionSummary
} from '@/app/integrations/console'

import type { VersionMeta, VersionStore } from './types'

/** Larger versions stay on this computer; Console answers carry them as base64. */
export const MAX_CLOUD_VERSION_BYTES = 32 * 1024 * 1024

/** The last version-list ETag seen per Console document id. */
const listETags = new Map<string, string>()

function isConflict(error: unknown): boolean {
  return error instanceof ConsoleError && error.kind === 'conflict'
}

function isMissing(error: unknown): boolean {
  return error instanceof ConsoleError && error.kind === 'not-found'
}

/** Versions Redrob Cloud keeps for the document, newest first; empty signed out. */
export async function listCloudVersions(documentKey: string): Promise<ConsoleVersionSummary[]> {
  if (!signedIn.value) return []
  const documentId = await consoleDocumentId(documentKey)
  const { data, etag } = await consoleClient().call('listVersions', { params: { documentId } })
  if (etag) listETags.set(documentId, etag)
  return data.items
}

async function freshETag(documentId: string): Promise<string | undefined> {
  const { etag } = await consoleClient().call('listVersions', { params: { documentId } })
  if (etag) listETags.set(documentId, etag)
  return etag ?? undefined
}

/**
 * Uploads a local version that Redrob Cloud does not have yet. If-Match
 * carries the list ETag last seen; another device saving first means one
 * fresh read and one retry, so two computers never overwrite each other's list.
 */
export async function uploadVersion(store: VersionStore, meta: VersionMeta): Promise<VersionMeta> {
  if (!signedIn.value || meta.remoteId || meta.byteLength > MAX_CLOUD_VERSION_BYTES) return meta
  const bytes = await store.readBytes(meta.id)
  if (!bytes) return meta
  const documentId = await consoleDocumentId(meta.documentKey)
  const body = {
    kind: meta.kind,
    name: meta.name,
    revision: meta.sceneVersion,
    snapshot: encodeBase64(bytes)
  }
  const create = (ifMatch: string | undefined) =>
    consoleClient().call('createVersion', { params: { documentId }, body, ifMatch })
  let response
  try {
    response = await create(listETags.get(documentId) ?? (await freshETag(documentId)))
  } catch (error) {
    if (!isConflict(error)) throw error
    response = await create(await freshETag(documentId))
  }
  if (response.etag) listETags.set(documentId, response.etag)
  const uploaded = { ...meta, remoteId: response.data.id }
  await store.update(uploaded)
  return uploaded
}

/** Uploads every local version Redrob Cloud is missing, oldest first. */
export async function uploadPendingVersions(
  store: VersionStore,
  documentKey: string
): Promise<number> {
  if (!signedIn.value) return 0
  const pending = (await store.list(documentKey))
    .filter((meta) => !meta.remoteId && meta.byteLength <= MAX_CLOUD_VERSION_BYTES)
    .toReversed()
  for (const meta of pending) await uploadVersion(store, meta)
  return pending.length
}

/** Names a version in Redrob Cloud too, which keeps it past retention there. */
export async function renameCloudVersion(meta: VersionMeta): Promise<void> {
  if (!signedIn.value || !meta.remoteId) return
  const documentId = await consoleDocumentId(meta.documentKey)
  await consoleClient().call('renameVersion', {
    params: { documentId, versionId: meta.remoteId },
    body: { name: meta.name }
  })
}

/** Deletes a version from Redrob Cloud; one already gone counts as deleted. */
export async function deleteCloudVersion(meta: VersionMeta): Promise<void> {
  if (!signedIn.value || !meta.remoteId) return
  const documentId = await consoleDocumentId(meta.documentKey)
  try {
    await consoleClient().call('deleteVersion', {
      params: { documentId, versionId: meta.remoteId }
    })
  } catch (error) {
    if (!isMissing(error)) throw error
  }
}

/** The `.fig` bytes of a version only Redrob Cloud has. */
export async function readCloudVersion(
  documentKey: string,
  versionId: string
): Promise<Uint8Array> {
  const documentId = await consoleDocumentId(documentKey)
  const { data } = await consoleClient().call('getVersion', { params: { documentId, versionId } })
  return decodeBase64(data.snapshot)
}

export function resetCloudVersionsForTests(): void {
  listETags.clear()
}
