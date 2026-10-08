import * as Y from 'yjs'

import { createYjsGraphSync, registerYjsObservers } from '@/app/collab/yjs-sync'
import type { EditorStore } from '@/app/editor/active-store'

/**
 * A document as a shared file holds it: the Yjs state of its nodes and images, in the same shape
 * live collaboration uses, so a snapshot and a session are one format.
 */
export function encodeGraphState(store: EditorStore): Uint8Array<ArrayBuffer> {
  const ydoc = new Y.Doc()
  try {
    const sync = createYjsGraphSync({
      getStore: () => store,
      getYdoc: () => ydoc,
      getYnodes: () => ydoc.getMap('nodes'),
      getYimages: () => ydoc.getMap('images'),
      setSuppressYjsEvents: () => undefined
    })
    sync.syncAllNodesToYjs()
    return new Uint8Array(Y.encodeStateAsUpdate(ydoc))
  } finally {
    ydoc.destroy()
  }
}

/** Builds a document from a snapshot's state, through the same path remote changes take. */
export function applyGraphState(store: EditorStore, state: Uint8Array): void {
  const ydoc = new Y.Doc()
  try {
    const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes')
    const yimages = ydoc.getMap<Uint8Array>('images')
    const sync = createYjsGraphSync({
      getStore: () => store,
      getYdoc: () => ydoc,
      getYnodes: () => ynodes,
      getYimages: () => yimages,
      setSuppressYjsEvents: () => undefined
    })
    registerYjsObservers({
      store,
      ynodes,
      yimages,
      getSuppressYjsEvents: () => false,
      setSuppressGraphSync: () => undefined,
      applyYjsToGraph: sync.applyYjsToGraph
    })
    Y.applyUpdate(ydoc, state, 'remote')
  } finally {
    ydoc.destroy()
  }
}
