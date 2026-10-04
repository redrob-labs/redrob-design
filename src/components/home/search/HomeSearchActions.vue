<script setup lang="ts">
import { nextTick, watch } from 'vue'
import { templateRef } from '@vueuse/core'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'

import { useHomeMessages, useI18n, useViewportKind } from '@redrob-design/vue'

import Tip from '@/components/ui/Tip.vue'
import { useMenuUI } from '@/components/ui/menu'
import { START_PRESETS, type StartPreset, startFromPreset } from '@/app/home/brief'
import { openFileDialog } from '@/app/shell/menu/use'
import { activeTab } from '@/app/tabs'

const emit = defineEmits<{ 'new-document': [] }>()
const query = defineModel<string>({ required: true })
const { menu, files } = useI18n()
const t = useHomeMessages()
const { isMobile } = useViewportKind()
const searchInput = templateRef<HTMLInputElement>('searchInput')
const menuCls = useMenuUI({ content: 'min-w-56', item: 'text-xs' })

async function focusSearch(): Promise<void> {
  if (isMobile.value || activeTab.value?.kind !== 'home') return
  await nextTick()
  setTimeout(() => searchInput.value?.focus(), 300)
}

watch(
  () => activeTab.value?.id,
  () => void focusSearch(),
  { immediate: true }
)

function presetLabel(preset: StartPreset): string {
  switch (preset.id) {
    case 'phone':
      return t.value.newPhone
    case 'website':
      return t.value.newWebsite
    case 'social':
      return t.value.newSocial
    default:
      return t.value.newBlank
  }
}

function start(preset: StartPreset): void {
  if (preset.id === 'blank') {
    emit('new-document')
    return
  }
  void startFromPreset(preset, presetLabel(preset))
}
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
    <label
      class="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-panel px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30 sm:h-9 sm:max-w-80"
    >
      <icon-lucide-search class="size-4 shrink-0 text-muted" />
      <input
        ref="searchInput"
        v-model="query"
        type="search"
        name="file-search"
        autocomplete="off"
        class="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted"
        :placeholder="isMobile ? files.searchFiles : files.searchRecentAndStorageFiles"
        :aria-label="files.searchFiles"
      />
    </label>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border bg-panel px-3 text-[13px] text-surface outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent sm:flex-none"
        data-test-id="home-open-file"
        @click="openFileDialog"
      >
        <icon-lucide-folder-open class="size-4 text-muted" />
        {{ menu.open }}
      </button>
      <div class="flex flex-1 items-stretch sm:flex-none">
        <button
          type="button"
          class="flex h-9 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-l-md bg-accent px-3 text-[13px] font-semibold text-on-accent outline-none hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          data-test-id="home-new-document"
          @click="emit('new-document')"
        >
          <icon-lucide-plus class="size-4" />
          {{ t.newMenu }}
        </button>
        <DropdownMenuRoot :modal="false">
          <Tip :label="t.newPresets">
            <DropdownMenuTrigger
              data-test-id="home-new-presets"
              :aria-label="t.newPresets"
              class="flex h-9 w-8 cursor-pointer items-center justify-center rounded-r-md border-l border-on-accent/30 bg-accent text-on-accent outline-none hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <icon-lucide-chevron-down class="size-4" />
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuPortal>
            <DropdownMenuContent align="end" :side-offset="4" :class="menuCls.content">
              <DropdownMenuItem
                v-for="preset in START_PRESETS"
                :key="preset.id"
                :data-preset="preset.id"
                :class="menuCls.item"
                @select="start(preset)"
              >
                <span class="flex-1">{{ presetLabel(preset) }}</span>
                <span v-if="preset.width" class="text-muted tabular-nums"
                  >{{ preset.width }} × {{ preset.height }}</span
                >
              </DropdownMenuItem>
              <DropdownMenuSeparator :class="menuCls.separator" />
              <DropdownMenuItem :class="menuCls.item" @select="openFileDialog">
                <span class="flex-1">{{ t.openFile }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>
    </div>
  </div>
</template>
