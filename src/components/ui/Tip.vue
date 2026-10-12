<script setup lang="ts">
/**
 * Tip — a lightweight tooltip wrapper around reka-ui's Tooltip, matching the
 * app's `@/components/ui/Tip.vue` surface (`label`, optional `side`). The
 * trigger is the default slot.
 */
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger
} from 'reka-ui'

defineProps<{ label: string; side?: 'top' | 'bottom' | 'left' | 'right' }>()
</script>

<template>
  <TooltipProvider :delay-duration="300">
    <TooltipRoot>
      <TooltipTrigger as-child>
        <slot />
      </TooltipTrigger>
      <TooltipPortal>
        <TooltipContent
          :side="side ?? 'top'"
          :side-offset="4"
          class="z-50 rounded bg-surface px-2 py-1 text-[11px] text-canvas shadow-md"
        >
          {{ label }}
          <TooltipArrow class="fill-surface" />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
