import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Locator, Page } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { routeConsoleToMock } from '#tests/helpers/console/route'
import { setAppTheme } from '#tests/helpers/theme'

export type SweepTheme = 'light' | 'dark'
export const SWEEP_THEMES: readonly SweepTheme[] = ['light', 'dark']

/** Something on a surface that does not render or behave cleanly. */
export interface SweepIssue {
  kind: 'console' | 'hidden' | 'offscreen' | 'overflow' | 'unnamed' | 'close'
  detail: string
}

/** Browser noise that is not the app's: GPU driver chatter and the local MCP probe. */
const IGNORED_CONSOLE = [
  /GL Driver Message/,
  /GPU stall due to ReadPixels/,
  /127\.0\.0\.1:7600/,
  /Autofocus processing was blocked/,
  /WebGL: CONTEXT_LOST_WEBGL/
]

/** Screenshots go to the ignored scratch folder; nothing here is a baseline. */
// Playwright runs from the repository root.
const SHOT_DIR = join(process.cwd(), 'scratch', 'ui-sweep')

/**
 * Collects console errors and uncaught exceptions from a page, so every
 * surface can say what went wrong while it was open.
 */
export function watchConsole(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (!IGNORED_CONSOLE.some((pattern) => pattern.test(text))) errors.push(text)
  })
  return {
    /** The errors since the last call, as issues. */
    take(): SweepIssue[] {
      return errors.splice(0).map((detail) => ({ kind: 'console', detail }))
    }
  }
}

export type ConsoleWatch = ReturnType<typeof watchConsole>

/**
 * Runs in the page: text that spills out of the box that clips it, where
 * the box neither scrolls nor truncates on purpose. Returns a short
 * description of each spilled element.
 */
function findSpilledText(root: Element): string[] {
  const clips = (style: CSSStyleDeclaration) =>
    ['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)
  const truncates = (style: CSSStyleDeclaration) =>
    style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none' || clips(style)
  const hasOwnText = (element: Element) =>
    [...element.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim() !== ''
    )
  const clippingAncestor = (element: Element): Element | null => {
    let parent = element.parentElement
    while (parent && !clips(getComputedStyle(parent))) parent = parent.parentElement
    return parent
  }
  const spills = (element: HTMLElement): boolean => {
    if (element.offsetParent === null || !hasOwnText(element)) return false
    if (truncates(getComputedStyle(element))) return false
    if (element.scrollWidth <= element.clientWidth + 1) return false
    const clip = clippingAncestor(element)?.getBoundingClientRect()
    const box = element.getBoundingClientRect()
    return clip !== undefined && (box.right > clip.right + 1 || box.left < clip.left - 1)
  }
  return [...root.querySelectorAll<HTMLElement>('*')].filter(spills).map((element) => {
    const slot = element.getAttribute('data-slot') ?? element.getAttribute('data-test-id')
    const text = (element.textContent ?? '').trim().replaceAll(/\s+/g, ' ').slice(0, 40)
    return `${element.tagName.toLowerCase()}${slot ? `[${slot}]` : ''} "${text}"`
  })
}

/** An ARIA snapshot line for a control the browser could not name. */
const UNNAMED_CONTROL =
  /^\s*- (button|menuitem|menuitemcheckbox|menuitemradio|tab|switch|link|textbox|combobox|checkbox|radio|slider|spinbutton)(?: \[[^\]]*\])*:?$/

/** Controls with no accessible name, by the browser's own naming rules. */
async function unnamedControls(surface: Locator): Promise<string[]> {
  const snapshot = await surface.ariaSnapshot()
  return snapshot
    .split('\n')
    .filter((line) => UNNAMED_CONTROL.test(line))
    .map((line) => line.trim())
}

/**
 * Checks one open surface: it is visible, inside the viewport, free of
 * spilled text and unnamed controls, and raised no console errors. Saves a
 * screenshot to `scratch/ui-sweep/<name>-<theme>.png` for a look by eye.
 */
export async function auditSurface(
  page: Page,
  surface: Locator,
  name: string,
  theme: SweepTheme,
  errors: ConsoleWatch
): Promise<SweepIssue[]> {
  const issues: SweepIssue[] = []
  if (!(await surface.isVisible())) return [{ kind: 'hidden', detail: name }]
  // Open and slide-in animations settle before measuring. A cancelled
  // animation (a theme switch restarts transitions) rejects `finished`,
  // and has settled just the same.
  await surface.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined))
    )
  )
  const box = await surface.boundingBox()
  const viewport = page.viewportSize()
  if (box && viewport) {
    const outside =
      box.x < -1 ||
      box.y < -1 ||
      box.x + box.width > viewport.width + 1 ||
      box.y + box.height > viewport.height + 1
    if (outside) {
      issues.push({
        kind: 'offscreen',
        detail: `${name} at ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}`
      })
    }
  }
  for (const detail of await surface.evaluate(findSpilledText)) {
    issues.push({ kind: 'overflow', detail: `${name}: ${detail}` })
  }
  const unnamed = await unnamedControls(surface)
  if (unnamed.length > 0) {
    issues.push({ kind: 'unnamed', detail: `${name}: ${unnamed.length} × ${unnamed[0]}` })
  }
  mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: join(SHOT_DIR, `${name}-${theme}.png`) })
  issues.push(...errors.take())
  return issues
}

/** Closes a surface with Escape and reports when it stays open. */
export async function closesWithEscape(
  page: Page,
  surface: Locator,
  name: string
): Promise<SweepIssue[]> {
  await page.keyboard.press('Escape')
  try {
    await surface.waitFor({ state: 'hidden', timeout: 3000 })
    return []
  } catch {
    return [{ kind: 'close', detail: `${name} stays open after Escape` }]
  }
}

/** Switches the app theme before a surface is opened. */
export function useTheme(page: Page, theme: SweepTheme): Promise<void> {
  return setAppTheme(page, theme)
}

/**
 * Opens the editor with Console answering from the mock, so start-up feed
 * requests raise no CORS errors, and returns a console watch that starts
 * clean.
 */
export async function openSweepApp(page: Page, url = '/?test'): Promise<ConsoleWatch> {
  await routeConsoleToMock(page)
  const errors = watchConsole(page)
  await page.goto(url)
  await new CanvasHelper(page).waitForInit()
  errors.take()
  return errors
}
