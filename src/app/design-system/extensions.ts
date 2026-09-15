/**
 * Files the user can hand to the design-token importer and expect a result.
 *
 * Carried over verbatim from the Redrob Design token-import feature
 * (`apps/desktop/src/main/design-system.ts`); the picker filters on these and
 * the router below maps each one to the extractor that understands it.
 */
export const IMPORTABLE_DESIGN_SYSTEM_EXTS = [
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.json',
  '.js',
  '.ts',
  '.mjs',
  '.cjs'
] as const

export type ImportableDesignSystemExt = (typeof IMPORTABLE_DESIGN_SYSTEM_EXTS)[number]
