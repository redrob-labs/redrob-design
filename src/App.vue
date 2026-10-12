<script setup lang="ts">
// Showcase shell. Components are mounted here as each feature slice lands.
import WindowControls from '@/components/window-controls/WindowControls.vue'
import WorkModelStatus from '@/components/settings/insights/WorkModelStatus.vue'
import ModelGuideDialog from '@/components/chat/ModelGuideDialog.vue'
import TabBar from '@/components/TabBar.vue'
import ModelsPanel from '@/components/settings/models/ModelsPanel.vue'
</script>

<template>
  <div class="flex min-h-full flex-col">
    <TabBar />
    <main class="flex flex-1 flex-col gap-6 p-8 text-surface">
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

    <section class="flex flex-col gap-2">
      <h2 class="text-xs font-medium text-muted">Model Guide dialog</h2>
      <ModelGuideDialog />
    </section>

    <section class="flex max-w-lg flex-col gap-2">
      <h2 class="text-xs font-medium text-muted">Models settings panel</h2>
      <div class="flex max-h-[32rem] flex-col rounded border border-border bg-panel p-3">
        <ModelsPanel />
      </div>
    </section>
    </main>
  </div>
</template>
