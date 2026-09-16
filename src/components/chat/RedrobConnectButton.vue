<script setup lang="ts">
import { computed } from 'vue'
import { tv } from 'tailwind-variants'
import { useI18n } from '@redrob-design/vue'

import statusTheme from '@/theme/status'

import { formatUserCode, type DeviceAuthorization } from '@/app/ai/connect/device-connect'

export type RedrobConnectStatus =
  | 'idle'
  | 'starting'
  | 'waiting'
  | 'connected'
  | 'denied'
  | 'expired'
  | 'unreachable'
  | 'failed'

interface RedrobConnectButtonProps {
  status: RedrobConnectStatus
  authorization?: DeviceAuthorization | null
}

const { status, authorization = null } = defineProps<RedrobConnectButtonProps>()
const emit = defineEmits<{ connect: []; cancel: [] }>()
const { ai } = useI18n()

const isBusy = computed(() => status === 'starting' || status === 'waiting')

const resultMessage = computed(() => {
  switch (status) {
    case 'waiting':
      return authorization
        ? ai.value.connectRedrobWaiting({
            code: formatUserCode(authorization.userCode),
            url: authorization.verificationURI
          })
        : null
    case 'connected':
      return ai.value.connectRedrobConnected
    case 'denied':
      return ai.value.connectRedrobDenied
    case 'expired':
      return ai.value.connectRedrobExpired
    case 'unreachable':
      return ai.value.connectRedrobUnreachable
    case 'failed':
      return ai.value.connectRedrobFailed
    default:
      return null
  }
})

const resultTone = computed(() => {
  if (status === 'connected') return 'success'
  if (status === 'waiting') return 'neutral'
  return 'error'
})
const statusStyles = computed(() => tv(statusTheme)({ tone: resultTone.value }))
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="flex items-center gap-2">
      <button
        type="button"
        data-test-id="provider-connect-redrob"
        class="rounded border border-panel bg-panel px-2 py-1 text-[11px] font-medium text-surface hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="isBusy"
        @click="emit('connect')"
      >
        <span class="inline-flex items-center justify-center gap-1.5">
          <icon-lucide-loader-2 v-if="isBusy" class="size-3 animate-spin" />
          <icon-lucide-key-round v-else class="size-3" />
          {{ ai.connectRedrob }}
        </span>
      </button>

      <button
        v-if="isBusy"
        type="button"
        data-test-id="provider-connect-redrob-cancel"
        class="rounded px-2 py-1 text-[11px] text-muted hover:text-surface"
        @click="emit('cancel')"
      >
        {{ ai.connectRedrobCancel }}
      </button>
    </div>

    <!-- The verification URL is shown as text, not a link: the user code has to be read
         off this screen anyway, and Console's page is where approval happens. -->
    <p
      v-if="resultMessage"
      :data-tone="resultTone"
      :class="statusStyles.text()"
      data-test-id="provider-connect-redrob-status"
    >
      {{ resultMessage }}
    </p>
    <p v-else class="text-[11px] text-muted">{{ ai.connectRedrobHint }}</p>
  </div>
</template>
