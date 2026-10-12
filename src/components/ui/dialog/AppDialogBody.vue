<script setup lang="ts">
/**
 * AppDialogBody — the scrollable content region of a dialog. Trimmed stand-in
 * for the app's shared body; just a padded, overflow-scrolling slot host.
 */
</script>

<template>
  <div class="flex-1 overflow-y-auto px-4 py-3">
    <slot />
  </div>
</template>
