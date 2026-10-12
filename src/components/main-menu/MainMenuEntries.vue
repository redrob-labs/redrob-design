<script setup lang="ts">
import {
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'

import type { MenuEntry } from '@redrob-design/vue'

import AppShortcutText from '@/components/ui/AppShortcutText.vue'
import { useMenuUI } from '@/components/ui/menu'
import mainMenuTheme from '@/theme/main-menu'
import {
  hasMenuSubItems,
  isMenuCheckbox,
  isMenuSeparator,
  menuChecked,
  menuDisabled,
  menuLabel,
  menuShortcut,
  menuSubItems,
  runMenuAction,
  updateMenuChecked
} from '@/app/shell/menu/entry'

const { items } = defineProps<{ items: MenuEntry[] }>()

const styles = tv(mainMenuTheme)()
const menuCls = useMenuUI({ item: styles.item(), content: styles.subContent() })
</script>

<template>
  <template v-for="(item, i) in items" :key="i">
    <DropdownMenuSeparator v-if="isMenuSeparator(item)" :class="menuCls.separator" />
    <DropdownMenuSub v-else-if="hasMenuSubItems(item)">
      <DropdownMenuSubTrigger :class="menuCls.item" :disabled="menuDisabled(item)">
        <span class="flex-1">{{ menuLabel(item) }}</span>
        <icon-lucide-chevron-right :class="styles.chevronRight()" />
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent :side-offset="4" :class="menuCls.content">
          <MainMenuEntries :items="menuSubItems(item)" />
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
    <DropdownMenuCheckboxItem
      v-else-if="isMenuCheckbox(item)"
      :model-value="menuChecked(item)"
      :class="menuCls.item"
      @update:model-value="updateMenuChecked(item, $event as boolean)"
    >
      <span class="flex-1">{{ menuLabel(item) }}</span>
      <DropdownMenuItemIndicator class="text-surface">
        <icon-lucide-check class="size-3.5" />
      </DropdownMenuItemIndicator>
    </DropdownMenuCheckboxItem>
    <DropdownMenuItem
      v-else
      :class="menuCls.item"
      :disabled="menuDisabled(item)"
      @select="runMenuAction(item)"
    >
      <span class="flex-1">{{ menuLabel(item) }}</span>
      <AppShortcutText v-if="menuShortcut(item)">{{ menuShortcut(item) }}</AppShortcutText>
    </DropdownMenuItem>
  </template>
</template>
