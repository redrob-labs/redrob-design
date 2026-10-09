import type { EditorState } from '@redrob-design/core/editor'

type ExportListener = (state: EditorState) => void

const listeners = new Set<ExportListener>()

/** Called after an export reached the person (a download or a saved file), with its editor state. */
export function onDocumentExported(listener: ExportListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function emitDocumentExported(state: EditorState): void {
  for (const listener of listeners) listener(state)
}
