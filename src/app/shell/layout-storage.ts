import { IS_BROWSER } from '@redrob-design/core/constants'

const EDITOR_LAYOUT_KEY = 'redrob-design:editor-layout'
/** About 256px, the canvas and 304px at 1440px wide, as the approved prototype sets them. */
const DEFAULT_EDITOR_LAYOUT = [18, 61, 21]

export function loadEditorLayout(): number[] {
  if (!IS_BROWSER) return DEFAULT_EDITOR_LAYOUT
  try {
    const raw = window.localStorage.getItem(EDITOR_LAYOUT_KEY)
    if (!raw) return DEFAULT_EDITOR_LAYOUT
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) &&
      parsed.length === 3 &&
      parsed.every((v) => typeof v === 'number')
      ? parsed
      : DEFAULT_EDITOR_LAYOUT
  } catch {
    return DEFAULT_EDITOR_LAYOUT
  }
}

export function saveEditorLayout(layout: number[]): void {
  if (!IS_BROWSER) return
  window.localStorage.setItem(EDITOR_LAYOUT_KEY, JSON.stringify(layout))
}
