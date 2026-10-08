import type { VersionMeta, VersionStore } from './types'

/** Versions kept for this session only, where IndexedDB is unavailable and in tests. */
export function createMemoryVersionStore(): VersionStore {
  const metas = new Map<string, VersionMeta>()
  const figs = new Map<string, Uint8Array>()
  const previews = new Map<string, Uint8Array>()
  return {
    list: (documentKey) =>
      Promise.resolve(
        [...metas.values()]
          .filter((meta) => meta.documentKey === documentKey)
          .map((meta) => ({ ...meta }))
          .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
      ),
    readBytes: (id) => Promise.resolve(figs.get(id)?.slice() ?? null),
    readPreview: (id) => Promise.resolve(previews.get(id)?.slice() ?? null),
    write: (meta, figBytes, preview) => {
      metas.set(meta.id, { ...meta })
      figs.set(meta.id, figBytes.slice())
      if (preview) previews.set(meta.id, preview.slice())
      return Promise.resolve()
    },
    update: (meta) => {
      if (metas.has(meta.id)) metas.set(meta.id, { ...meta })
      return Promise.resolve()
    },
    remove: (id) => {
      metas.delete(id)
      figs.delete(id)
      previews.delete(id)
      return Promise.resolve()
    }
  }
}
