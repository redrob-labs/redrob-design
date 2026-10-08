<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import AppButton from '@/components/ui/AppButton.vue'
import theme from '@/theme/agent/changes'

import type { ChangeItem, ChangesWords } from './types'

/**
 * What an agent altered, in plain words, with the two buttons that decide if
 * it stays. Not a code diff. After the design system's `Changes`.
 */
const { heading, summary, items, words } = defineProps<{
  heading: string
  /** "3 changes", already in the reader's language. */
  summary: string
  items: ChangeItem[]
  words: ChangesWords
}>()

const emit = defineEmits<{ accept: []; reject: [] }>()

const styles = tv(theme)()
const groupLabel = computed(() => `${heading}: ${summary}`)
</script>

<template>
  <div data-slot="changes" role="group" :aria-label="groupLabel" :class="styles.root()">
    <div :class="styles.head()">
      <span :class="styles.heading()">{{ heading }}</span>
      <span :class="styles.count()">{{ summary }}</span>
    </div>
    <div :class="styles.body()">
      <div
        v-for="item in items"
        :key="item.id"
        data-slot="changes-item"
        :data-kind="item.kind"
        :class="styles.item()"
      >
        <div :class="styles.where()">
          <span :data-kind="item.kind" :class="styles.kind()">{{ words.kinds[item.kind] }}</span>
          <span v-if="item.label" :class="styles.label()">{{ item.label }}</span>
        </div>
        <p v-if="item.before !== undefined" :class="[styles.line(), styles.before()]">
          <span :class="styles.tag()">{{ words.was }}</span
          >{{ item.before }}
        </p>
        <p v-if="item.after !== undefined" :class="[styles.line(), styles.after()]">
          <span :class="styles.tag()">{{ words.now }}</span
          >{{ item.after }}
        </p>
        <p v-if="item.note" :class="styles.note()">{{ item.note }}</p>
      </div>
    </div>
    <div :class="styles.foot()">
      <AppButton
        color="neutral"
        variant="outline"
        data-slot="changes-reject"
        @click="emit('reject')"
      >
        {{ words.reject }}
      </AppButton>
      <AppButton color="primary" variant="solid" data-slot="changes-accept" @click="emit('accept')">
        {{ words.accept }}
      </AppButton>
    </div>
  </div>
</template>
