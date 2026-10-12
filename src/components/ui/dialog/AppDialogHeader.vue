<script setup lang="ts">
/**
 * AppDialogHeader — title row for AppDialogRoot. Renders the reka-ui
 * DialogTitle/DialogDescription (so screen readers announce them) plus a close
 * button wired to DialogClose. Props mirror the app: `heading`, optional
 * `description`, and an accessible `close-label`.
 */
import { DialogTitle, DialogDescription, DialogClose } from 'reka-ui'

defineProps<{
  heading: string
  description?: string
  closeLabel?: string
}>()
</script>

<template>
  <header class="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
    <div class="flex flex-col gap-0.5">
      <DialogTitle class="text-sm font-semibold text-surface">{{ heading }}</DialogTitle>
      <DialogDescription v-if="description" class="text-xs text-muted">
        {{ description }}
      </DialogDescription>
    </div>
    <DialogClose
      :aria-label="closeLabel"
      class="rounded p-1 text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent"
    >
      <icon-lucide-x class="size-4" />
    </DialogClose>
  </header>
</template>
