import type { DesignToken } from '@redrob-design/brand'

import { designTokensMessages, formatTokenCount } from '@/app/i18n/design-tokens'
import { toast } from '@/app/shell/ui'

import { pickAndImportDesignTokens } from './import'
import { applyImportedDesignTokens } from './store'

export interface ImportDesignTokensActionResult {
  imported: number
  skipped: string[]
  tokens: DesignToken[]
}

/**
 * The "Import design tokens" editor action: pick files, run the DTCG importer,
 * and report the outcome with the token-import copy. Returns `null` when the
 * user cancels or the picker is unavailable.
 */
export async function runImportDesignTokens(): Promise<ImportDesignTokensActionResult | null> {
  const copy = designTokensMessages.get()
  try {
    const result = await pickAndImportDesignTokens()
    if (result === null) return null

    if (result.tokens.length === 0) {
      // Nothing parsed. Say so rather than pretending a system was stored.
      toast.warning(copy.designTokensImportEmpty)
      return { imported: 0, skipped: result.skipped, tokens: [] }
    }

    // Persist and apply the parsed tokens so importing actually takes effect
    // (the old Electron feature stored the imported design system; see
    // PRESERVE.md). Without this the action was parse-and-toast only.
    applyImportedDesignTokens(result.tokens, { sourceFiles: result.sources })

    toast.info(formatTokenCount(copy.designTokensImported, result.tokens.length))
    if (result.skipped.length > 0) {
      toast.warning(formatTokenCount(copy.designTokensImportSkipped, result.skipped.length))
    }
    return { imported: result.tokens.length, skipped: result.skipped, tokens: result.tokens }
  } catch (error) {
    console.error('Failed to import design tokens:', error)
    toast.error(copy.designTokensImportFailed)
    return null
  }
}
