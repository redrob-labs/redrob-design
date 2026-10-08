<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/agent/protection'

import ProtectionStatus from './ProtectionStatus.vue'
import type { PrivacyLevel } from './types'

/**
 * What privacy protection does with each message, after the design system's
 * `PrivacyProtection`. When an admin sets the level the person only reads it;
 * with `selectable` the levels become a choice and emit `update:level`.
 */
const {
  level,
  levels,
  heading,
  running,
  summary,
  lede,
  state = 'on',
  offTitle,
  offText,
  selectable = false
} = defineProps<{
  level: string
  levels: PrivacyLevel[]
  heading: string
  running?: string
  summary?: string
  lede?: string
  state?: 'on' | 'off'
  offTitle?: string
  offText?: string
  selectable?: boolean
}>()
const emit = defineEmits<{ 'update:level': [level: string] }>()
defineSlots<{ foot?(): unknown; last?(): unknown }>()

const styles = tv(theme)()
</script>

<template>
  <div data-slot="privacy-protection" :class="styles.panel()">
    <ProtectionStatus v-if="state === 'off'" :heading="offTitle ?? heading" tone="warn">
      {{ offText }}
    </ProtectionStatus>
    <ProtectionStatus v-else :heading="heading" tone="safe" :live="running">
      {{ summary }}
    </ProtectionStatus>
    <p v-if="lede" :class="styles.lede()">{{ lede }}</p>
    <p v-if="$slots.last" :class="styles.lede()"><slot name="last" /></p>
    <div v-if="selectable" role="radiogroup" :aria-label="heading" :class="styles.levels()">
      <button
        v-for="item in levels"
        :key="item.id"
        type="button"
        role="radio"
        :aria-checked="item.id === level ? 'true' : 'false'"
        :data-state="item.id === level ? 'on' : 'off'"
        :class="styles.level()"
        class="w-full cursor-pointer text-left hover:bg-hover focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none"
        @click="emit('update:level', item.id)"
      >
        <icon-lucide-check v-if="item.id === level" class="mt-0.5 size-3.5 shrink-0 text-accent" />
        <span v-else class="size-3.5 shrink-0" />
        <span>
          <span :class="styles.levelName()">{{ item.label }}</span>
          <span :class="styles.levelDetail()"> {{ item.detail }}</span>
        </span>
      </button>
    </div>
    <ul v-else :class="styles.levels()">
      <li
        v-for="item in levels"
        :key="item.id"
        :data-state="item.id === level ? 'on' : 'off'"
        :aria-current="item.id === level ? 'true' : undefined"
        :class="styles.level()"
      >
        <icon-lucide-check v-if="item.id === level" class="mt-0.5 size-3.5 shrink-0 text-accent" />
        <span v-else class="size-3.5 shrink-0" />
        <span>
          <span :class="styles.levelName()">{{ item.label }}</span>
          <span :class="styles.levelDetail()"> {{ item.detail }}</span>
        </span>
      </li>
    </ul>
    <div v-if="$slots.foot" :class="styles.foot()"><slot name="foot" /></div>
  </div>
</template>
