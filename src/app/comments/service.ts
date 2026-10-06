import { useIntervalFn } from '@vueuse/core'
import { ref, watch, watchEffect } from 'vue'

import { threadKeyFor } from '@/app/assistant/thread/store'
import { activeCloudFile } from '@/app/cloud/files'
import { signedIn } from '@/app/integrations/console'
import { activeTab } from '@/app/tabs'

import { commentPinsFor } from './pins'
import { activeThreadId, commentsByDocument, loadComments, threadsFor } from './store'
import { syncComments } from './sync'
import type { CommentAnchor } from './types'

/** How often an open document reads and sends comments while signed in. */
export const COMMENT_SYNC_MS = 30_000

/** Clicking the canvas places a comment while this is on. */
export const commentMode = ref(false)
/** Where the comment being written will go, until it is posted or dropped. */
export const draftAnchor = ref<CommentAnchor | null>(null)
/** Whether the comments list is open; resolved threads show their pins while it is. */
export const commentsPanelOpen = ref(false)

export function openComments(): void {
  commentsPanelOpen.value = true
}

/** Turns on placing: the next click on the canvas starts a thread there. */
export function startCommenting(): void {
  commentsPanelOpen.value = false
  activeThreadId.value = null
  commentMode.value = true
}

export function stopCommenting(): void {
  commentMode.value = false
  draftAnchor.value = null
}

function activeDocument() {
  const tab = activeTab.value
  return tab?.kind === 'document' ? tab.store : null
}

/** The open document's key, for the comment UI. */
export function activeDocumentKey(): string | null {
  const store = activeDocument()
  return store ? threadKeyFor(store) : null
}

function syncActive(): void {
  const key = activeDocumentKey()
  if (key) void syncComments(key)
}

let started = false

/**
 * Loads the open document's comments, keeps its canvas pins current, and
 * syncs with Redrob Cloud while signed in.
 */
export function startComments(): void {
  if (started) return
  started = true
  watch(
    () => activeDocumentKey(),
    (key) => {
      stopCommenting()
      activeThreadId.value = null
      if (key) void loadComments(key).then(() => syncComments(key))
    },
    { immediate: true }
  )
  const polling = useIntervalFn(syncActive, COMMENT_SYNC_MS, { immediate: false })
  // Shared files sync, signed in or through a view link; a file on this computer has nothing to.
  watch(
    () => Boolean(activeCloudFile.value && (signedIn.value || activeCloudFile.value.link)),
    (shared) => {
      if (shared) {
        polling.resume()
        syncActive()
      } else polling.pause()
    },
    { immediate: true }
  )
  watchEffect(() => {
    const store = activeDocument()
    if (!store) return
    const key = threadKeyFor(store)
    // Pins follow their layers as they move, so they read the scene version.
    void store.state.sceneVersion
    void commentsByDocument.get(key)
    store.state.commentPins = commentPinsFor(
      store.graph,
      store.state.currentPageId,
      threadsFor(key),
      {
        activeId: activeThreadId.value,
        showResolved: commentsPanelOpen.value,
        draft: draftAnchor.value
      }
    )
    store.requestRepaint()
  })
}
