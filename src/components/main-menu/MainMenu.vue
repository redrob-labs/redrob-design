<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'

import { useI18n } from '@redrob-design/vue'

import AppShortcutText from '@/components/ui/AppShortcutText.vue'
import { useMenuUI } from '@/components/ui/menu'
import mainMenuTheme from '@/theme/main-menu'
import { useMainMenu } from '@/app/shell/menu/main-menu'
import MainMenuEntries from './MainMenuEntries.vue'

const { menu } = useI18n()
const {
  screen,
  groups,
  settingsShortcut,
  searchShortcut,
  backToHome,
  openSettings,
  searchCommands
} = useMainMenu()

const styles = tv(mainMenuTheme)()
const menuCls = useMenuUI({ item: styles.item(), content: styles.content() })
const subCls = useMenuUI({ item: styles.item(), content: styles.subContent() })
</script>

<template>
  <DropdownMenuRoot :modal="false">
    <DropdownMenuTrigger
      data-test-id="app-main-menu"
      :aria-label="menu.mainMenu"
      :class="styles.trigger()"
    >
      <img src="/redrob-design-icon-small.svg" alt="" :class="styles.mark()" />
      <icon-lucide-chevron-down :class="styles.chevron()" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        data-test-id="app-main-menu-content"
        align="start"
        :side-offset="4"
        :class="menuCls.content"
      >
        <template v-if="screen !== 'home'">
          <DropdownMenuItem
            data-test-id="app-main-menu-home"
            :class="menuCls.item"
            @select="backToHome"
          >
            <icon-lucide-arrow-left :class="styles.lead()" />
            <span class="flex-1">{{ menu.backToHome }}</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator :class="menuCls.separator" />
        </template>

        <DropdownMenuSub v-for="group in groups" :key="group.id">
          <DropdownMenuSubTrigger :data-test-id="`menubar-${group.id}`" :class="menuCls.item">
            <span class="flex-1">{{ group.label }}</span>
            <icon-lucide-chevron-right :class="styles.chevronRight()" />
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent
              :data-test-id="`menubar-${group.id}-content`"
              :side-offset="4"
              :class="subCls.content"
            >
              <MainMenuEntries :items="group.items" />
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuSeparator :class="menuCls.separator" />
        <DropdownMenuItem
          data-test-id="app-settings-trigger"
          :class="menuCls.item"
          @select="openSettings"
        >
          <span class="flex-1">{{ menu.settings }}</span>
          <AppShortcutText v-if="settingsShortcut">{{ settingsShortcut }}</AppShortcutText>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-test-id="menubar-help" :class="menuCls.item">
            <span class="flex-1">{{ menu.help }}</span>
            <icon-lucide-chevron-right :class="styles.chevronRight()" />
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent
              data-test-id="menubar-help-content"
              :side-offset="4"
              :class="subCls.content"
            >
              <DropdownMenuItem :class="subCls.item" @select="searchCommands">
                <span class="flex-1">{{ menu.searchCommands }}</span>
                <AppShortcutText v-if="searchShortcut">{{ searchShortcut }}</AppShortcutText>
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
