/**
 * UI-slice stub for `@/app/tabs`.
 *
 * The real module owns the editor-tab model: each tab is backed by a document,
 * a preparation pipeline and routing. The ported TabBar only needs the
 * presentation surface — a reactive list of tabs plus switch/close/new — so this
 * stub implements a small, fully working in-memory store. It makes the TabBar
 * genuinely interactive in the showcase (open, switch, close tabs) with no
 * backend. Swap for the real module to reconnect; the TabBar does not change.
 */
import { computed, ref } from 'vue'

export interface UITab {
  id: string
  name: string
  isActive: boolean
  isHome: boolean
  isPreparing: boolean
  /** Preparation progress 0–100, or null when indeterminate. */
  preparationProgress: number | null
}

interface StoredTab {
  id: string
  name: string
  isHome: boolean
  isPreparing: boolean
  preparationProgress: number | null
}

let counter = 0
const stored = ref<StoredTab[]>([
  { id: 'home', name: 'Home', isHome: true, isPreparing: false, preparationProgress: null }
])
const activeId = ref('home')

/** The active tab, exposed for the main menu's screen logic. */
export const activeTab = computed(() => stored.value.find((tab) => tab.id === activeId.value) ?? null)

export function useTabsStore() {
  const tabs = computed<UITab[]>(() =>
    stored.value.map((tab) => ({ ...tab, isActive: tab.id === activeId.value }))
  )

  function switchTab(id: string): void {
    if (stored.value.some((tab) => tab.id === id)) activeId.value = id
  }

  function closeTab(id: string): void {
    const index = stored.value.findIndex((tab) => tab.id === id)
    if (index === -1) return
    stored.value.splice(index, 1)
    if (activeId.value === id) {
      const next = stored.value[Math.max(0, index - 1)]
      if (next) activeId.value = next.id
    }
  }

  return { tabs, activeTabId: activeId, switchTab, closeTab }
}

/** Opens a fresh document tab and makes it active. */
export function createHomeTab(): void {
  counter += 1
  const id = `tab-${counter}`
  stored.value.push({
    id,
    name: `Untitled ${counter}`,
    isHome: false,
    isPreparing: false,
    preparationProgress: null
  })
  activeId.value = id
}

/** Returns to the home tab (the main menu's "back to home"). */
export function showNewTab(): void {
  activeId.value = 'home'
}
