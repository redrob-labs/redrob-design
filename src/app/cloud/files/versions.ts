import { open, seal } from '@/app/cloud/crypto'
import {
  ConsoleError,
  consoleClient,
  type ConsoleVersionSummary,
  type FileVersionSummary
} from '@/app/integrations/console'

import { downloadBlob, uploadBlob } from './blob'
import { contentKey } from './keyring'
import { openText, sealText } from './sealed'

/**
 * Versions of a shared file: each a sealed `.fig` in the bucket, with a sealed name. Opened here
 * into the plain shape History shows.
 */
export const MAX_VERSION_BYTES = 256 * 1024 * 1024

async function plainName(fileId: string, remote: FileVersionSummary): Promise<string | null> {
  if (!remote.encryptedName) return null
  try {
    const key = await contentKey(fileId, remote.epoch)
    return await openText(key, { fileId, purpose: { kind: 'version-name' } }, remote.encryptedName)
  } catch {
    return null
  }
}

async function summaryOf(
  fileId: string,
  remote: FileVersionSummary
): Promise<ConsoleVersionSummary> {
  return {
    id: remote.id,
    documentId: fileId,
    kind: remote.kind,
    name: await plainName(fileId, remote),
    createdAt: remote.createdAt,
    revision: remote.revision,
    size: remote.size,
    createdBy: { id: remote.createdBy.id ?? 'unknown', name: remote.createdBy.name }
  }
}

async function sealedName(
  fileId: string,
  epoch: number,
  name: string | null
): Promise<string | null> {
  if (!name) return null
  const key = await contentKey(fileId, epoch)
  return sealText(key, { fileId, epoch, purpose: { kind: 'version-name' } }, name)
}

export async function listFileVersions(
  fileId: string,
  link?: string
): Promise<ConsoleVersionSummary[]> {
  const out: ConsoleVersionSummary[] = []
  let cursor: string | undefined
  do {
    const { data } = await consoleClient().call('listVersions', {
      params: { fileId },
      query: { cursor },
      link
    })
    for (const remote of data.items) out.push(await summaryOf(fileId, remote))
    cursor = data.nextCursor ?? undefined
  } while (cursor)
  return out
}

/** Seals and uploads a version, then records it. Returns its id at Console. */
export async function uploadFileVersion(
  fileId: string,
  epoch: number,
  version: {
    kind: 'auto' | 'named'
    name: string | null
    revision: number
    bytes: Uint8Array<ArrayBuffer>
  }
): Promise<string> {
  const client = consoleClient()
  const key = await contentKey(fileId, epoch)
  const sealed = await seal(key, { fileId, epoch, purpose: { kind: 'version' } }, version.bytes)
  const { data: ticket } = await client.call('createUpload', {
    params: { fileId },
    body: { kind: 'version', size: sealed.byteLength }
  })
  await uploadBlob(ticket.upload, sealed)
  const kind = version.kind === 'named' && version.name ? 'named' : 'auto'
  const { data } = await client.call('createVersion', {
    params: { fileId },
    body: {
      uploadId: ticket.uploadId,
      kind,
      encryptedName: kind === 'named' ? await sealedName(fileId, epoch, version.name) : null,
      revision: version.revision,
      epoch
    }
  })
  return data.id
}

export async function renameFileVersion(
  fileId: string,
  epoch: number,
  versionId: string,
  name: string | null
): Promise<void> {
  await consoleClient().call('renameVersion', {
    params: { fileId, versionId },
    body: { encryptedName: await sealedName(fileId, epoch, name) }
  })
}

/** Deletes a version; one already gone counts as deleted. */
export async function deleteFileVersion(fileId: string, versionId: string): Promise<void> {
  try {
    await consoleClient().call('deleteVersion', { params: { fileId, versionId } })
  } catch (error) {
    if (!(error instanceof ConsoleError && error.kind === 'not-found')) throw error
  }
}

/** The `.fig` bytes of a version, downloaded and opened. */
export async function readFileVersion(
  fileId: string,
  versionId: string,
  link?: string
): Promise<Uint8Array> {
  const { data } = await consoleClient().call('getVersion', { params: { fileId, versionId }, link })
  const sealed = await downloadBlob(data.url, MAX_VERSION_BYTES)
  const key = await contentKey(fileId, data.epoch)
  return open(key, { fileId, purpose: { kind: 'version' } }, sealed)
}
