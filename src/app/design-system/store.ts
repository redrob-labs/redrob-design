import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import {
  STORED_DESIGN_SYSTEM_SCHEMA_VERSION,
  StoredDesignSystem,
  type DesignToken
} from '@redrob-design/brand'

/**
 * Persisted design-system store for the "Import design tokens" feature.
 *
 * The old Electron feature (see PRESERVE.md) imported design tokens into a
 * persisted design system (`redrob:import-design-system-files`) held in a
 * renderer store, with a `redrob:clear-design-system` reset path. The Tauri/Vue
 * re-home carried the parse + copy but not the persistence, so importing tokens
 * had no effect beyond a toast. This store restores that behaviour: the parsed
 * tokens are folded into a `StoredDesignSystem` and persisted to local storage,
 * mirroring how the ported app persists other renderer state (see
 * `@/app/recent-files/store`).
 */

const DESIGN_SYSTEM_STORAGE_KEY = 'redrob-design:design-system'

/** Caps mirror the `StoredDesignSystem` schema so the summary always validates. */
const MAX_SOURCE_FILES = 24
const MAX_COLORS = 24
const MAX_FONTS = 16
const MAX_SPACING = 16
const MAX_RADIUS = 16
const MAX_SHADOWS = 16
const MAX_TOKENS = 240

const storedDesignSystem = useLocalStorage<StoredDesignSystem | null>(
  DESIGN_SYSTEM_STORAGE_KEY,
  null,
  {
    serializer: {
      read(raw): StoredDesignSystem | null {
        if (!raw) return null
        try {
          return StoredDesignSystem.parse(JSON.parse(raw))
        } catch {
          // A corrupt or stale-schema payload should not wedge the editor; drop it.
          return null
        }
      },
      write(value): string {
        return JSON.stringify(value)
      }
    }
  }
)

/** The active persisted design system, or `null` when nothing has been imported. */
export const activeDesignSystem = computed<StoredDesignSystem | null>(
  () => storedDesignSystem.value
)

/** Read the persisted design system directly (outside a Vue reactive scope). */
export function readStoredDesignSystem(): StoredDesignSystem | null {
  return storedDesignSystem.value
}

function uniqueValues(tokens: readonly DesignToken[], type: DesignToken['type'], max: number) {
  const seen = new Set<string>()
  for (const token of tokens) {
    if (token.type !== type) continue
    if (!seen.has(token.value)) seen.add(token.value)
    if (seen.size >= max) break
  }
  return [...seen]
}

function buildSummary(tokenCount: number, sourceFiles: readonly string[]): string {
  const fileNote =
    sourceFiles.length === 0
      ? 'no source files'
      : `${sourceFiles.length} source file${sourceFiles.length === 1 ? '' : 's'}`
  return `Imported ${tokenCount} design token${tokenCount === 1 ? '' : 's'} from ${fileNote}`
}

/**
 * Fold a freshly parsed token set into a persisted design system and store it.
 *
 * This is the missing "apply" step: after the DTCG importer parses tokens, the
 * result is turned into a `StoredDesignSystem` (summary + grouped values + the
 * raw token list) and persisted, so importing tokens actually takes effect
 * rather than only toasting a count. Returns the stored system.
 */
export function applyImportedDesignTokens(
  tokens: readonly DesignToken[],
  options: { sourceFiles?: readonly string[]; rootPath?: string } = {}
): StoredDesignSystem {
  const sourceFiles = (options.sourceFiles ?? []).slice(0, MAX_SOURCE_FILES)
  const cappedTokens = tokens.slice(0, MAX_TOKENS)
  const stored = StoredDesignSystem.parse({
    schemaVersion: STORED_DESIGN_SYSTEM_SCHEMA_VERSION,
    rootPath: options.rootPath ?? 'imported',
    summary: buildSummary(tokens.length, sourceFiles),
    extractedAt: new Date().toISOString(),
    sourceFiles,
    colors: uniqueValues(cappedTokens, 'color', MAX_COLORS),
    fonts: uniqueValues(cappedTokens, 'fontFamily', MAX_FONTS),
    spacing: uniqueValues(cappedTokens, 'spacing', MAX_SPACING),
    radius: uniqueValues(cappedTokens, 'radius', MAX_RADIUS),
    shadows: uniqueValues(cappedTokens, 'shadow', MAX_SHADOWS),
    tokens: cappedTokens
  })
  storedDesignSystem.value = stored
  return stored
}

/** Clear the persisted design system (mirrors the old `clear-design-system` path). */
export function clearStoredDesignSystem(): void {
  storedDesignSystem.value = null
}
