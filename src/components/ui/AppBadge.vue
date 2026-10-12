<script setup lang="ts">
/**
 * AppBadge — a small inline pill used to tag a value (e.g. a pick's effort or
 * kind in the Model Guide). Trimmed stand-in for the app's shared badge; themed
 * through the semantic tokens.
 */
</script>

<template>
  <span
    class="inline-flex items-center rounded-full bg-panel-field px-1.5 py-0.5 text-[10px] font-medium text-muted"
  >
    <slot />
  </span>
</template>
