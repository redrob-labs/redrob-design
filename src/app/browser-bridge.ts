import type { ChatTransport, UIMessage } from 'ai'

import { beginChangeTurn, finishChangeTurn } from '@/app/assistant/changes/store'
import type { CrossCheckDependencies } from '@/app/assistant/cross-check/run'
import type { CollabReturn } from '@/app/collab/context'
import type { EditorStore } from '@/app/editor/session/create'
import { createNavigationBenchmarkHooks } from '@/app/performance/navigation/hooks'
import type { NavigationBenchmarkHooks } from '@/app/performance/navigation/hooks'
import { appRuntimeConfig } from '@/app/runtime/config'
import { IS_BROWSER } from '@/constants'

export interface RedrobDesignTestHooks {
  writeCount?: () => number
  mockHandle?: FileSystemFileHandle
  savedOpen?: Window['open']
  navigation?: NavigationBenchmarkHooks
  /** Opens and closes an answer's change turn, as the tool loop does. */
  changeTurn?: {
    begin: () => void
    finish: (messageId: string) => void
  }
  /** Answers the next Cross-check calls with these replies, in order. */
  crossCheckReplies?: (replies: string[], reviewer: { providerID: string; modelID: string }) => void
  collab?: Pick<
    CollabReturn,
    'connect' | 'disconnect' | 'updateCursor' | 'updateSelection' | 'setLocalName'
  > & {
    peerCount: () => number
    peerSelections: () => Array<string[] | undefined>
  }
}

export interface RedrobDesignWindowAPI {
  getStore?: () => EditorStore
  setChatTransport?: (factory: () => ChatTransport<UIMessage>) => void
  openFile?: (path: string) => Promise<void>
  test?: RedrobDesignTestHooks
}

declare global {
  interface Window {
    redrobDesign?: RedrobDesignWindowAPI
  }
}

let activeStore: EditorStore | null = null

function windowAPI(): RedrobDesignWindowAPI {
  window.redrobDesign ??= {}
  window.redrobDesign.getStore ??= () => {
    if (!activeStore) throw new Error('Redrob Design store not initialized')
    return activeStore
  }
  return window.redrobDesign
}

export function setRedrobDesignStore(store: EditorStore) {
  activeStore = store
  if (!IS_BROWSER) return
  const api = windowAPI()
  if (appRuntimeConfig.navigationBenchmark) {
    const testHooks = (api.test ??= {})
    testHooks.navigation = createNavigationBenchmarkHooks(store)
  }
  // Dev only, like the chat transport override the chat tests already use.
  if (import.meta.env.DEV) {
    const testHooks = (api.test ??= {})
    testHooks.changeTurn = {
      begin: () => beginChangeTurn(store),
      finish: (messageId) => finishChangeTurn(store, messageId)
    }
  }
}

export function exposeCollaborationActions(collab: CollabReturn) {
  if (!IS_BROWSER || !import.meta.env.DEV) return
  if (!appRuntimeConfig.test) return
  const testHooks = (windowAPI().test ??= {})
  testHooks.collab = {
    connect: collab.connect,
    disconnect: collab.disconnect,
    updateCursor: collab.updateCursor,
    updateSelection: collab.updateSelection,
    setLocalName: collab.setLocalName,
    peerCount: () => collab.remotePeers.value.length,
    peerSelections: () => collab.remotePeers.value.map((peer) => peer.selection)
  }
}

export function exposeChatTransportOverride(
  setChatTransport: (factory: () => ChatTransport<UIMessage>) => void
) {
  windowAPI().setChatTransport = setChatTransport
}

/**
 * Dev only: the chat tests answer Cross-check with fixed replies from a fake
 * Review model, so the card can be checked without a real one.
 */
export function exposeCrossCheckOverride(
  setDependencies: (next: CrossCheckDependencies | null) => void
) {
  if (!IS_BROWSER || !import.meta.env.DEV) return
  const testHooks = (windowAPI().test ??= {})
  testHooks.crossCheckReplies = (replies, reviewer) => {
    const queue = [...replies]
    setDependencies({
      createRuntime: () =>
        Promise.resolve({
          model: reviewer.modelID,
          providerID: reviewer.providerID,
          modelID: reviewer.modelID
        }),
      generate: () => Promise.resolve({ text: queue.shift() ?? 'NONE' })
    })
  }
}

export function setRedrobDesignOpenFileHandler(openFile: (path: string) => Promise<void>) {
  windowAPI().openFile = openFile
}
