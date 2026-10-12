<script setup lang="ts">
/**
 * AppButton — the slice's button primitive.
 *
 * A trimmed stand-in for the app's shared `@/components/ui/AppButton.vue`,
 * carrying the size/color/variant surface the ported components actually use
 * (xs/sm sizes; neutral/error colors; solid/ghost/link variants). Themed purely
 * through the semantic tokens in app.css.
 */
import { computed } from 'vue'
import { tv } from 'tailwind-variants'

const {
  size = 'sm',
  color = 'accent',
  variant = 'solid',
  disabled = false,
  type = 'button'
} = defineProps<{
  size?: 'xs' | 'sm'
  color?: 'accent' | 'neutral' | 'error'
  variant?: 'solid' | 'ghost' | 'link'
  disabled?: boolean
  type?: 'button' | 'submit'
}>()

const button = tv({
  base: 'inline-flex cursor-pointer items-center justify-center gap-1 rounded font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
  variants: {
    size: {
      xs: 'h-6 px-2 text-[11px]',
      sm: 'h-8 px-2.5 text-xs'
    },
    color: {
      accent: '',
      neutral: '',
      error: ''
    },
    variant: {
      solid: '',
      ghost: '',
      link: 'bg-transparent px-0 underline-offset-2 hover:underline'
    }
  },
  compoundVariants: [
    { variant: 'solid', color: 'accent', class: 'bg-accent text-on-accent hover:bg-accent-hover' },
    { variant: 'solid', color: 'neutral', class: 'bg-panel-field text-surface hover:bg-panel-field-hover' },
    { variant: 'solid', color: 'error', class: 'bg-error text-on-accent hover:opacity-90' },
    { variant: 'ghost', color: 'accent', class: 'text-accent hover:bg-hover' },
    { variant: 'ghost', color: 'neutral', class: 'text-muted hover:bg-hover hover:text-surface' },
    { variant: 'ghost', color: 'error', class: 'text-danger hover:bg-danger/10' },
    { variant: 'link', color: 'accent', class: 'text-accent' },
    { variant: 'link', color: 'neutral', class: 'text-muted hover:text-surface' },
    { variant: 'link', color: 'error', class: 'text-danger' }
  ]
})

const cls = computed(() => button({ size, color, variant }))
</script>

<template>
  <button :type="type" :disabled="disabled" :class="cls">
    <slot />
  </button>
</template>
