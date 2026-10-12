/**
 * UI-slice stub for `@/app/shell/menu/main-menu`.
 *
 * The real `useMainMenu` composes the live app menu (file/edit/view commands,
 * the settings dialog, the command palette, tab routing) and derives the active
 * "screen" from the current document. The ported MainMenu only consumes the
 * returned shape, so this stub provides a representative, static menu tree plus
 * no-op actions (and the command-palette open flip). It makes the MainMenu
 * render fully — groups, sub-menus, shortcuts, separators — without the app's
 * shell. Swap for the real module to reconnect; MainMenu does not change.
 */
import { computed } from 'vue'

import { formatShortcut, type MenuGroup } from '@redrob-design/vue'

import { commandPaletteOpen } from '@/app/shell/command-palette'
import { activeTab, showNewTab } from '@/app/tabs'

type MainMenuScreen = 'home' | 'edit' | 'describe'

const GROUPS: MenuGroup[] = [
  {
    id: 'file',
    label: 'File',
    items: [
      { label: 'New document', shortcut: formatShortcut('MOD+N'), action: () => {} },
      { label: 'Open…', shortcut: formatShortcut('MOD+O'), action: () => {} },
      { separator: true },
      { label: 'Export', sub: [{ label: 'PNG', action: () => {} }, { label: 'SVG', action: () => {} }] }
    ]
  },
  {
    id: 'edit',
    label: 'Edit',
    items: [
      { label: 'Undo', shortcut: formatShortcut('MOD+Z'), action: () => {} },
      { label: 'Redo', shortcut: formatShortcut('MOD+Shift+Z'), action: () => {} }
    ]
  },
  {
    id: 'view',
    label: 'View',
    items: [
      { label: 'Show grid', checked: true, onCheckedChange: () => {} },
      { label: 'Show rulers', checked: false, onCheckedChange: () => {} }
    ]
  }
]

export function useMainMenu() {
  const screen = computed<MainMenuScreen>(() =>
    activeTab.value?.isHome ? 'home' : 'edit'
  )

  return {
    screen,
    groups: computed(() => GROUPS),
    settingsShortcut: computed(() => formatShortcut('MOD+,')),
    searchShortcut: computed(() => formatShortcut('MOD+K')),
    backToHome: () => showNewTab(),
    openSettings: () => {},
    searchCommands: () => {
      commandPaletteOpen.value = true
    }
  }
}
