<script setup lang="ts">
// Showcase shell. Components are mounted here as each feature slice lands.
import WindowControls from '@/components/window-controls/WindowControls.vue'
import WorkModelStatus from '@/components/settings/insights/WorkModelStatus.vue'
</script>

<template>
  <main class="flex min-h-full flex-col gap-6 p-8 text-surface">
    <header>
      <h1 class="text-sm font-semibold">Redrob Design — UI slice</h1>
      <p class="text-xs text-muted">Presentation components extracted from PR #89.</p>
    </header>

    <section class="flex flex-col gap-2">
      <h2 class="text-xs font-medium text-muted">Window controls</h2>
      <div class="flex w-fit items-center rounded border border-border bg-canvas">
        <WindowControls />
      </div>
    </section>

    <section class="flex max-w-md flex-col gap-2">
      <h2 class="text-xs font-medium text-muted">Work-model status (insights settings)</h2>
      <WorkModelStatus />
    </section>
  </main>
</template>
