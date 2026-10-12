<script setup lang="ts">
/**
 * AppDialogRoot — the slice's modal shell. Trimmed stand-in for the app's shared
 * dialog, wrapping reka-ui's accessible Dialog (focus trap, Esc, scroll lock)
 * and carrying the `size`/`height` surface the ported components pass. The
 * open state is a `v-model:open` so callers drive it exactly as in the app.
 */
import { computed } from 'vue'
import { DialogRoot, DialogPortal, DialogOverlay, DialogContent } from 'reka-ui'
import { tv } from 'tailwind-variants'

const { size = 'md', height = 'auto' } = defineProps<{
  size?: 'md' | 'lg' | 'xl'
  height?: 'auto' | 'tall'
}>()

const open = defineModel<boolean>('open', { default: false })

const content = tv({
  base: 'fixed left-1/2 top-1/2 z-50 flex w-[92vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-border bg-canvas shadow-xl outline-none',
  variants: {
    size: { md: 'max-w-md', lg: 'max-w-xl', xl: 'max-w-3xl' },
    height: { auto: 'max-h-[85vh]', tall: 'h-[85vh]' }
  }
})

const cls = computed(() => content({ size, height }))
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
      <DialogContent :class="cls">
        <slot />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
