import { assistantControlsFor } from '@/app/assistant/controls/store'
import { loadThread, threadKeyFor } from '@/app/assistant/thread/store'
import type { EditorStore } from '@/app/editor/active-store'
import { designMemoryBrief, designMemorySource } from '@/app/memory/service'

import { buildHandoff, type HandoffBundle } from './bundle'

/** Largest preview edge; enough to read the layout, small enough to keep the bundle light. */
const PREVIEW_SCALE = 1

/** Everything Claude Code needs from one page of the active document. */
export async function prepareHandoff(store: EditorStore, pageId: string): Promise<HandoffBundle> {
  const frames = store.graph.getChildren(pageId).filter((node) => node.visible)
  let preview: Uint8Array | null = null
  if (frames.length > 0) {
    try {
      preview = await store.renderExportImage(
        frames.map((node) => node.id),
        PREVIEW_SCALE,
        'PNG',
        pageId
      )
    } catch {
      preview = null
    }
  }
  const memory =
    assistantControlsFor(store).memory === 'none'
      ? ''
      : designMemoryBrief(designMemorySource().read(store.graph, store.state.documentName))
  return buildHandoff({
    graph: store.graph,
    pageId,
    messages: await loadThread(threadKeyFor(store)),
    memory,
    preview
  })
}
