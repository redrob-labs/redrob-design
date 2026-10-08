import { tryOnScopeDispose, useLocalStorage } from '@vueuse/core'
import { computed, ref, watch } from 'vue'

import { activeCloudFile, updateCloudBinding } from '@/app/cloud/files'
import { createFollowActions } from '@/app/collab/awareness'
import { createLocalAwarenessActions } from '@/app/collab/local-awareness'
import {
  createCollabConnectionActions,
  createCollabRuntime,
  createInitialCollabState
} from '@/app/collab/session'
import { DEFAULT_COLLAB_STATE, type CollabState, type RemotePeer } from '@/app/collab/types'
import { createYjsGraphSync } from '@/app/collab/yjs-sync'
import type { EditorStore } from '@/app/editor/active-store'
import { cloudState } from '@/app/integrations/console'

export { COLLAB_KEY, useCollabInjected } from '@/app/collab/context'
export { DEFAULT_COLLAB_STATE }
export type { CollabState, RemotePeer }

/**
 * Live collaboration for the window: whenever the active tab shows a shared file, its session is
 * connected; switching to anything else leaves it, saving first.
 */
export function useCollab(storeOrGetter: EditorStore | (() => EditorStore)) {
  const getStore = () =>
    typeof storeOrGetter === 'function' ? (storeOrGetter as () => EditorStore)() : storeOrGetter
  const storedName = useLocalStorage('op-collab-name', '')
  const state = ref<CollabState>(createInitialCollabState(storedName.value))
  const runtime = createCollabRuntime()
  const remotePeers = computed(() => state.value.peers)
  const getActiveStore = () => runtime.connectedStore ?? getStore()

  const { followingPeer, followPeer, resetFollow, tickFollow } = createFollowActions(
    getActiveStore,
    () => runtime.awareness
  )
  const { broadcastAwareness, updateCursor, updateSelection, updatePeersList, setLocalName } =
    createLocalAwarenessActions({
      state,
      storedName,
      getStore: getActiveStore,
      getAwareness: () => runtime.awareness
    })

  const { syncNodeToYjs, syncAllNodesToYjs, applyYjsToGraph } = createYjsGraphSync({
    getStore: getActiveStore,
    getYdoc: () => runtime.ydoc,
    getYnodes: () => runtime.ynodes,
    getYimages: () => runtime.yimages,
    setSuppressYjsEvents: (value) => {
      runtime.suppressYjsEvents = value
    }
  })
  const { connect, disconnect, setNodeSync } = createCollabConnectionActions({
    runtime,
    state,
    callbacks: {
      updatePeersList,
      tickFollow,
      broadcastAwareness,
      applyYjsToGraph,
      syncAllNodesToYjs,
      resetFollow,
      onSaved: (store, revision) => {
        updateCloudBinding(store, { revision })
        if (runtime.binding) runtime.binding = { ...runtime.binding, revision }
      }
    }
  })
  setNodeSync(syncNodeToYjs)

  // Signed in, collaborators see the account's name unless one was typed.
  if (!state.value.localName && cloudState.account) setLocalName(cloudState.account.name)

  watch(
    () => activeCloudFile.value,
    (binding) => {
      if (!binding) {
        if (runtime.room) disconnect()
        return
      }
      if (runtime.binding?.fileId === binding.fileId && runtime.binding.role === binding.role)
        return
      // A new role is a new session: the relay admits a connection at the role it was ticketed for.
      if (runtime.room) disconnect()
      connect(getStore(), binding)
    },
    { immediate: true }
  )

  tryOnScopeDispose(disconnect)

  return {
    state,
    remotePeers,
    followingPeer,
    connect,
    disconnect,
    updateCursor,
    updateSelection,
    setLocalName,
    followPeer,
    tickFollow
  }
}
