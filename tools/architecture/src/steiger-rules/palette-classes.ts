import { createTextRule } from './support.ts'

/**
 * App UI names colours through semantic tokens (`bg-panel`, `text-muted`, `border-border`,
 * `bg-accent`...) that `src/app.css` maps onto the Redrob design system. A Tailwind palette class
 * (`bg-zinc-800`, `text-white`, `hover:bg-red-500/20`) or an arbitrary colour (`bg-[#1e1e1e]`,
 * `shadow-[0_8px_30px_rgb(0_0_0/0.4)]`) bypasses that mapping: it ignores the theme and drifts from
 * the system the first time a token changes. This rule rejects both in app UI sources.
 */

const SCOPES: ReadonlyArray<{ prefix: string; extensions: readonly string[] }> = [
  { prefix: 'src/components/', extensions: ['.vue', '.ts'] },
  { prefix: 'src/views/', extensions: ['.vue', '.ts'] },
  { prefix: 'src/theme/', extensions: ['.ts'] }
]

const UTILITY_PREFIX =
  '(?:bg|text|border(?:-[xytrblse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|shadow|divide|placeholder|accent|caret|decoration|inset-shadow|inset-ring)'
// Chromatic palettes only exist with a shade (`red-500`); white and black have none.
const PALETTE =
  '(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\\d{2,3}|white|black)'

const PALETTE_CLASS = new RegExp(
  `(?<![\\w-])${UTILITY_PREFIX}-${PALETTE}(?:\\/(?:\\d+|\\[[^\\]\\s]+\\]))?(?![\\w-])`,
  'g'
)
const ARBITRARY_COLOR =
  /(?<![\w-])[a-z-]+-\[[^\]\s]*?(?:#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\()/g

/**
 * Files that still held raw colours when this rule landed. The Redrob DS migration removes them one
 * domain at a time and deletes this list when it is empty; nothing may be added to it.
 */
export const PALETTE_CLASS_MIGRATION_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  'src/components/ChatPanel.vue',
  'src/components/CollabPanel/ConnectedRoom.vue',
  'src/components/CollabPanel/JoinRoomPrompt.vue',
  'src/components/CollabPanel/ShareOrJoinRoom.vue',
  'src/components/MobileDrawer.vue',
  'src/components/MobileHud/MobileFileMenu.vue',
  'src/components/MobileHud/MobileShareButton.vue',
  'src/components/MobileHud/MobileUndoRedo.vue',
  'src/components/SafariBanner.vue',
  'src/components/Toolbar/DesktopToolbar.vue',
  'src/components/assets-panel/AssetsPanel.vue',
  'src/components/canvas/labels/CanvasLabelEditor.vue',
  'src/components/chat/ChatInput.vue',
  'src/components/chat/ChatMessage.vue',
  'src/components/chat/ProviderSetup.vue',
  'src/components/chat/attachment/AttachmentCard.vue',
  'src/components/color-picker-panel/ColorAreaControl.vue',
  'src/components/font-picker/FontPicker.vue',
  'src/components/font-status/FontStatusBanner.vue',
  'src/components/home/search/HomeSearchActions.vue',
  'src/components/properties/ExportSection.vue',
  'src/components/settings/diagnostics/DiagnosticsSettingsPanel.vue',
  'src/components/settings/mcp/MCPConnectionsSection.vue',
  'src/components/settings/mcp/MCPSettingsPanel.vue',
  'src/components/settings/models/ModelsPanel.vue',
  'src/components/settings/models/ProfileEditor.vue',
  'src/components/settings/storage/StorageSettingsPanel.vue',
  'src/components/ui/AppPlaceholder.stories.ts',
  'src/theme/collaboration.ts',
  'src/theme/color-slider.ts',
  'src/theme/fill-picker.ts',
  'src/theme/layer-tree.ts',
  'src/theme/toolbar.ts'
])

function inScope(sourceRel: string): boolean {
  return SCOPES.some(
    (scope) =>
      sourceRel.startsWith(scope.prefix) &&
      scope.extensions.some((extension) => sourceRel.endsWith(extension))
  )
}

function lineAndColumn(content: string, index: number) {
  const before = content.slice(0, index)
  const lines = before.split('\n')
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 }
}

export function paletteClassDiagnostics(
  sourceRel: string,
  content: string,
  allowlist: ReadonlySet<string> = PALETTE_CLASS_MIGRATION_ALLOWLIST
) {
  if (!inScope(sourceRel) || allowlist.has(sourceRel)) return []
  const diagnostics: Array<{ message: string; line?: number; column?: number }> = []
  for (const match of content.matchAll(PALETTE_CLASS)) {
    diagnostics.push({
      message: `Use a semantic colour token instead of the Tailwind palette class "${match[0]}" (see src/app.css).`,
      ...lineAndColumn(content, match.index)
    })
  }
  for (const match of content.matchAll(ARBITRARY_COLOR)) {
    diagnostics.push({
      message: `Use a semantic colour or shadow token instead of an arbitrary colour in "${match[0]}…".`,
      ...lineAndColumn(content, match.index)
    })
  }
  return diagnostics
}

export const noRawPaletteClasses = createTextRule(
  'redrob-design/no-raw-palette-classes',
  (rel, text) => paletteClassDiagnostics(rel, text)
)
