<script setup lang="ts">
import { computed } from 'vue'

import { usePlanMessages } from '@redrob-design/vue'

import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { designMemoryOpen, designMemorySource } from '@/app/memory/service'
import AppDialog from '@/components/ui/dialog/AppDialog.vue'

/** Design Memory in full: colors, type, radii, rules, prices and components. */
const t = usePlanMessages()

const memory = computed(() => {
  if (!designMemoryOpen.value) return null
  const store = getActiveEditorStoreOrNull()
  return store ? designMemorySource().read(store.graph, store.state.documentName) : null
})
const workspace = computed(() => (designMemoryOpen.value ? designMemorySource().workspace() : null))
const origin = computed(() => {
  const status = workspace.value
  if (status?.connected) return t.value.workspaceConnected({ sources: status.sources.join(', ') })
  return `${t.value.memoryFromFile} ${t.value.workspaceNotConnected}`
})
</script>

<template>
  <AppDialog
    v-model:open="designMemoryOpen"
    data-test-id="design-memory-drawer"
    placement="right"
    size="lg"
    :heading="t.memoryHeading"
    :description="memory ? t.memoryDescription({ owner: memory.owner }) : undefined"
    :close-label="t.close"
  >
    <div v-if="memory" class="flex flex-col gap-6 text-xs">
      <p class="text-muted">{{ origin }}</p>

      <p v-if="memory.colors.length === 0" class="text-muted">{{ t.noColors }}</p>
      <section v-for="group in memory.colors" :key="group.name" class="flex flex-col gap-2">
        <h3 class="text-[13px] font-semibold text-surface">
          {{ group.name }}
          <span class="ml-2 font-normal text-muted">{{ group.note }}</span>
        </h3>
        <ul class="flex flex-wrap gap-2">
          <li v-for="swatch in group.swatches" :key="swatch.token" class="flex w-16 flex-col gap-1">
            <span class="h-8 rounded-md border border-border" :style="{ background: swatch.hex }" />
            <code class="truncate text-[10px] text-muted">{{ swatch.token }}</code>
          </li>
        </ul>
      </section>

      <section v-if="memory.typefaces.length > 0" class="flex flex-col gap-2">
        <h3 class="text-[13px] font-semibold text-surface">{{ t.sectionType }}</h3>
        <p v-for="face in memory.typefaces" :key="face.family" class="flex items-baseline gap-3">
          <b class="text-xl text-surface">Aa</b>
          <span class="text-surface">{{ face.family }}</span>
          <span v-if="face.note" class="text-muted">{{ face.note }}</span>
        </p>
      </section>

      <section v-if="memory.radii.length > 0" class="flex flex-col gap-2">
        <h3 class="text-[13px] font-semibold text-surface">{{ t.sectionRadii }}</h3>
        <ul class="flex flex-wrap gap-3">
          <li v-for="radius in memory.radii" :key="radius" class="flex items-center gap-1.5">
            <span
              class="size-6 border-t-2 border-l-2 border-border-strong"
              :style="{ borderTopLeftRadius: `${radius}px` }"
            />
            <span class="text-muted tabular-nums">{{ radius }}</span>
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-2">
        <h3 class="text-[13px] font-semibold text-surface">{{ t.sectionRules }}</h3>
        <ul class="flex flex-col gap-2">
          <li v-for="rule in memory.rules" :key="rule.id" class="flex flex-col">
            <span class="flex items-center gap-1.5 text-surface">
              <icon-lucide-lock
                v-if="rule.locked"
                class="size-3 shrink-0 text-muted"
                :aria-label="t.locked"
              />
              {{ rule.text }}
            </span>
            <span class="text-muted">{{ rule.source }}</span>
          </li>
        </ul>
      </section>

      <section v-if="memory.prices.length > 0" class="flex flex-col gap-2">
        <h3 class="text-[13px] font-semibold text-surface">{{ t.sectionPrices }}</h3>
        <table class="w-full text-left">
          <thead>
            <tr class="text-muted">
              <th class="py-1 font-medium">{{ t.pricePlan }}</th>
              <th class="py-1 font-medium">{{ t.priceValue }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="price in memory.prices" :key="price.plan" class="border-t border-border">
              <th class="py-1 font-medium text-surface">{{ price.plan }}</th>
              <td class="py-1 text-surface tabular-nums">{{ price.price }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="memory.components.length > 0" class="flex flex-col gap-2">
        <h3 class="text-[13px] font-semibold text-surface">
          {{ t.sectionComponents({ count: memory.components.length }) }}
        </h3>
        <div class="flex flex-wrap gap-1">
          <span
            v-for="name in memory.components"
            :key="name"
            class="rounded-full bg-hover px-2 py-0.5 text-muted"
          >
            {{ name }}
          </span>
        </div>
      </section>
    </div>
  </AppDialog>
</template>
