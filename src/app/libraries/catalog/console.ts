import {
  createLibraryRevision,
  MAX_LIBRARY_REVISION_BYTES,
  validateLibraryRevision
} from '@redrob-design/core/library'
import type {
  ComponentLibraryRevision,
  LibraryCatalog,
  LibrarySummary,
  PublishLibraryInput
} from '@redrob-design/core/library'

import { open, seal } from '@/app/cloud/crypto'
import {
  CloudKeyPendingError,
  activeCloudFile,
  canEditFile,
  contentKey,
  openText,
  sealText,
  type CloudFileBinding
} from '@/app/cloud/files'
import { downloadBlob, uploadBlob } from '@/app/cloud/files/blob'
import {
  ConsoleError,
  consoleClient,
  type ConsoleClient,
  type FileLibrarySummary
} from '@/app/integrations/console'

import { decodeRevision, encodeRevision } from './codec'

/** The message the library service and dialogs already show for a stale publish. */
const CONFLICT_MESSAGE = 'Library revision conflict: latest revision has changed'

export interface ConsoleLibraryCatalogOptions {
  /** The shared file publishing; null when the open document is not one. */
  publishingFile?: () => CloudFileBinding | null
  client?: () => ConsoleClient
}

/**
 * Libraries in Redrob Cloud. A library is published from a shared file and sealed with its key, so
 * the people who can open that file are the people who can use it. Everyone signed in sees the
 * libraries of every file they can open; publishing names the revision it replaces, and a stale
 * publish is refused.
 */
export class ConsoleLibraryCatalog implements LibraryCatalog {
  readonly #publishingFile: () => CloudFileBinding | null
  readonly #client: () => ConsoleClient
  /** Which file each library is sealed with, learned from the list. */
  readonly #fileOf = new Map<string, string>()

  constructor(options: ConsoleLibraryCatalogOptions = {}) {
    this.#publishingFile = options.publishingFile ?? (() => activeCloudFile.value)
    this.#client = options.client ?? consoleClient
  }

  async #summary(remote: FileLibrarySummary): Promise<LibrarySummary | null> {
    try {
      const key = await contentKey(remote.fileId, remote.epoch)
      const name = await openText(
        key,
        { fileId: remote.fileId, purpose: { kind: 'library-name' } },
        remote.encryptedName
      )
      this.#fileOf.set(remote.libraryId, remote.fileId)
      return {
        libraryId: remote.libraryId,
        name,
        latestRevisionId: remote.latestRevisionId,
        publishedAt: remote.publishedAt,
        assetCount: remote.assetCount
      }
    } catch (error) {
      // A library from a file this computer has no key for yet is not usable here yet.
      if (!(error instanceof CloudKeyPendingError)) {
        console.warn('[Libraries] Skipped a library that did not open with its file key', error)
      }
      return null
    }
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    const summaries: LibrarySummary[] = []
    let cursor: string | undefined
    do {
      const { data } = await this.#client().call('listLibraries', { query: { cursor } })
      for (const remote of data.items) {
        const summary = await this.#summary(remote)
        if (summary) summaries.push(summary)
      }
      cursor = data.nextCursor ?? undefined
    } while (cursor)
    return summaries.sort((left, right) => left.name.localeCompare(right.name))
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    const { data } = await this.#client().call('getLibraryRevision', {
      params: { libraryId, revisionId: revisionId ?? 'latest' }
    })
    const fileId = data.summary.fileId
    const known = this.#fileOf.get(libraryId)
    if (known && known !== fileId) throw new Error('Library revision identity mismatch')
    const sealed = await downloadBlob(data.url, MAX_LIBRARY_REVISION_BYTES * 2)
    const key = await contentKey(fileId, data.epoch)
    const bytes = await open(key, { fileId, purpose: { kind: 'library' } }, sealed)
    if (bytes.byteLength > MAX_LIBRARY_REVISION_BYTES) {
      throw new Error('Component library revision exceeds size limit')
    }
    const revision = decodeRevision(bytes)
    if (
      revision.manifest.libraryId !== libraryId ||
      revision.manifest.revisionId !== data.revisionId
    ) {
      throw new Error('Library revision identity mismatch')
    }
    await validateLibraryRevision(revision)
    return revision
  }

  async publishRevision(input: PublishLibraryInput): Promise<ComponentLibraryRevision> {
    const file = this.#publishingFile()
    if (!file) throw new Error('Share this file first; libraries are published from shared files')
    if (!canEditFile(file.role)) throw new Error('You can view this file but not publish from it')
    const revision = await createLibraryRevision(input)
    const { manifest } = revision
    const { fileId, epoch } = file
    const key = await contentKey(fileId, epoch)
    const sealed = await seal(
      key,
      { fileId, epoch, purpose: { kind: 'library' } },
      new Uint8Array(encodeRevision(revision))
    )
    const client = this.#client()
    const { data: ticket } = await client.call('createUpload', {
      params: { fileId },
      body: { kind: 'library', size: sealed.byteLength }
    })
    await uploadBlob(ticket.upload, sealed)
    try {
      await client.call('publishLibraryRevision', {
        params: { libraryId: manifest.libraryId },
        body: {
          fileId,
          uploadId: ticket.uploadId,
          revisionId: manifest.revisionId,
          parentRevisionId: input.previousRevisionId ?? null,
          encryptedName: await sealText(
            key,
            { fileId, epoch, purpose: { kind: 'library-name' } },
            manifest.name
          ),
          assetCount: manifest.assets.length,
          epoch,
          publishedAt: manifest.publishedAt
        }
      })
    } catch (error) {
      if (error instanceof ConsoleError && error.kind === 'conflict') {
        throw new Error(CONFLICT_MESSAGE, { cause: error })
      }
      throw error
    }
    this.#fileOf.set(manifest.libraryId, fileId)
    return revision
  }
}
