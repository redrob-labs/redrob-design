/**
 * @redrob-design/brand
 *
 * The Redrob-owned brand package: the canonical design-tokens library (the
 * `tokens.css` source of truth plus the DTCG importer) and the design-theme
 * library (the `redrob-brand` token resource resolver, whose HEX values are
 * enforced to match `tokens.css`).
 *
 * Colours are decided once, in `./tokens.css`. The `redrob-brand` DESIGN.md
 * resource carries the same values and `brand-tokens.test.ts` fails if the two
 * ever disagree.
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

export {
  loadRedrobBrandTokens,
  REDROB_BRAND_RESOURCE_ID,
  REDROB_BRAND_RESOURCE_NAME,
  REDROB_BRAND_RESOURCE_PATH,
  redrobBrandResourcePath,
  renderBrandTokenCss,
  resolveRedrobBrandTokens,
  SCAFFOLD_RESOURCES_ROOT,
  syncDeckTokens,
  TOKEN_BLOCK_CLOSE,
  TOKEN_BLOCK_OPEN,
  type RedrobBrandTokens,
  type TypographyRole
} from './brand-tokens.ts'

export {
  extractFromCssVars,
  extractFromCssVarsSource,
  extractFromTailwindConfig,
  extractFromTailwindConfigSource,
  importDtcgJson
} from './importer/index.ts'
export { STORED_DESIGN_SYSTEM_SCHEMA_VERSION, StoredDesignSystem } from './shared/index.ts'
export type { DesignToken, DesignTokenSet } from './shared/index.ts'

export { tokens } from './preset.ts'

/**
 * A deck is one self-contained HTML file whose brand token block is regenerated
 * from the `redrob-brand` resource. No first-party decks ship in this package, so
 * `DECKS` is empty and the token-sync CLI is a no-op on a clean tree; the array is
 * kept so the CLI and any consumer keep a stable shape.
 */
export interface DeckDefinition {
  id: string
  title: string
  locale: string
  slideWidth: number
  slideHeight: number
  slideCount: number
  /** Deck source, relative to this package's `src`. */
  source: string
  artifactBaseName: string
}

export const DECKS: readonly DeckDefinition[] = []

/** Absolute path of this package's `src` directory. */
export function brandSrcRoot(): string {
  return path.dirname(fileURLToPath(import.meta.url))
}

/** Absolute path of a deck's source file. */
export function deckSourcePath(deck: DeckDefinition): string {
  return path.join(brandSrcRoot(), deck.source)
}

/** Repo root, derived from this package's location in the workspace. */
export function repoRoot(): string {
  return path.resolve(brandSrcRoot(), '../../..')
}
