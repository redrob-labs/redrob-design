import { createI18n } from '@nanostores/i18n'
import type { ComponentsJSON } from '@nanostores/i18n'
import { useStore } from '@nanostores/vue'

import { locale, type Locale } from '@redrob-design/vue'

/**
 * Copy for the "Import design tokens" flow, carried over verbatim from the
 * Redrob Design token-import feature. The keys and their English values are an
 * invariant (see PRESERVE.md): the DTCG importer wiring and its tests depend on
 * these exact strings.
 *
 * `{{count}}` is left as the literal template token the feature was authored
 * with; `formatTokenCount` substitutes it so the runtime copy reads naturally.
 */
export const designTokensMessageDefaults = {
  importDesignTokens: 'Import design tokens',
  designTokensImported: 'Imported {{count}} design tokens',
  designTokensImportSkipped: '{{count}} file(s) could not be read as tokens',
  designTokensImportEmpty: 'No tokens found',
  designTokensImportFailed: 'Token import failed'
} as const

const designTokensI18n = createI18n<Locale, 'en'>(locale, {
  baseLocale: 'en',
  async get(code): Promise<ComponentsJSON> {
    if (code === 'en') return {}
    return {}
  }
})

export const designTokensMessages = designTokensI18n('designTokens', designTokensMessageDefaults)

export function useDesignTokensMessages() {
  return useStore(designTokensMessages)
}

/** Substitute the `{{count}}` template token in a token-import message. */
export function formatTokenCount(template: string, count: number): string {
  return template.replace(/\{\{count\}\}/g, String(count))
}
