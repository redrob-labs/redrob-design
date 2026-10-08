<script setup lang="ts">
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { useCollabPanelContext } from '@/components/CollabPanel/context'

const collab = useCollabPanelContext()
</script>

<template>
  <div class="flex flex-col gap-1.5 border-t border-border pt-3">
    <label for="collab-open-input" class="text-muted">{{ collab.messages.openShared }}</label>
    <div class="flex items-center gap-1.5">
      <AppInput
        id="collab-open-input"
        v-model="collab.openInput"
        data-test-id="collab-open-input"
        :placeholder="collab.messages.pasteLink"
        class="min-w-0 flex-1"
        @enter="collab.openShared"
      />
      <AppButton
        data-test-id="collab-open-button"
        color="primary"
        variant="solid"
        :disabled="!collab.openInput.trim() || collab.busy"
        @click="collab.openShared"
      >
        {{ collab.messages.open }}
      </AppButton>
    </div>
  </div>
</template>
