import { createEditor, type Editor } from '@redrob-design/core/editor'
import type { SceneGraph, SceneNode } from '@redrob-design/scene-graph'

import { loadFont } from '@/app/editor/fonts'
import type { EditorPreparationHandle as DocumentLoadSession } from '@/app/editor/preparation/types'

/**
 * Loads fonts, lazy content and layout for an imported graph's first page
 * before it is shown. Returns that page's id.
 */
export async function prepareImportedGraph(
  imported: SceneGraph,
  load?: DocumentLoadSession
): Promise<string> {
  const firstPage = imported.getPages()[0] as SceneNode | undefined
  const pageId = firstPage?.id ?? imported.rootId
  const stagingEditor = createEditor({
    graph: imported,
    loadFont,
    skipInitialGraphSetup: true
  })
  try {
    load?.update({ phase: 'populating-page', detail: firstPage?.name ?? null })
    const prepared = await stagingEditor.preparePage(pageId, {
      signal: load?.signal,
      onProgress: (progress) => load?.update(progress)
    })
    load?.signal.throwIfAborted()
    if (!prepared) throw new Error('Imported page preparation was superseded')
    return pageId
  } finally {
    stagingEditor.dispose()
  }
}

export async function applyImportedDocument(
  editor: Editor,
  imported: SceneGraph,
  load?: DocumentLoadSession
) {
  await prepareImportedGraph(imported, load)
  editor.replaceGraph(imported)
  editor.undo.clear()
  editor.clearSelection()
}
