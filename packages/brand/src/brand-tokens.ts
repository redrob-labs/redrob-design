/**
 * The `redrob-brand` token resource, resolved.
 *
 * The shared Redrob token set lives once, as a DESIGN.md resource in the built-in
 * scaffold collection:
 *
 *   apps/desktop/resources/templates/scaffolds/design-systems/redrob-brand.md
 *
 * That file is the collection's own format, validated by the app's own
 * `validateDesignMd`, and offered to users as `scaffold({kind: "redrob-brand"})`.
 * It is not a second copy of the brand: its HEX values are the ones on merged main
 * in `packages/ui/src/tokens.css`, and `brand-tokens.test.ts` fails if the two ever
 * disagree.
 *
 * This module turns that resource into CSS custom properties so a deck can *use*
 * the resource rather than transcribe its colours. The mapping is mechanical, not
 * a lookup table: the resource's colour keys are the custom-property names minus
 * the leading dashes.
 *
 *   rr-blue-6              -> :root  { --rr-blue-6: #2b52ff }
 *   color-accent           -> :root  { --color-accent: var(--rr-blue-6) }
 *   dark-color-accent      -> .dark  { --color-accent: var(--rr-blue-5) }
 *
 * A semantic role is emitted as `var(--rr-*)` whenever its value is exactly one of
 * the primitives, which keeps the two-layer shape of `tokens.css` intact in the
 * output: primitives hold HEX, roles point at primitives, and nothing else names a
 * colour.
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseDesignMd, validateDesignMd } from './shared/design-md.ts'

/** Machine name of the token resource, and its key in the scaffold manifest. */
export const REDROB_BRAND_RESOURCE_ID = 'redrob-brand'
/** Human name, as declared in the resource's own frontmatter. */
export const REDROB_BRAND_RESOURCE_NAME = 'Redrob 브랜드'
/** Path of the resource relative to the built-in scaffolds root. */
export const REDROB_BRAND_RESOURCE_PATH = 'scaffolds/design-systems/redrob-brand.md'
/** Path of the built-in scaffold resources root, relative to the repo root. */
export const SCAFFOLD_RESOURCES_ROOT = 'public/resources'

const PRIMITIVE_PREFIX = 'rr-'
const SEMANTIC_PREFIX = 'color-'
const DARK_PREFIX = 'dark-color-'

/**
 * Roles the dark theme deliberately does not re-point. `tokens.css` draws both of
 * these as a `color-mix` of Gray 8 and Gray 9 on dark, because the scale has
 * nothing between them; a mix is not a brand HEX, and inventing one here would
 * make this resource disagree with main. A dark surface therefore names
 * `--color-surface-muted`, which is a real primitive in both themes.
 */
const LIGHT_ONLY_ROLES = new Set(['color-surface', 'color-border-subtle'])

/** Marks the generated token block inside a deck source. */
export const TOKEN_BLOCK_OPEN = '/* redrob-brand:begin */'
export const TOKEN_BLOCK_CLOSE = '/* redrob-brand:end */'

export interface TypographyRole {
  fontFamily: string
  fontSize?: string
  fontWeight?: number
  lineHeight?: string
  letterSpacing?: string
  fontFeature?: string
}

export interface RedrobBrandTokens {
  /** `name` from the resource frontmatter, the human name of the token set. */
  name: string
  /** Theme-independent brand primitives, keyed without the leading dashes. */
  primitives: Record<string, string>
  /** Semantic roles on light. */
  light: Record<string, string>
  /** Semantic roles on dark. Same role names as `light`. */
  dark: Record<string, string>
  typography: Record<string, TypographyRole>
  rounded: Record<string, string>
  spacing: Record<string, string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Absolute path of the token resource, derived from this file's own location. */
export function redrobBrandResourcePath(repoRoot?: string): string {
  const root = repoRoot ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
  return path.join(root, SCAFFOLD_RESOURCES_ROOT, REDROB_BRAND_RESOURCE_PATH)
}

function dimension(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`
  return undefined
}

function typographyRole(raw: unknown, role: string): TypographyRole {
  if (!isRecord(raw)) throw new Error(`redrob-brand typography.${role} must be an object`)
  const fontFamily = raw['fontFamily']
  if (typeof fontFamily !== 'string' || fontFamily.trim().length === 0) {
    throw new Error(`redrob-brand typography.${role}.fontFamily is required`)
  }
  const out: TypographyRole = { fontFamily: fontFamily.trim() }
  const size = dimension(raw['fontSize'])
  if (size !== undefined) out.fontSize = size
  if (typeof raw['fontWeight'] === 'number') out.fontWeight = raw['fontWeight']
  const lineHeight = raw['lineHeight']
  if (typeof lineHeight === 'number' && Number.isFinite(lineHeight)) {
    out.lineHeight = String(lineHeight)
  } else if (typeof lineHeight === 'string' && lineHeight.trim().length > 0) {
    out.lineHeight = lineHeight.trim()
  }
  const tracking = dimension(raw['letterSpacing'])
  if (tracking !== undefined) out.letterSpacing = tracking
  if (typeof raw['fontFeature'] === 'string') out.fontFeature = raw['fontFeature'].trim()
  return out
}

function scale(raw: unknown, key: string): Record<string, string> {
  if (!isRecord(raw)) throw new Error(`redrob-brand ${key} must be a map`)
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(raw)) {
    const resolved = dimension(value)
    if (resolved === undefined) throw new Error(`redrob-brand ${key}.${name} is not a dimension`)
    out[name] = resolved
  }
  return out
}

/**
 * Parse and validate the token resource, then split its colour keys into the two
 * layers and the two themes. Throws when the resource does not resolve, which is
 * what makes "the resource resolves" a testable claim rather than a hope.
 */
export function resolveRedrobBrandTokens(raw: string): RedrobBrandTokens {
  const errors = validateDesignMd(raw).filter((finding) => finding.severity === 'error')
  if (errors.length > 0) {
    const detail = errors.map((finding) => `${finding.path}: ${finding.message}`).join('; ')
    throw new Error(`redrob-brand token resource is not a valid DESIGN.md: ${detail}`)
  }

  const { frontmatter } = parseDesignMd(raw)
  const name = frontmatter['name']
  if (typeof name !== 'string') throw new Error('redrob-brand token resource has no name')

  const colors = frontmatter['colors']
  if (!isRecord(colors)) throw new Error('redrob-brand token resource has no colors map')

  const primitives: Record<string, string> = {}
  const light: Record<string, string> = {}
  const dark: Record<string, string> = {}
  for (const [key, value] of Object.entries(colors)) {
    if (typeof value !== 'string') continue
    const hex = value.toLowerCase()
    if (key.startsWith(DARK_PREFIX)) dark[key.slice('dark-'.length)] = hex
    else if (key.startsWith(SEMANTIC_PREFIX)) light[key] = hex
    else if (key.startsWith(PRIMITIVE_PREFIX)) primitives[key] = hex
    else throw new Error(`redrob-brand colors.${key} is neither a primitive nor a semantic role`)
  }
  if (Object.keys(primitives).length === 0) {
    throw new Error('redrob-brand token resource declares no rr-* primitives')
  }

  const missingInDark = Object.keys(light).filter(
    (role) => dark[role] === undefined && !LIGHT_ONLY_ROLES.has(role)
  )
  if (missingInDark.length > 0) {
    throw new Error(`redrob-brand dark theme does not re-point: ${missingInDark.join(', ')}`)
  }
  const strayInDark = Object.keys(dark).filter((role) => light[role] === undefined)
  if (strayInDark.length > 0) {
    throw new Error(`redrob-brand dark theme names roles light does not: ${strayInDark.join(', ')}`)
  }

  const typographyRaw = frontmatter['typography']
  if (!isRecord(typographyRaw)) throw new Error('redrob-brand token resource has no typography')
  const typography: Record<string, TypographyRole> = {}
  for (const [role, value] of Object.entries(typographyRaw)) {
    typography[role] = typographyRole(value, role)
  }

  return {
    name,
    primitives,
    light,
    dark,
    typography,
    rounded: scale(frontmatter['rounded'], 'rounded'),
    spacing: scale(frontmatter['spacing'], 'spacing')
  }
}

export async function loadRedrobBrandTokens(resourcePath?: string): Promise<RedrobBrandTokens> {
  const file = resourcePath ?? redrobBrandResourcePath()
  return resolveRedrobBrandTokens(await readFile(file, 'utf8'))
}

function primitiveNameFor(tokens: RedrobBrandTokens, hex: string): string | undefined {
  for (const [name, value] of Object.entries(tokens.primitives)) {
    if (value === hex) return name
  }
  return undefined
}

/** A semantic role points at a primitive when it can, and holds HEX when it cannot. */
function semanticValue(tokens: RedrobBrandTokens, hex: string): string {
  const primitive = primitiveNameFor(tokens, hex)
  return primitive === undefined ? hex : `var(--${primitive})`
}

function typographyVars(tokens: RedrobBrandTokens): string[] {
  const lines: string[] = []
  const sans = tokens.typography['body']?.fontFamily
  const mono = tokens.typography['mono']?.fontFamily
  if (sans !== undefined) lines.push(`  --font-sans: ${sans};`)
  if (mono !== undefined) lines.push(`  --font-mono: ${mono};`)
  for (const [role, value] of Object.entries(tokens.typography)) {
    if (value.fontSize !== undefined) lines.push(`  --type-${role}-size: ${value.fontSize};`)
    if (value.fontWeight !== undefined) lines.push(`  --type-${role}-weight: ${value.fontWeight};`)
    if (value.lineHeight !== undefined) lines.push(`  --type-${role}-leading: ${value.lineHeight};`)
    if (value.letterSpacing !== undefined) {
      lines.push(`  --type-${role}-tracking: ${value.letterSpacing};`)
    }
  }
  return lines
}

/**
 * Render the resolved token set as the CSS block a deck source embeds. Emitted
 * between the two markers so `syncDeckTokens` can replace it and a test can prove
 * the checked-in deck still matches the resource.
 */
export function renderBrandTokenCss(tokens: RedrobBrandTokens): string {
  const lines: string[] = [
    TOKEN_BLOCK_OPEN,
    `/* Generated from the ${REDROB_BRAND_RESOURCE_ID} token resource (${tokens.name}).`,
    ` * Source: ${SCAFFOLD_RESOURCES_ROOT}/${REDROB_BRAND_RESOURCE_PATH}`,
    ' * Regenerate with: bun --filter @redrob-design/brand tokens',
    ' * Do not hand-edit, and do not add a brand colour outside this block. */',
    ':root {'
  ]

  lines.push('  /* Brand primitives. */')
  for (const [name, hex] of Object.entries(tokens.primitives)) lines.push(`  --${name}: ${hex};`)

  lines.push('', '  /* Semantic roles, light. */')
  for (const [role, hex] of Object.entries(tokens.light)) {
    lines.push(`  --${role}: ${semanticValue(tokens, hex)};`)
  }

  lines.push('', '  /* Typography. */', ...typographyVars(tokens))

  lines.push('', '  /* Radius. */')
  for (const [name, value] of Object.entries(tokens.rounded)) {
    lines.push(`  --radius-${name}: ${value};`)
  }

  lines.push('', '  /* Spacing. */')
  for (const [name, value] of Object.entries(tokens.spacing)) {
    lines.push(`  --space-${name}: ${value};`)
  }

  lines.push(
    '}',
    '',
    '/* Semantic roles, dark. Same roles re-pointed, no new primitive. */',
    '.dark {'
  )
  for (const [role, hex] of Object.entries(tokens.dark)) {
    lines.push(`  --${role}: ${semanticValue(tokens, hex)};`)
  }
  lines.push('}', TOKEN_BLOCK_CLOSE)

  return lines.join('\n')
}

/** Replace the generated token block in a deck source. Throws when it is absent. */
export function syncDeckTokens(deckHtml: string, tokens: RedrobBrandTokens): string {
  const start = deckHtml.indexOf(TOKEN_BLOCK_OPEN)
  const end = deckHtml.indexOf(TOKEN_BLOCK_CLOSE)
  if (start < 0 || end < start) {
    throw new Error(`deck source has no ${TOKEN_BLOCK_OPEN} ... ${TOKEN_BLOCK_CLOSE} block to fill`)
  }
  const indentMatch = /(^|\n)([ \t]*)$/.exec(deckHtml.slice(0, start))
  const indent = indentMatch?.[2] ?? ''
  const block = renderBrandTokenCss(tokens)
    .split('\n')
    .map((line, index) => (index === 0 || line.length === 0 ? line : `${indent}${line}`))
    .join('\n')
  return `${deckHtml.slice(0, start)}${block}${deckHtml.slice(end + TOKEN_BLOCK_CLOSE.length)}`
}
