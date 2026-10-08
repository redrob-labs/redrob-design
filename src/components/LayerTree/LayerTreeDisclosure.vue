<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

import { usePanelMessages } from '@redrob-design/vue'

import { useLayerTreeUI } from './ui'

import layerTreeTheme from '@/theme/layer-tree'

const { expanded, visible, name } = defineProps<{
  expanded: boolean
  visible: boolean
  /** The layer's name, so the toggle says whose children it shows. */
  name: string
}>()

const emit = defineEmits<{
  toggle: []
}>()

const panels = usePanelMessages()
const ui = useLayerTreeUI()
const layerTree = tv(layerTreeTheme)
const styles = computed(() => layerTree({ expanded }))
</script>

<template>
  <button
    v-if="visible"
    type="button"
    data-slot="disclosure"
    :aria-label="panels.layerChildren({ name })"
    :aria-expanded="expanded"
    :data-expanded="expanded || undefined"
    :class="styles.disclosure({ class: ui?.disclosure })"
    @click.stop="emit('toggle')"
  >
    <icon-lucide-chevron-right class="size-3" />
  </button>
  <span
    v-else
    data-slot="disclosure-placeholder"
    :class="styles.disclosurePlaceholder({ class: ui?.disclosurePlaceholder })"
  />
</template>
