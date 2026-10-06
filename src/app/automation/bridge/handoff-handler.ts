import { encodeBase64 } from '@redrob-design/core/bytes'

import { threadKeyFor } from '@/app/assistant/thread/store'
import type { AutomationTarget } from '@/app/automation/bridge/target'
import type { HandoffBundle } from '@/app/ship/handoff/bundle'
import { latestHandoffs } from '@/app/ship/handoff/deliver'
import { prepareHandoff } from '@/app/ship/handoff/service'

const TEXT_TYPES: Record<string, string> = {
  'brief.md': 'text/markdown',
  'Page.jsx': 'text/javascript',
  'tokens.json': 'application/json'
}

/** A bundle as the MCP server reads it: text files as text, the preview as base64. */
export function handoffResponse(documentId: string, bundle: HandoffBundle | null): unknown {
  if (!bundle) return { ok: false, error: `No hand-off for document ${documentId}` }
  const decoder = new TextDecoder()
  return {
    ok: true,
    result: {
      documentId,
      slug: bundle.slug,
      prompt: bundle.prompt,
      files: Object.entries(bundle.files).map(([name, bytes]) => {
        const textType = TEXT_TYPES[name]
        return textType
          ? { name, mimeType: textType, text: decoder.decode(bytes) }
          : { name, mimeType: 'image/png', base64: encodeBase64(bytes) }
      })
    }
  }
}

/**
 * The latest hand-off of the targeted document for the local MCP server.
 * With none yet, the current page is handed off as it is now, so an agent
 * can ask before the person presses Hand to Claude Code.
 */
export async function handleGetHandoff(target: AutomationTarget, args: unknown): Promise<unknown> {
  const requested =
    typeof args === 'object' && args !== null && 'handoff_document' in args
      ? args.handoff_document
      : undefined
  const documentId =
    typeof requested === 'string' && requested ? requested : threadKeyFor(target.store)
  const bundle =
    latestHandoffs.get(documentId) ??
    (documentId === threadKeyFor(target.store)
      ? await prepareHandoff(target.store, target.pageId)
      : null)
  return handoffResponse(documentId, bundle)
}
