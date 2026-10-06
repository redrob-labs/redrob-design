import { decodeBase64, encodeBase64 } from '@redrob-design/core/bytes'
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

import {
  ConsoleError,
  activeWorkspaceId,
  consoleClient,
  type ConsoleClient
} from '@/app/integrations/console'

import { decodeRevision, encodeRevision } from './codec'

/** The message the library service and dialogs already show for a stale publish. */
const CONFLICT_MESSAGE = 'Library revision conflict: latest revision has changed'

export interface ConsoleLibraryCatalogOptions {
  workspaceId?: () => string | null
  client?: () => ConsoleClient
}

/**
 * The signed-in workspace's libraries in Redrob Cloud. Every member reads
 * the same catalog; publishing a revision names the one it replaces, and
 * If-Match or If-None-Match keeps two people from overwriting each other.
 */
export class ConsoleLibraryCatalog implements LibraryCatalog {
  readonly #workspaceId: () => string | null
  readonly #client: () => ConsoleClient

  constructor(options: ConsoleLibraryCatalogOptions = {}) {
    this.#workspaceId = options.workspaceId ?? (() => activeWorkspaceId.value)
    this.#client = options.client ?? consoleClient
  }

  #workspace(): string {
    const workspaceId = this.#workspaceId()
    if (!workspaceId) throw new Error('Sign in to Redrob Cloud to use workspace libraries')
    return workspaceId
  }

  async listLibraries(): Promise<LibrarySummary[]> {
    const workspaceId = this.#workspace()
    const summaries: LibrarySummary[] = []
    let cursor: string | undefined
    do {
      const { data } = await this.#client().call('listLibraries', {
        params: { workspaceId },
        query: { cursor }
      })
      summaries.push(...data.items)
      cursor = data.nextCursor ?? undefined
    } while (cursor)
    return summaries.sort((left, right) => left.name.localeCompare(right.name))
  }

  async getRevision(libraryId: string, revisionId?: string): Promise<ComponentLibraryRevision> {
    const { data } = await this.#client().call('getLibraryRevision', {
      params: { workspaceId: this.#workspace(), libraryId, revisionId: revisionId ?? 'latest' }
    })
    const bytes = decodeBase64(data.payload)
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
    const workspaceId = this.#workspace()
    const revision = await createLibraryRevision(input)
    const { manifest } = revision
    const parentRevisionId = input.previousRevisionId ?? null
    try {
      await this.#client().call('publishLibraryRevision', {
        params: { workspaceId, libraryId: manifest.libraryId },
        body: {
          revisionId: manifest.revisionId,
          name: manifest.name,
          publishedAt: manifest.publishedAt,
          assetCount: manifest.assets.length,
          parentRevisionId,
          payload: encodeBase64(encodeRevision(revision))
        },
        ifMatch: parentRevisionId ? `"${parentRevisionId}"` : undefined,
        ifNoneMatch: parentRevisionId ? undefined : '*'
      })
    } catch (error) {
      if (error instanceof ConsoleError && error.kind === 'conflict') {
        throw new Error(CONFLICT_MESSAGE, { cause: error })
      }
      throw error
    }
    return revision
  }
}
