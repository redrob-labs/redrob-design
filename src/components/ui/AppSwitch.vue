<script setup lang="ts">
/**
 * AppSwitch — an accessible toggle. Trimmed stand-in for the app's shared
 * switch, wrapping reka-ui's SwitchRoot (keyboard + ARIA) with a `v-model`
 * boolean and an accessible `label`. Themed through the semantic tokens.
 */
import { SwitchRoot, SwitchThumb } from 'reka-ui'

defineProps<{ label?: string }>()
const model = defineModel<boolean>({ default: false })
</script>

<template>
  <SwitchRoot
    v-model:checked="model"
    :aria-label="label"
    class="relative h-4 w-7 shrink-0 cursor-pointer rounded-full bg-panel-field transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent data-[state=checked]:bg-accent"
  >
    <SwitchThumb
      class="block size-3 translate-x-0.5 rounded-full bg-on-accent transition-transform data-[state=checked]:translate-x-3.5"
    />
  </SwitchRoot>
</template>
