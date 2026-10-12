<script setup lang="ts">
/**
 * RedrobConnectButton — the "Connect to Redrob" device-flow affordance.
 * Presentational stand-in for the app's connect button: reflects the device-flow
 * status and shows the authorization code when waiting. In this slice the flow
 * is a backend no-op (see the ai/connect stub); the button renders every state.
 */
export type RedrobConnectStatus =
  | 'idle'
  | 'starting'
  | 'waiting'
  | 'connected'
  | 'unreachable'
  | 'cancelled'

interface DeviceAuthorization {
  userCode: string
  verificationUri: string
}

defineProps<{
  status: RedrobConnectStatus
  authorization?: DeviceAuthorization | null
}>()
const emit = defineEmits<{ connect: []; cancel: [] }>()
</script>

<template>
  <div class="flex flex-col gap-1">
    <button
      v-if="status === 'idle' || status === 'unreachable' || status === 'cancelled'"
      type="button"
      class="w-fit rounded bg-accent px-2.5 py-1.5 text-[11px] font-medium text-on-accent hover:bg-accent-hover"
      @click="emit('connect')"
    >
      Connect to Redrob
    </button>
    <template v-else>
      <p class="text-[11px] text-surface">
        {{ status === 'connected' ? 'Connected' : 'Waiting for authorisation…' }}
      </p>
      <p v-if="authorization" class="text-[10px] text-muted">
        Enter code <span class="font-mono text-surface">{{ authorization.userCode }}</span>
      </p>
      <button
        v-if="status === 'waiting' || status === 'starting'"
        type="button"
        class="w-fit text-[10px] text-muted hover:text-surface"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </template>
    <p v-if="status === 'unreachable'" class="text-[10px] text-danger">
      Could not reach Redrob.
    </p>
  </div>
</template>
