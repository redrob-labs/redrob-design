import { exportHTMLBundle, sceneGraphToDesignDocument } from '@redrob-design/dom-css'
import type { SceneGraph } from '@redrob-design/scene-graph'

/** One file of a published site, with its path inside the site and how it is cached. */
export interface SiteFile {
  path: string
  bytes: Uint8Array
  contentType: string
  /** Assets are named by content and never change; the page itself is always checked. */
  immutable: boolean
}

export interface BuiltSite {
  files: SiteFile[]
  /** Typefaces the page uses that ship without their font files, so browsers fall back. */
  fontFallbacks: string[]
}

export interface BuildSiteOptions {
  /** `assets` downloads web fonts into the site; `none` leaves every typeface to fall back. */
  fonts?: 'assets' | 'none'
}

const ASSET_DIR = 'assets'

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf'
}

export function contentTypeFor(path: string): string {
  const extension = path.slice(path.lastIndexOf('.') + 1).toLowerCase()
  return CONTENT_TYPES[extension] ?? 'application/octet-stream'
}

async function contentHash(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer)
  return Array.from(new Uint8Array(digest, 0, 6), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

function hashedPath(path: string, hash: string): string {
  const dot = path.lastIndexOf('.')
  const slash = path.lastIndexOf('/')
  if (dot <= slash) return `${path}.${hash}`
  return `${path.slice(0, dot)}.${hash}${path.slice(dot)}`
}

/** A path inside the asset folder, as the stylesheet in that folder refers to it. */
function fromAssetDir(path: string): string {
  return path.startsWith(`${ASSET_DIR}/`) ? path.slice(ASSET_DIR.length + 1) : path
}

function typefacesOn(graph: SceneGraph, pageId: string): Set<string> {
  const families = new Set<string>()
  const walk = (id: string) => {
    const node = graph.getNode(id)
    if (!node) return
    if (node.type === 'TEXT' && node.visible && node.fontFamily) families.add(node.fontFamily)
    for (const child of node.childIds) walk(child)
  }
  walk(pageId)
  return families
}

/**
 * The page's frames as a static site: one `index.html`, a stylesheet, and
 * images and fonts named by their content so they can be cached forever.
 */
export async function buildSite(
  graph: SceneGraph,
  pageId: string,
  options: BuildSiteOptions = {}
): Promise<BuiltSite> {
  const document = sceneGraphToDesignDocument(graph, { rootId: pageId })
  const bundle = await exportHTMLBundle(document, {
    html: 'standalone',
    style: 'inline',
    assets: 'external',
    fonts: options.fonts ?? 'assets',
    assetBasePath: ASSET_DIR
  })
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const bytesOf = (content: string | Uint8Array) =>
    typeof content === 'string' ? encoder.encode(content) : content

  // Binary assets first, so the stylesheet and page can point at their hashed names.
  const renamed = new Map<string, string>()
  const files: SiteFile[] = []
  const textFiles = bundle.files.filter(
    (file) => file.path === bundle.entrypoint || file.path.endsWith('.css')
  )
  for (const file of bundle.files) {
    if (textFiles.includes(file)) continue
    const bytes = bytesOf(file.content)
    const path = hashedPath(file.path, await contentHash(bytes))
    renamed.set(file.path, path)
    files.push({ path, bytes, contentType: contentTypeFor(path), immutable: true })
  }

  let entry = ''
  for (const file of textFiles) {
    let text = typeof file.content === 'string' ? file.content : decoder.decode(file.content)
    if (file.path === bundle.entrypoint) {
      entry = text
      continue
    }
    for (const [from, to] of renamed) {
      text = text.replaceAll(from, fromAssetDir(to))
    }
    const bytes = encoder.encode(text)
    const path = hashedPath(file.path, await contentHash(bytes))
    renamed.set(file.path, path)
    files.push({ path, bytes, contentType: contentTypeFor(path), immutable: true })
  }
  for (const [from, to] of renamed) entry = entry.replaceAll(from, to)
  files.push({
    path: 'index.html',
    bytes: encoder.encode(entry),
    contentType: contentTypeFor('index.html'),
    immutable: false
  })

  // Font files are named `<family-slug>-<weight>-<style>.<ext>` under assets/fonts.
  const fontPaths = bundle.files
    .map((file) => file.path)
    .filter((path) => path.startsWith(`${ASSET_DIR}/fonts/`))
  const fontFallbacks = [...typefacesOn(graph, pageId)]
    .filter(
      (family) =>
        !fontPaths.some((path) => path.startsWith(`${ASSET_DIR}/fonts/${slugOf(family)}-`))
    )
    .sort()
  return { files, fontFallbacks }
}

/** Lowercase words joined by dashes, safe in a URL path. */
export function slugOf(value: string): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug.slice(0, 60) || 'page'
}
