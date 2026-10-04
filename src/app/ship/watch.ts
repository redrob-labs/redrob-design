import type { UIMessage } from 'ai'

import type { SceneGraph } from '@redrob-design/scene-graph'

import { beginChangeTurn, finishChangeTurn, type ChangeOwner } from '@/app/assistant/changes/store'
import { DEMO_WORKSPACE } from '@/app/memory/demo'
import { demoMode } from '@/app/runtime/demo'

/** The sources a shipped page watches, or null when no workspace is connected. */
export function watchedSources(): string[] | null {
  return demoMode.value ? [DEMO_WORKSPACE.sources[2], DEMO_WORKSPACE.sources[0]] : null
}

/** The demo's price sheet change: Team moves from $24 to $28. */
const DEMO_PRICE_CHANGE = { from: '$24', to: '$28' } as const

interface WatchTarget extends ChangeOwner {
  graph: SceneGraph
}

let updateCount = 0

/**
 * Demo only. The watched price sheet changes, so the page proposes its own
 * update: every text layer that shows the old price, as one answer with
 * Keep it and Put it back. Null outside demo mode.
 */
export function simulatePriceSheetChange(
  target: WatchTarget,
  words: { changed: string; nothing: string }
): UIMessage | null {
  if (!demoMode.value) return null
  const id = `update-${Date.now()}-${++updateCount}`
  const pageId = target.state.currentPageId
  beginChangeTurn(target)
  let changed = 0
  const walk = (nodeId: string) => {
    const node = target.graph.getNode(nodeId)
    if (!node) return
    if (node.type === 'TEXT' && node.text.includes(DEMO_PRICE_CHANGE.from)) {
      target.graph.updateNode(node.id, {
        text: node.text.replaceAll(DEMO_PRICE_CHANGE.from, DEMO_PRICE_CHANGE.to)
      })
      changed++
    }
    for (const childId of node.childIds) walk(childId)
  }
  walk(pageId)
  finishChangeTurn(target, changed > 0 ? id : undefined)
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text: changed > 0 ? words.changed : words.nothing }]
  }
}
