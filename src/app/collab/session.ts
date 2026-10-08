import type { Ref } from 'vue'
import * as awarenessProtocol from 'y-protocols/awareness'
import type { Awareness } from 'y-protocols/awareness'
import * as Y from 'yjs'

import { randomIndex } from '@redrob-design/core/random'

import { canEditFile, grantPendingDevices, type CloudFileBinding } from '@/app/cloud/files'
import { connectCollabRoom } from '@/app/collab/room'
import { createSnapshotKeeper, type SnapshotKeeper } from '@/app/collab/snapshots'
import { joinCloudFileRoom, type CollabRoomTransport } from '@/app/collab/transport'
import type { CollabState, CollabStatus } from '@/app/collab/types'
import { bindCollabGraphEvents, registerYjsObservers } from '@/app/collab/yjs-sync'
import type { EditorStore } from '@/app/editor/active-store'
import { PEER_COLORS } from '@/constants'

export type CollabRuntime = {
  ydoc: Y.Doc | null
  awareness: awarenessProtocol.Awareness | null
  ynodes: Y.Map<Y.Map<unknown>> | null
  yimages: Y.Map<Uint8Array> | null
  room: CollabRoomTransport | null
  snapshots: SnapshotKeeper | null
  binding: CloudFileBinding | null
  connectedStore: EditorStore | null
  suppressGraphSync: boolean
  suppressYjsEvents: boolean
  unbindGraphEvents: (() => void) | null
  stopZoomWatch: (() => void) | null
}

export type CollabCallbacks = {
  updatePeersList: () => void
  tickFollow: () => void
  broadcastAwareness: () => void
  applyYjsToGraph: (events: Y.YEvent<Y.Map<unknown>>[]) => void
  syncAllNodesToYjs: () => void
  resetFollow: () => void
  /** A snapshot was saved at this revision. */
  onSaved: (store: EditorStore, revision: number) => void
}

export function createCollabRuntime(): CollabRuntime {
  return {
    ydoc: null,
    awareness: null,
    ynodes: null,
    yimages: null,
    room: null,
    snapshots: null,
    binding: null,
    connectedStore: null,
    suppressGraphSync: false,
    suppressYjsEvents: false,
    unbindGraphEvents: null,
    stopZoomWatch: null
  }
}

export function createInitialCollabState(localName: string): CollabState {
  return {
    connected: false,
    status: 'idle',
    roomId: null,
    peers: [],
    localName,
    localColor: PEER_COLORS[randomIndex(PEER_COLORS.length)]
  }
}

export function watchAwarenessZoom(store: EditorStore, getAwareness: () => Awareness | null) {
  return store.onEditorEvent('viewport:changed', (viewport) => {
    const awareness = getAwareness()
    if (!awareness) return
    const prev = awareness.getLocalState()?.cursor as
      | { x: number; y: number; pageId: string; zoom: number }
      | undefined
    if (prev) {
      awareness.setLocalStateField('cursor', { ...prev, zoom: viewport.zoom })
    }
  })
}

/**
 * Connecting and leaving a shared file's live session. One session per window, for the active
 * tab's shared file. Editors keep the file's snapshot saved and hand its key to new devices;
 * viewers and commenters watch and show their cursor.
 */
export function createCollabConnectionActions(options: {
  runtime: CollabRuntime
  state: Ref<CollabState>
  callbacks: CollabCallbacks
}) {
  const { runtime, state, callbacks } = options

  function setStatus(status: CollabStatus): void {
    state.value.status = status
    state.value.connected = status === 'live'
  }

  function handOverKeys(binding: CloudFileBinding): void {
    if (!canEditFile(binding.role)) return
    grantPendingDevices(binding.fileId, binding.epoch).catch((error: unknown) => {
      console.warn('[Collab] Could not hand the file key to new devices yet', error)
    })
  }

  function connect(store: EditorStore, binding: CloudFileBinding): void {
    if (runtime.binding?.fileId === binding.fileId && runtime.connectedStore === store) return
    if (runtime.room) disconnect()

    const ydoc = new Y.Doc()
    const awareness = new awarenessProtocol.Awareness(ydoc)
    const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes')
    const yimages = ydoc.getMap<Uint8Array>('images')
    // Start from the snapshot's own bytes, so every collaborator shares one Yjs history.
    if (binding.seed) Y.applyUpdate(ydoc, binding.seed, 'remote')

    Object.assign(runtime, { ydoc, awareness, ynodes, yimages, binding, connectedStore: store })
    state.value.roomId = binding.fileId
    setStatus('connecting')

    awareness.on('change', () => {
      callbacks.updatePeersList()
      callbacks.tickFollow()
    })
    registerYjsObservers({
      store,
      ynodes,
      yimages,
      getSuppressYjsEvents: () => runtime.suppressYjsEvents,
      setSuppressGraphSync: (value) => {
        runtime.suppressGraphSync = value
      },
      applyYjsToGraph: callbacks.applyYjsToGraph
    })
    // Anything changed here since the snapshot was taken joins the shared history.
    if (canEditFile(binding.role)) callbacks.syncAllNodesToYjs()

    const editor = canEditFile(binding.role)
    runtime.snapshots = editor
      ? createSnapshotKeeper({
          ydoc,
          binding: () => runtime.binding ?? binding,
          onSaved: (revision) => callbacks.onSaved(store, revision)
        })
      : null
    ydoc.on('update', (_update: Uint8Array, origin: unknown) => {
      if (origin !== 'remote') runtime.snapshots?.touch()
    })

    const room = joinCloudFileRoom(binding, {
      onLive: () => {
        if (runtime.binding?.fileId === binding.fileId) setStatus('live')
        handOverKeys(binding)
      },
      onUnavailable: () => {
        if (runtime.binding?.fileId === binding.fileId) setStatus('unavailable')
      },
      onStop: (reason) => {
        if (runtime.binding?.fileId !== binding.fileId) return
        disconnect()
        setStatus(reason === 'revoked' ? 'revoked' : 'unavailable')
      }
    })
    const connection = connectCollabRoom({
      room,
      ydoc,
      awareness,
      readOnly: !editor,
      setConnected: () => handOverKeys(binding),
      updatePeersList: callbacks.updatePeersList
    })
    runtime.room = connection.room
    callbacks.broadcastAwareness()
    runtime.stopZoomWatch = watchAwarenessZoom(store, () => runtime.awareness)
    runtime.unbindGraphEvents = editor
      ? bindCollabGraphEvents({
          store,
          getYdoc: () => runtime.ydoc,
          getYnodes: () => runtime.ynodes,
          getSuppressGraphSync: () => runtime.suppressGraphSync,
          setSuppressYjsEvents: (value) => {
            runtime.suppressYjsEvents = value
          },
          syncNodeToYjs: (nodeId) => syncNode(nodeId)
        })
      : null
  }

  /** Set by `useCollab`, which owns the node codec. */
  let syncNode: (nodeId: string) => void = () => undefined
  function setNodeSync(next: (nodeId: string) => void): void {
    syncNode = next
  }

  function disconnect(): void {
    const store = runtime.connectedStore
    const snapshots = runtime.snapshots
    const ydoc = runtime.ydoc
    runtime.unbindGraphEvents?.()
    runtime.stopZoomWatch?.()
    void runtime.room?.leave()
    runtime.awareness?.destroy()
    callbacks.resetFollow()
    // Save what is unsaved, then let the document go.
    if (snapshots) {
      snapshots.dispose()
      void snapshots.flush().finally(() => ydoc?.destroy())
    } else ydoc?.destroy()
    if (store) {
      store.state.remoteCursors = []
      store.requestRender()
    }
    Object.assign(runtime, createCollabRuntime())
    state.value.roomId = null
    state.value.peers = []
    setStatus('idle')
  }

  return { connect, disconnect, setNodeSync }
}
