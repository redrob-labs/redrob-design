import type { LintFix, LintFixField } from './types'

export function isDefaultName(name: string): boolean {
  return /^(Frame|Rectangle|Ellipse|Line|Text|Group|Vector|Polygon|Star|Section|Component|Instance|Slice)\s*\d*$/i.test(
    name
  )
}

export function isMultipleOf(value: number, base: number, tolerance = 0.01): boolean {
  if (base === 0) return false
  const remainder = value % base
  return remainder < tolerance || base - remainder < tolerance
}

interface LintPathNode {
  name: string
  parent?: LintPathNode
}

export function getNodePath(node: LintPathNode): string[] {
  const path: string[] = []
  let current: LintPathNode | undefined = node
  while (current) {
    path.unshift(current.name)
    current = current.parent
  }
  return path
}

export function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  ) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number }
): number {
  const l1 = relativeLuminance(a)
  const l2 = relativeLuminance(b)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export const SPACING_SCALE = [0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80, 96, 128]

/** A fix that sets each listed field to its value. */
export function fixFields(entries: ReadonlyArray<readonly [LintFixField, number]>): LintFix {
  const set: LintFix['set'] = {}
  for (const [field, value] of entries) set[field] = value
  return { set }
}

/** The value in `scale` closest to `value`; the smaller one on a tie. */
export function nearestInScale(value: number, scale: readonly number[]): number {
  let best = scale[0]
  for (const candidate of scale) {
    if (Math.abs(candidate - value) < Math.abs(best - value)) best = candidate
  }
  return best
}

/** The closest value that is in the spacing scale or a multiple of `base`. */
export function nearestSpacing(value: number, base: number): number {
  const multiple = Math.max(base, Math.round(value / base) * base)
  const inScale = nearestInScale(value, SPACING_SCALE)
  return Math.abs(multiple - value) < Math.abs(inScale - value) ? multiple : inScale
}
