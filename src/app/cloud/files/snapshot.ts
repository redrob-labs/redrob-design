import { open, seal } from '@/app/cloud/crypto'
import { ConsoleError, consoleClient } from '@/app/integrations/console'

import { downloadBlob, uploadBlob } from './blob'
import { contentKey } from './keyring'

/**
 * A shared file's snapshot: its whole Yjs state, sealed, in the bucket. Opening a file starts from
 * it; collaborators then bring each other up to date live.
 *
 * Saving is compare-and-swap. When someone saved first, `saveSnapshot` reports their revision, and
 * the caller merges their snapshot into its own state -- the content is a CRDT, so nothing is lost
 * either way -- and saves again on top.
 */
export const MAX_SNAPSHOT_BYTES = 256 * 1024 * 1024

export type LoadedSnapshot = { revision: number; epoch: number; state: Uint8Array<ArrayBuffer> }

export async function loadSnapshot(fileId: string, link?: string): Promise<LoadedSnapshot | null> {
  let meta
  try {
    meta = (await consoleClient().call('getSnapshot', { params: { fileId }, link })).data
  } catch (error) {
    if (error instanceof ConsoleError && error.kind === 'not-found') return null
    throw error
  }
  const sealed = await downloadBlob(meta.url, MAX_SNAPSHOT_BYTES)
  const key = await contentKey(fileId, meta.epoch)
  const state = await open(key, { fileId, purpose: { kind: 'snapshot' } }, sealed)
  return { revision: meta.revision, epoch: meta.epoch, state }
}

/** Not saved means someone saved first: load their snapshot, merge it, and save on top of it. */
export type SaveOutcome = { saved: true; revision: number } | { saved: false }

/** Uploads a sealed state and commits it on top of `baseRevision`. */
export async function saveSnapshot(
  fileId: string,
  epoch: number,
  state: Uint8Array<ArrayBuffer>,
  baseRevision: number
): Promise<SaveOutcome> {
  const client = consoleClient()
  const key = await contentKey(fileId, epoch)
  const sealed = await seal(key, { fileId, epoch, purpose: { kind: 'snapshot' } }, state)
  const { data: ticket } = await client.call('createUpload', {
    params: { fileId },
    body: { kind: 'snapshot', size: sealed.byteLength }
  })
  await uploadBlob(ticket.upload, sealed)
  try {
    const { data } = await client.call('commitSnapshot', {
      params: { fileId },
      body: { uploadId: ticket.uploadId, baseRevision, epoch }
    })
    return { saved: true, revision: data.revision }
  } catch (error) {
    if (error instanceof ConsoleError && error.kind === 'conflict') return { saved: false }
    throw error
  }
}
