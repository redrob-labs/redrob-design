<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/agent/protection'

import type {
  CrossCheckDefinition,
  CrossCheckLevel,
  CrossCheckLevelOption,
  CrossCheckValue
} from './types'

/**
 * When AIs from other companies check the work, per check, after the design
 * system's `CrossCheckSetting`. It states time, never price.
 */
const { checks, levels, heading, lede } = defineProps<{
  checks: CrossCheckDefinition[]
  levels: CrossCheckLevelOption[]
  heading: string
  lede?: string
}>()
defineSlots<{ foot?(): unknown }>()

const model = defineModel<CrossCheckValue>({ required: true })
const styles = tv(theme)()

function set(id: string, level: CrossCheckLevel): void {
  model.value = { ...model.value, [id]: level }
}
</script>

<template>
  <div data-slot="cross-check-setting" :class="styles.panel()">
    <p :class="styles.title()">{{ heading }}</p>
    <p v-if="lede" :class="styles.lede()">{{ lede }}</p>
    <div v-for="check in checks" :key="check.id" :class="styles.check()">
      <p :class="styles.checkName()">{{ check.name }}</p>
      <p :class="styles.checkText()">{{ check.text }}</p>
      <div role="radiogroup" :aria-label="check.name" :class="styles.checkLevels()">
        <button
          v-for="level in levels"
          :key="level.value"
          type="button"
          role="radio"
          :aria-checked="(model[check.id] ?? 'off') === level.value"
          :data-state="(model[check.id] ?? 'off') === level.value ? 'on' : 'off'"
          :class="styles.checkLevel()"
          @click="set(check.id, level.value)"
        >
          {{ level.label }}
        </button>
      </div>
    </div>
    <div v-if="$slots.foot" :class="styles.foot()"><slot name="foot" /></div>
  </div>
</template>
