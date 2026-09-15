import {
  extractFromCssVarsSource,
  extractFromTailwindConfigSource,
  importDtcgJson,
  type DesignToken
} from '@redrob-design/brand'

import { isTauri } from '@/app/tauri/env'

import { IMPORTABLE_DESIGN_SYSTEM_EXTS } from './extensions'

export interface DesignTokenImportResult {
  /** Tokens parsed out of the picked files. */
  tokens: DesignToken[]
  /** File names that yielded at least one token (the design system's sources). */
  sources: string[]
  /** Paths (or names) the user picked that yielded no tokens. */
  skipped: string[]
}

interface PickedFile {
  name: string
  text: string
}

function extname(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

/**
 * Route a picked file's text to the extractor that understands it, mirroring the
 * Redrob Design token-import feature. Returns `null` when no extractor claims the
 * file, so the caller reports it as skipped rather than silently storing nothing.
 * Every extractor is failure-tolerant, but they are wrapped anyway: one bad file
 * must never take down the whole import.
 */
function extractTokensFromFile(file: PickedFile): DesignToken[] | null {
  const name = file.name.toLowerCase()
  const ext = extname(name)
  try {
    if (name.startsWith('tailwind.config.')) {
      return extractFromTailwindConfigSource(file.text)
    }
    if (ext === '.json') {
      return importDtcgJson(JSON.parse(file.text) as unknown)
    }
    if (ext === '.css' || ext === '.scss' || ext === '.sass' || ext === '.less') {
      // Tailwind v4 keeps its theme in CSS, so try that reader first; it returns
      // an empty list when there is no @theme block and the CSS-var reader
      // handles a plain :root sheet.
      const themed = extractFromTailwindConfigSource(file.text)
      if (themed.length > 0) return themed
      return extractFromCssVarsSource(file.text)
    }
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs' || ext === '.ts') {
      return extractFromTailwindConfigSource(file.text)
    }
  } catch {
    return null
  }
  return null
}

function importFromPickedFiles(files: readonly PickedFile[]): DesignTokenImportResult {
  const tokens: DesignToken[] = []
  const sources: string[] = []
  const skipped: string[] = []
  for (const file of files) {
    const extracted = extractTokensFromFile(file)
    if (extracted === null || extracted.length === 0) {
      skipped.push(file.name)
      continue
    }
    sources.push(file.name)
    tokens.push(...extracted)
  }
  return { tokens, sources, skipped }
}

async function pickTokenFilesTauri(): Promise<PickedFile[] | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selection = await open({
    multiple: true,
    directory: false,
    title: 'Import design tokens',
    filters: [
      {
        name: 'Design tokens',
        extensions: IMPORTABLE_DESIGN_SYSTEM_EXTS.map((ext) => ext.slice(1))
      }
    ]
  })
  if (selection === null) return null
  const paths = Array.isArray(selection) ? selection : [selection]
  if (paths.length === 0) return null
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  return Promise.all(
    paths.map(async (path) => ({
      name: path.replace(/\\/g, '/').split('/').pop() ?? path,
      text: await readTextFile(path)
    }))
  )
}

interface OpenFilePickerOptions {
  multiple?: boolean
  types?: { description?: string; accept: Record<string, readonly string[]> }[]
}

type OpenFilePicker = (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>

function browserFilePicker(): OpenFilePicker | undefined {
  return (window as Window & { showOpenFilePicker?: OpenFilePicker }).showOpenFilePicker
}

async function pickTokenFilesBrowser(): Promise<PickedFile[] | null> {
  const picker = browserFilePicker()
  if (!picker) return null
  try {
    const handles = await picker({
      multiple: true,
      types: [
        {
          description: 'Design tokens',
          accept: { '*/*': [...IMPORTABLE_DESIGN_SYSTEM_EXTS] }
        }
      ]
    })
    return await Promise.all(
      handles.map(async (handle) => {
        const file = await handle.getFile()
        return { name: file.name, text: await file.text() }
      })
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null
    throw error
  }
}

/**
 * Prompt the user to pick design-token files and run the DTCG importer on them.
 * Returns `null` when the user cancels the picker; otherwise the parsed tokens
 * and the list of files that could not be read as tokens.
 */
export async function pickAndImportDesignTokens(): Promise<DesignTokenImportResult | null> {
  const picked = isTauri() ? await pickTokenFilesTauri() : await pickTokenFilesBrowser()
  if (picked === null) return null
  return importFromPickedFiles(picked)
}

export { importFromPickedFiles as importDesignTokensFromFiles }
