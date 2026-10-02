import { useLocalStorage, usePreferredDark } from '@vueuse/core'
import { computed, watch } from 'vue'

import type { RulerTheme } from '@redrob-design/core/canvas'
import { parseColor } from '@redrob-design/core/color'
import { IS_BROWSER } from '@redrob-design/core/constants'

import { getActiveEditorStoreOrNull, useActiveEditorStoreRef } from '@/app/editor/active-store'

export type AppTheme = 'dark' | 'light' | 'auto'

export const THEME_STORAGE_KEY = 'redrob-design:theme'
/**
 * Light, the Redrob design system's own default. Only installs with no saved choice see it: VueUse
 * writes the default on first read, so anyone who has launched the app before already has their
 * theme stored and keeps it. `index.html` repeats this resolution inline so the boot splash paints
 * in the right theme before this module loads.
 */
export const DEFAULT_APP_THEME: AppTheme = 'light'

function isAppTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light' || value === 'auto'
}

/** The theme to paint for a stored setting, falling back to the default for anything unknown. */
export function resolveAppTheme(stored: unknown, prefersDark: boolean): 'dark' | 'light' {
  const setting = isAppTheme(stored) ? stored : DEFAULT_APP_THEME
  if (setting === 'auto') return prefersDark ? 'dark' : 'light'
  return setting
}

const theme = useLocalStorage<AppTheme>(THEME_STORAGE_KEY, DEFAULT_APP_THEME)
const prefersDark = usePreferredDark()
export const resolvedAppTheme = computed<'dark' | 'light'>(() =>
  resolveAppTheme(theme.value, prefersDark.value)
)

function readRulerTheme(): RulerTheme | null {
  if (!IS_BROWSER || !('document' in globalThis)) return null
  const style = getComputedStyle(document.documentElement)
  return {
    background: parseColor(style.getPropertyValue('--color-ruler-bg')),
    tick: parseColor(style.getPropertyValue('--color-ruler-tick')),
    text: parseColor(style.getPropertyValue('--color-ruler-text')),
    label: parseColor(style.getPropertyValue('--color-ruler-label'))
  }
}

function updateCanvasTheme(): void {
  if (!IS_BROWSER) return
  const store = getActiveEditorStoreOrNull()
  if (!store) return
  store.state.rulerTheme = readRulerTheme() ?? undefined
  store.requestRepaint()
}

function applyTheme(value: 'dark' | 'light', setting: AppTheme): void {
  if (!IS_BROWSER || !('document' in globalThis)) return
  document.documentElement.dataset.theme = value
  document.documentElement.dataset.themeSetting = setting
  document.documentElement.style.colorScheme = value
  updateCanvasTheme()
}

export function useAppTheme() {
  watch([resolvedAppTheme, theme], ([value, setting]) => applyTheme(value, setting), {
    immediate: true
  })

  // Editors may mount after the theme was applied; push the canvas (ruler)
  // theme whenever the active editor changes so rulers always match.
  const activeStoreRef = useActiveEditorStoreRef()
  watch([activeStoreRef, resolvedAppTheme], () => updateCanvasTheme(), { flush: 'post' })

  const isLight = computed(() => resolvedAppTheme.value === 'light')

  function setTheme(value: AppTheme): void {
    theme.value = value
  }

  function toggleTheme(): void {
    theme.value = isLight.value ? 'dark' : 'light'
  }

  return { theme, resolvedTheme: resolvedAppTheme, isLight, setTheme, toggleTheme }
}

applyTheme(resolvedAppTheme.value, theme.value)
