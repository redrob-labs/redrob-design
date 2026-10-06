import type { VERSION_KINDS } from '@/app/integrations/console'

export type VersionKind = (typeof VERSION_KINDS)[number]

/** One saved version of a document on this computer. */
export interface VersionMeta {
  id: string
  /** The app's own key for the document; see `threadKeyFor`. */
  documentKey: string
  documentName: string
  /** Auto versions roll off the ring; named ones stay until deleted. */
  kind: VersionKind
  name: string | null
  createdAt: string
  sceneVersion: number
  byteLength: number
  /** The version's id in Redrob Cloud once uploaded, else null. */
  remoteId: string | null
}

export interface VersionInput {
  documentKey: string
  documentName: string
  kind: VersionKind
  name: string | null
  sceneVersion: number
  figBytes: Uint8Array
  /** A small PNG of the page, for the History list. */
  preview: Uint8Array | null
}

export interface VersionStore {
  /** Newest first. */
  list(documentKey: string): Promise<VersionMeta[]>
  readBytes(id: string): Promise<Uint8Array | null>
  readPreview(id: string): Promise<Uint8Array | null>
  write(meta: VersionMeta, figBytes: Uint8Array, preview: Uint8Array | null): Promise<void>
  update(meta: VersionMeta): Promise<void>
  remove(id: string): Promise<void>
}
