<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import theme from '@/theme/agent/controls'

import type { ComposerStatusItem } from './types'

/**
 * The status line under the composer: Privacy, Memory and Cross-check, read
 * as promises rather than switches. Each item opens its panel (`panel-<id>`
 * slot) above the composer.
 */
const { items, label } = defineProps<{ items: ComposerStatusItem[]; label: string }>()
defineSlots<Record<`panel-${string}`, () => unknown>>()

/** The open item's id, or null. */
const open = defineModel<string | null>('open', { default: null })
const styles = tv(theme)()

function setOpen(id: string, value: boolean): void {
  if (value) open.value = id
  else if (open.value === id) open.value = null
}
</script>

<template>
  <div role="group" :aria-label="label" data-slot="composer-status" :class="styles.status()">
    <PopoverRoot
      v-for="item in items"
      :key="item.id"
      :open="open === item.id"
      @update:open="setOpen(item.id, $event)"
    >
      <PopoverTrigger
        :data-status-id="item.id"
        :aria-label="`${item.name}: ${item.value}`"
        :class="styles.statusItem()"
      >
        <icon-lucide-shield-check
          v-if="item.id === 'privacy'"
          :data-tone="item.tone ?? 'plain'"
          :class="styles.statusIcon()"
        />
        <icon-lucide-book-open
          v-else-if="item.id === 'memory'"
          :data-tone="item.tone ?? 'plain'"
          :class="styles.statusIcon()"
        />
        <icon-lucide-git-compare
          v-else
          :data-tone="item.tone ?? 'plain'"
          :class="styles.statusIcon()"
        />
        <span :class="styles.statusName()">{{ item.name }}</span>
        <span :class="styles.statusValue()">{{ item.value }}</span>
        <span v-if="item.level" aria-hidden="true" :class="styles.statusBars()">
          <span
            v-for="n in item.level.of"
            :key="n"
            :data-on="n <= item.level.n"
            :class="styles.statusBar()"
            :style="{ height: `${4 + n * 2}px` }"
          />
        </span>
        <span v-if="item.live" aria-hidden="true" :class="styles.statusLive()" />
        <span v-if="item.live" class="sr-only">{{ item.live }}</span>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent
          side="top"
          align="start"
          :side-offset="8"
          :collision-padding="8"
          :aria-label="item.panelLabel ?? item.name"
          :class="styles.statusPanel()"
        >
          <slot :name="`panel-${item.id}`" />
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>
