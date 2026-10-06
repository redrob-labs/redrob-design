import * as Y from 'yjs'

import { loadSnapshot, saveSnapshot, type CloudFileBinding } from '@/app/cloud/files'

/**
 * Keeps a shared file's snapshot in step with the live document, for editors: a few seconds after
 * edits stop, at least every few minutes while they continue, and when the session ends. The
 * snapshot is what the next person to open the file starts from.
 *
 * Saving is compare-and-swap. When someone else saved first, their snapshot is merged into the
 * live document -- the content is a CRDT, so nothing is lost -- and saved again on top of theirs.
 */
export const SNAPSHOT_IDLE_MS = 10_000
export const SNAPSHOT_MAX_INTERVAL_MS = 120_000
const MAX_ATTEMPTS = 3

export interface SnapshotKeeper {
  /** A local edit happened. */
  touch(): void
  /** Saves now if anything is unsaved. */
  flush(): Promise<void>
  dispose(): void
}

export function createSnapshotKeeper(options: {
  ydoc: Y.Doc
  binding: () => CloudFileBinding
  onSaved: (revision: number) => void
  idleMs?: number
  maxIntervalMs?: number
}): SnapshotKeeper {
  const idleMs = options.idleMs ?? SNAPSHOT_IDLE_MS
  const maxIntervalMs = options.maxIntervalMs ?? SNAPSHOT_MAX_INTERVAL_MS
  let dirty = false
  let idle: ReturnType<typeof setTimeout> | null = null
  let ceiling: ReturnType<typeof setTimeout> | null = null
  let saving: Promise<void> | null = null
  let disposed = false

  function clearTimers(): void {
    if (idle) clearTimeout(idle)
    if (ceiling) clearTimeout(ceiling)
    idle = null
    ceiling = null
  }

  async function save(): Promise<void> {
    clearTimers()
    if (!dirty) return
    dirty = false
    let { fileId, epoch, revision } = options.binding()
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const state = new Uint8Array(Y.encodeStateAsUpdate(options.ydoc))
      const outcome = await saveSnapshot(fileId, epoch, state, revision)
      if (outcome.saved) {
        options.onSaved(outcome.revision)
        return
      }
      const theirs = await loadSnapshot(fileId)
      if (!theirs) return
      Y.applyUpdate(options.ydoc, theirs.state, 'remote')
      revision = theirs.revision
      epoch = theirs.epoch
      ;({ fileId } = options.binding())
    }
    dirty = true
  }

  function run(): Promise<void> {
    saving ??= save()
      .catch((error: unknown) => {
        dirty = true
        console.warn('[Collab] Could not save the shared file yet; trying again later', error)
      })
      .finally(() => {
        saving = null
      })
    return saving
  }

  return {
    touch() {
      if (disposed) return
      dirty = true
      if (idle) clearTimeout(idle)
      idle = setTimeout(() => void run(), idleMs)
      ceiling ??= setTimeout(() => void run(), maxIntervalMs)
    },
    async flush() {
      if (saving) await saving
      await run()
    },
    dispose() {
      disposed = true
      clearTimers()
    }
  }
}
