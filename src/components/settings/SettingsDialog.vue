<script setup lang="ts">
import { DialogClose } from 'reka-ui'
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import type { Component } from 'vue'
import { tv } from 'tailwind-variants'
import { useI18n } from '@redrob-design/vue'
import { IS_TAURI } from '@redrob-design/core/constants'

import IconActivity from '~icons/lucide/activity'
import IconChart from '~icons/lucide/chart-no-axes-column'
import IconCloud from '~icons/lucide/cloud'
import IconCloudCog from '~icons/lucide/cloud-cog'
import IconPlug from '~icons/lucide/plug'
import IconSliders from '~icons/lucide/sliders-horizontal'

import { useAIChat } from '@/app/ai/chat/use'
import { appCredentialServices } from '@/app/settings/credentials/app'
import {
  SETTINGS_NAVIGATION,
  type SettingsSection,
  settingsDialogFocus,
  settingsDialogOpen,
  settingsDialogSection
} from '@/app/settings/dialog'
import CloudSettingsPanel from '@/components/settings/cloud/CloudSettingsPanel.vue'
import DiagnosticsSettingsPanel from '@/components/settings/diagnostics/DiagnosticsSettingsPanel.vue'
import GeneralSettingsPanel from '@/components/settings/general/GeneralSettingsPanel.vue'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import MCPConnectionsSection from '@/components/settings/mcp/MCPConnectionsSection.vue'
import MCPSettingsPanel from '@/components/settings/mcp/MCPSettingsPanel.vue'
import ModelsPanel from '@/components/settings/models/ModelsPanel.vue'
import StockPhotoKeysSection from '@/components/settings/provider/StockPhotoKeysSection.vue'
import UsageSettingsPanel from '@/components/settings/usage/UsageSettingsPanel.vue'
import StorageSettingsPanel from '@/components/settings/storage/StorageSettingsPanel.vue'
import VectorizeSettingsSection from '@/components/settings/vectorize/VectorizeSettingsSection.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import { AppDialogFooter, AppDialogHeader, AppDialogRoot } from '@/components/ui/dialog'
import settingsDialogTheme from '@/theme/settings-dialog'

const { credentials, settings, common } = useI18n()
const { browserCredentialsRemembered, setRememberCredentials } = useAIChat()
const styles = tv(settingsDialogTheme)()
const body = useTemplateRef<HTMLElement>('body')

function onOpenChange(open: boolean): void {
  settingsDialogOpen.value = open
}

const rememberCredentials = computed({
  get: () => browserCredentialsRemembered.value,
  set: (remembered: boolean) => {
    void setRememberCredentials(remembered)
  }
})

const credentialBackendLabel = computed(() => {
  void browserCredentialsRemembered.value
  if (appCredentialServices.manager.backend === 'native') return credentials.value.backendNative
  if (appCredentialServices.manager.backend === 'browser') {
    return credentials.value.backendBrowser
  }
  return credentials.value.backendMemory
})

const SECTION_ICONS: Record<SettingsSection, Component> = {
  general: IconSliders,
  mcp: IconPlug,
  storage: IconCloud,
  cloud: IconCloudCog,
  usage: IconChart,
  diagnostics: IconActivity
}

const sectionLabels = computed<Record<SettingsSection, string>>(() => ({
  general: settings.value.general,
  mcp: settings.value.sectionAgentsAndMCP,
  storage: settings.value.sectionStorage,
  cloud: settings.value.sectionCloud,
  usage: settings.value.usage,
  diagnostics: settings.value.diagnostics
}))

const groupLabels = computed(() => ({
  preferences: settings.value.navPreferences,
  connections: settings.value.navConnections,
  account: settings.value.navAccount
}))

function selectSection(section: SettingsSection): void {
  settingsDialogSection.value = section
  settingsDialogFocus.value = null
}

watch(
  [settingsDialogOpen, settingsDialogSection, settingsDialogFocus],
  async ([open, , focus]) => {
    if (!open || !focus) return
    await nextTick()
    body.value
      ?.querySelector(`[data-settings-focus="${focus}"]`)
      ?.scrollIntoView({ block: 'start' })
  },
  { flush: 'post' }
)
</script>

<template>
  <AppDialogRoot
    :open="settingsDialogOpen"
    size="wide"
    height="full"
    data-test-id="app-settings-dialog"
    @update:open="onOpenChange"
  >
    <AppDialogHeader
      :heading="settings.title"
      :close-label="common.close"
      :ui="{ header: styles.header() }"
    />

    <div class="flex min-h-0 flex-1">
      <nav :class="styles.nav()" :aria-label="settings.title">
        <div v-for="group in SETTINGS_NAVIGATION" :key="group.id" :class="styles.navGroup()">
          <p :class="styles.navHeading()">{{ groupLabels[group.id] }}</p>
          <button
            v-for="section in group.sections"
            :key="section"
            type="button"
            :class="styles.navItem()"
            :data-state="settingsDialogSection === section ? 'active' : 'inactive'"
            :aria-current="settingsDialogSection === section ? 'page' : undefined"
            :data-test-id="`settings-section-${section}`"
            @click="selectSection(section)"
          >
            <component :is="SECTION_ICONS[section]" :class="styles.navIcon()" />
            {{ sectionLabels[section] }}
          </button>
        </div>
      </nav>

      <div ref="body" :class="styles.body()">
        <GeneralSettingsPanel v-if="settingsDialogSection === 'general'" />

        <section
          v-else-if="settingsDialogSection === 'mcp'"
          class="flex flex-col gap-4"
          data-test-id="settings-mcp-panel"
        >
          <MCPSettingsPanel />
          <MCPConnectionsSection />
          <div data-settings-focus="models" data-test-id="settings-ai-panel">
            <SettingsGroup
              :heading="settings.modelsAndKeys"
              :description="settings.modelsAndKeysDescription"
            >
              <ModelsPanel />
            </SettingsGroup>
          </div>
        </section>

        <section
          v-else-if="settingsDialogSection === 'storage'"
          class="flex flex-col gap-4"
          data-test-id="settings-storage-section"
        >
          <StorageSettingsPanel />
          <div data-settings-focus="image-services" data-test-id="settings-media-panel">
            <SettingsGroup
              :heading="settings.imageServices"
              :description="settings.imageServicesDescription"
            >
              <div class="flex flex-col gap-2.5 py-3">
                <StockPhotoKeysSection />
                <VectorizeSettingsSection />
              </div>
            </SettingsGroup>
          </div>
        </section>

        <CloudSettingsPanel v-else-if="settingsDialogSection === 'cloud'" />

        <UsageSettingsPanel v-else-if="settingsDialogSection === 'usage'" />

        <DiagnosticsSettingsPanel v-else />
      </div>
    </div>

    <AppDialogFooter :ui="{ footer: styles.footer() }">
      <div class="mr-auto flex items-center gap-3">
        <AppSwitch
          v-if="!IS_TAURI"
          v-model="rememberCredentials"
          :label="credentials.remember"
          data-test-id="settings-remember-credentials"
        />
        <p class="flex items-center gap-1.5 text-xs text-muted">
          <icon-lucide-circle-check class="size-3.5 shrink-0" />
          <span>{{ settings.changesApplyNow }}</span>
          <span data-test-id="settings-credential-backend">{{
            credentials.storage({ backend: credentialBackendLabel })
          }}</span>
        </p>
      </div>
      <DialogClose as-child>
        <AppButton variant="outline" size="md" data-test-id="app-settings-done">
          {{ common.close }}
        </AppButton>
      </DialogClose>
    </AppDialogFooter>
  </AppDialogRoot>
</template>
