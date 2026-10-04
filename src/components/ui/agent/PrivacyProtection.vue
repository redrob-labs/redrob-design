<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/agent/protection'

import ProtectionStatus from './ProtectionStatus.vue'
import type { PrivacyLevel } from './types'

/**
 * What privacy protection does with each message, after the design system's
 * `PrivacyProtection`. The level is the admin's: the person reads it here and
 * never changes it.
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
  offText
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
}>()
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
    <ul :class="styles.levels()">
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
