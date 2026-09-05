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
 *
 * This entry point is browser-safe: the editor app imports it from renderer
 * code, so nothing reachable from here may touch `node:*`. The filesystem-backed
 * surface (the `redrob-brand` resource loader, deck paths, and the file-reading
 * token extractors) lives in `./node.ts`, published as the `./node` subpath.
 */

export {
  extractFromCssVarsSource,
  extractFromTailwindConfigSource,
  importDtcgJson
} from './importer/index.ts'
export { STORED_DESIGN_SYSTEM_SCHEMA_VERSION, StoredDesignSystem } from './shared/index.ts'
export type { DesignToken, DesignTokenSet } from './shared/index.ts'

export { tokens } from './preset.ts'
