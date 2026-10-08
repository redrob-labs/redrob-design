<script setup lang="ts">
import { computed, ref } from 'vue'
import { tv } from 'tailwind-variants'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import theme from '@/theme/agent/controls'

import type { ModelPick, ModelRankingSource } from './types'

/**
 * Redrob Auto, or one pinned pick from the ranking, after the design system's
 * `ModelPicker`. Picks that run somewhere other than `here` stay at their true
 * place, grayed out and not selectable. Effort shows only on a pinned pick.
 */
const {
  picks,
  here,
  label,
  autoLabel,
  autoText,
  heading,
  effortLabel,
  awayLabel,
  source,
  limit = 5
} = defineProps<{
  picks: ModelPick[]
  here: string
  label: string
  autoLabel: string
  autoText: string
  heading: string
  effortLabel: string
  awayLabel: (harness: string) => string
  source?: ModelRankingSource
  limit?: number
}>()

/** The pinned pick's id, or null for Redrob Auto. */
const value = defineModel<string | null>({ default: null })
/** The effort level set on the pinned pick, or null for the ranked one. */
const effort = defineModel<number | null>('effort', { default: null })

const open = ref(false)
const styles = tv(theme)()
const shown = computed(() => picks.slice(0, limit))
const pinned = computed(() => picks.find((pick) => pick.id === value.value) ?? null)
const triggerText = computed(() => {
  const pick = pinned.value
  if (!pick) return autoLabel
  const level = pick.efforts?.find((candidate) => candidate.level === effort.value)
  return level ? `${pick.short ?? pick.model} · ${level.label}` : (pick.short ?? pick.model)
})

function choose(id: string | null): void {
  value.value = id
  effort.value = null
  if (id === null) open.value = false
}

function setEffort(level: number): void {
  effort.value = pinned.value?.effort.level === level ? null : level
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger data-slot="model-picker" :aria-label="label" :class="styles.pickerTrigger()">
      <icon-lucide-sparkles v-if="!pinned" class="size-3.5 shrink-0 text-accent" />
      <icon-lucide-pin v-else class="size-3.5 shrink-0 text-muted" />
      <span :class="styles.pickerTriggerValue()">{{ triggerText }}</span>
      <icon-lucide-chevron-down class="size-3 shrink-0 text-muted" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        side="top"
        align="end"
        :side-offset="6"
        :collision-padding="8"
        :class="styles.pickerContent()"
      >
        <button
          type="button"
          :data-state="pinned ? 'off' : 'on'"
          :class="styles.pickerOption()"
          @click="choose(null)"
        >
          <icon-lucide-sparkles class="mt-0.5 size-4 shrink-0 text-accent" />
          <span :class="styles.pickerText()">
            <span :class="styles.pickerName()">{{ autoLabel }}</span>
            <span :class="styles.pickerWhy()">{{ autoText }}</span>
          </span>
          <icon-lucide-check v-if="!pinned" :class="styles.pickerCheck()" />
        </button>
        <p :class="styles.pickerHeading()">{{ heading }}</p>
        <button
          v-for="(pick, index) in shown"
          :key="pick.id"
          type="button"
          :disabled="pick.harness !== here"
          :data-state="pinned?.id === pick.id ? 'on' : 'off'"
          :class="styles.pickerOption()"
          @click="choose(pick.id)"
        >
          <span :class="styles.pickerPlace()">{{ index + 1 }}</span>
          <span :class="styles.pickerText()">
            <span :class="styles.pickerName()">{{ pick.model }}</span>
            <span :class="styles.pickerMeta()">
              {{ pick.harness === here ? pick.effort.label : awayLabel(pick.harness) }}
            </span>
            <span v-if="pick.why" :class="styles.pickerWhy()">{{ pick.why }}</span>
          </span>
          <icon-lucide-check v-if="pinned?.id === pick.id" :class="styles.pickerCheck()" />
        </button>
        <div
          v-if="pinned && pinned.efforts && pinned.efforts.length > 1"
          role="group"
          :aria-label="effortLabel"
          :class="styles.pickerEffort()"
        >
          <button
            v-for="level in pinned.efforts"
            :key="level.level"
            type="button"
            :aria-pressed="(effort ?? pinned.effort.level) === level.level"
            :data-state="(effort ?? pinned.effort.level) === level.level ? 'on' : 'off'"
            :class="styles.pickerEffortItem()"
            @click="setEffort(level.level)"
          >
            {{ level.label }}
          </button>
        </div>
        <p v-if="source" :class="styles.pickerFoot()">
          {{ [source.name, source.edition].filter(Boolean).join(', ') }}
        </p>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
