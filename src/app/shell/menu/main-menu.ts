import { computed } from 'vue'

import { formatShortcut, useI18n } from '@redrob-design/vue'

import { openSettingsDialog } from '@/app/settings/dialog'
import { commandPaletteOpen } from '@/app/shell/command-palette'
import { useAppMenu } from '@/app/shell/menu/app-menu'
import type { MainMenuScreen } from '@/app/shell/menu/main-menu-model'
import { mainMenuGroups } from '@/app/shell/menu/main-menu-model'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import { activeTab, showNewTab } from '@/app/tabs'

/** The command palette's shortcut, bound in `CommandPalette.vue`. */
const COMMAND_PALETTE_SHORTCUT = 'MOD+K'

export function useMainMenu() {
  const { topMenus } = useAppMenu()
  const { menu } = useI18n()

  const screen = computed<MainMenuScreen>(() => {
    if (activeTab.value?.kind === 'home') return 'home'
    return activeTab.value?.mode === 'describe' ? 'describe' : 'edit'
  })
  const groups = computed(() => mainMenuGroups(topMenus.value, screen.value, menu.value.language))

  return {
    screen,
    groups,
    settingsShortcut: computed(() => appMenuShortcutLabel('settings')),
    searchShortcut: computed(() => formatShortcut(COMMAND_PALETTE_SHORTCUT)),
    backToHome: () => showNewTab(),
    openSettings: () => openSettingsDialog(),
    searchCommands: () => {
      commandPaletteOpen.value = true
    }
  }
}
