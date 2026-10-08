<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useCloudMessages } from '@redrob-design/vue'

import {
  activeWorkspaceId,
  cancelCloudSignIn,
  cloudState,
  refreshCloudAccount,
  selectWorkspace,
  signInToCloud,
  signOutOfCloud
} from '@/app/integrations/console/session'
import { openExternalLink } from '@/app/shell/ui'
import SettingsSectionHeader from '@/components/settings/layout/SettingsSectionHeader.vue'
import AppButton from '@/components/ui/AppButton.vue'

/**
 * Redrob Cloud: optional sign-in to Redrob Console, and the workspace Cloud
 * features read from. The session token goes to the credential store and
 * never reaches this component.
 */
const t = useCloudMessages()

const problem = computed(() => {
  if (cloudState.status === 'unreachable') return t.value.unreachable
  if (cloudState.error === 'denied') return t.value.denied
  if (cloudState.error === 'expired') return t.value.expired
  return null
})

function onWorkspace(event: Event): void {
  if (event.target instanceof HTMLSelectElement) selectWorkspace(event.target.value)
}

onMounted(() => void refreshCloudAccount())
</script>

<template>
  <section class="flex flex-col gap-3 text-xs" data-test-id="settings-cloud-panel">
    <SettingsSectionHeader>
      {{ t.heading }}
      <template #description>{{ t.description }}</template>
    </SettingsSectionHeader>

    <p v-if="problem" role="alert" class="text-error">{{ problem }}</p>

    <template v-if="cloudState.status === 'signing-in'">
      <p class="text-surface">{{ t.signingIn }}</p>
      <p
        v-if="cloudState.signIn"
        data-slot="cloud-user-code"
        class="font-mono text-lg font-semibold tracking-widest text-surface"
      >
        {{ cloudState.signIn.userCode }}
      </p>
      <div class="flex flex-wrap gap-2">
        <AppButton
          v-if="cloudState.signIn"
          color="primary"
          variant="solid"
          @click="openExternalLink(cloudState.signIn.verificationURIComplete)"
        >
          <template #leading><icon-lucide-external-link /></template>
          {{ t.openConsole }}
        </AppButton>
        <AppButton color="neutral" variant="ghost" @click="cancelCloudSignIn">
          {{ t.cancel }}
        </AppButton>
      </div>
    </template>

    <template v-else-if="cloudState.account">
      <p class="text-surface" data-slot="cloud-account">
        {{ t.signedInAs({ name: cloudState.account.name }) }}
      </p>
      <label v-if="cloudState.account.workspaces.length > 0" class="flex flex-col gap-1 text-muted">
        {{ t.workspace }}
        <select
          class="h-7 rounded-sm border border-border bg-panel-field px-2 text-surface focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none"
          :value="activeWorkspaceId ?? ''"
          @change="onWorkspace"
        >
          <option
            v-for="workspace in cloudState.account.workspaces"
            :key="workspace.id"
            :value="workspace.id"
          >
            {{ workspace.name }}
          </option>
        </select>
      </label>
      <p v-else class="text-muted">{{ t.noWorkspace }}</p>
      <AppButton class="self-start" color="neutral" variant="outline" @click="signOutOfCloud">
        {{ t.signOut }}
      </AppButton>
    </template>

    <template v-else>
      <p class="text-muted">{{ t.signedOut }}</p>
      <AppButton class="self-start" color="primary" variant="solid" @click="signInToCloud()">
        {{ t.signIn }}
      </AppButton>
    </template>
  </section>
</template>
