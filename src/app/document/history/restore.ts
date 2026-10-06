import { parseFigFile } from '@redrob-design/core/io/formats/fig'
import type { SceneGraph, UndoEntry } from '@redrob-design/scene-graph'

import { prepareImportedGraph } from '@/app/document/io/imported-document'

/** The part of an editor store a restore needs. */
export interface RestoreTarget {
  graph: SceneGraph
  state: { currentPageId: string }
  replaceGraph(graph: SceneGraph): void
  switchPage(pageId: string): unknown
  pushUndoEntry(entry: UndoEntry): void
}

/**
 * Puts a saved version in place of the document as one undo step: Undo
 * brings back the document as it was, Redo the version again. The page in
 * view stays in view when the version has it.
 */
export async function restoreDocumentBytes(
  target: RestoreTarget,
  figBytes: Uint8Array,
  label: string
): Promise<void> {
  const restored = await parseFigFile(Uint8Array.from(figBytes).buffer, { populate: 'all' })
  const firstPageId = await prepareImportedGraph(restored)
  const before = target.graph
  const beforePageId = target.state.currentPageId
  const afterPageId = restored.getNode(beforePageId)?.type === 'CANVAS' ? beforePageId : firstPageId
  const show = (graph: SceneGraph, pageId: string) => {
    target.replaceGraph(graph)
    if (target.state.currentPageId !== pageId) void target.switchPage(pageId)
  }
  show(restored, afterPageId)
  target.pushUndoEntry({
    label,
    forward: () => show(restored, afterPageId),
    inverse: () => show(before, beforePageId)
  })
}
