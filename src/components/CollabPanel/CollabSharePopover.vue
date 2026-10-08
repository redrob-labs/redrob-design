<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui'

import FileAccess from '@/components/CollabPanel/FileAccess.vue'
import OpenSharedFile from '@/components/CollabPanel/OpenSharedFile.vue'
import { useCollabPanelContext } from '@/components/CollabPanel/context'
import AppButton from '@/components/ui/AppButton.vue'
import { usePopoverUI } from '@/components/ui/popover'
import collaborationTheme from '@/theme/collaboration'

const collab = useCollabPanelContext()
const cls = usePopoverUI({ content: 'z-50 w-80 p-3' })
const connection = computed(() => (collab.state.connected ? 'connected' : 'idle'))
const collaboration = tv(collaborationTheme)
const styles = computed(() => collaboration({ connection: connection.value }))
</script>

<template>
  <PopoverRoot v-model:open="collab.popoverOpen">
    <PopoverTrigger as-child>
      <button
        data-test-id="collab-share-button"
        :data-connection="connection"
        :class="styles.shareButton()"
      >
        <icon-lucide-share-2 class="size-3.5" />
        {{ collab.file && collab.file.link ? collab.messages.viewOnly : collab.messages.share }}
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent
        data-test-id="collab-popover"
        :class="cls.content"
        :side-offset="8"
        side="bottom"
        align="end"
      >
        <div class="flex flex-col gap-3 text-xs">
          <p v-if="collab.error" role="alert" class="text-error">{{ collab.error }}</p>

          <template v-if="collab.file">
            <FileAccess v-if="!collab.file.link" />
            <p v-else class="text-muted">{{ collab.messages.viewLinkOn }}</p>
          </template>

          <template v-else-if="collab.signedIn">
            <div class="font-medium text-surface">{{ collab.messages.shareThisFile }}</div>
            <p class="text-muted">{{ collab.messages.shareDescription }}</p>
            <AppButton
              data-test-id="collab-share-file"
              color="primary"
              variant="solid"
              size="md"
              :loading="collab.busy"
              @click="collab.share"
            >
              <icon-lucide-share-2 class="size-3.5" />
              {{ collab.messages.shareThisFile }}
            </AppButton>
          </template>

          <template v-else>
            <p class="text-muted">{{ collab.messages.signInToShare }}</p>
            <AppButton color="primary" variant="solid" size="md" @click="collab.signIn">
              {{ collab.messages.signIn }}
            </AppButton>
          </template>

          <OpenSharedFile />
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
