import { shallowReactive } from 'vue'

import { downloadBlob } from '@/app/document/io/browser'
import { isTauri } from '@/app/tauri/env'

import { HANDOFF_DIR, handoffZip, type HandoffBundle } from './bundle'

export type HandoffDelivery =
  | { kind: 'folder'; path: string }
  | { kind: 'zip'; fileName: string }
  | { kind: 'cancelled' }

/** The latest hand-off per document, which the local MCP server can serve to Claude Code. */
export const latestHandoffs = shallowReactive(new Map<string, HandoffBundle>())

/**
 * On desktop, writes the files into `.redrob/handoff/<slug>/` under a
 * repository the person picks. In the browser, downloads one zip that
 * unpacks to the same path.
 */
export async function deliverHandoff(
  documentId: string,
  bundle: HandoffBundle
): Promise<HandoffDelivery> {
  latestHandoffs.set(documentId, bundle)
  if (!isTauri()) {
    const fileName = `redrob-handoff-${bundle.slug}.zip`
    downloadBlob(handoffZip(bundle), fileName, 'application/zip')
    return { kind: 'zip', fileName }
  }
  const [{ open }, { mkdir, writeFile }, { join }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/plugin-fs'),
    import('@tauri-apps/api/path')
  ])
  const root = await open({ directory: true, multiple: false })
  if (typeof root !== 'string') return { kind: 'cancelled' }
  const folder = await join(root, ...HANDOFF_DIR.split('/'), bundle.slug)
  await mkdir(folder, { recursive: true })
  for (const [name, bytes] of Object.entries(bundle.files)) {
    await writeFile(await join(folder, name), bytes)
  }
  return { kind: 'folder', path: folder }
}
