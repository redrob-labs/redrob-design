<script setup lang="ts">
import { onMounted } from 'vue'
import { useEventListener } from '@vueuse/core'
import { useHead } from '@unhead/vue'
import { TooltipProvider } from 'reka-ui'

import { provideEditor, useI18n } from '@redrob-design/vue'
import AppShell from '@/components/Shell/AppShell.vue'
import AppToast from '@/components/Shell/AppToast.vue'
import PublishLibraryDialog from '@/components/libraries/PublishLibraryDialog.vue'
import LibraryUpdateReviewDialog from '@/components/libraries/review/LibraryUpdateReviewDialog.vue'
import RecoveryDialog from '@/components/recovery/RecoveryDialog.vue'
import VersionHistoryDrawer from '@/components/history/VersionHistoryDrawer.vue'
import CommentsDrawer from '@/components/comments/CommentsDrawer.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import { useEditorStore } from '@/app/editor/active-store'
import { toast } from '@/app/shell/ui'
import { useAppTheme } from '@/app/shell/theme'
import { scheduleStartupUpdateCheck } from '@/app/shell/updater'
import { startWorkspaceMemory } from '@/app/memory/workspace'
import { startWatchPolling } from '@/app/ship/watch/service'
import { startVersionHistory } from '@/app/document/history/start'
import { startComments } from '@/app/comments/service'
import { startCloudDevice } from '@/app/cloud/device'
import { kickSyncEngine } from '@/app/storage/sync'
import { prepareForReload } from '@/app/tabs'

const store = useEditorStore()
const { updates, locale } = useI18n()

useHead({
  titleTemplate: (title) => (title ? `${title} — Redrob Design` : 'Redrob Design'),
  htmlAttrs: { lang: locale }
})

provideEditor(store)
useAppTheme()
useEventListener(window, 'pagehide', () => {
  void prepareForReload()
})

onMounted(() => {
  toast.setupGlobalErrorHandler()
  scheduleStartupUpdateCheck(updates)
  void kickSyncEngine()
  // Design Memory reads the signed-in workspace; signed out, it reads the open file.
  startWorkspaceMemory()
  // Shipped pages hear about changes in their watched sources while the app is open.
  startWatchPolling()
  // Open documents keep automatic versions on this computer, and in Cloud when signed in.
  startVersionHistory()
  // Comments live on this computer first and sync once signed in.
  startComments()
  // Signed in, this computer's public key is registered so shared files can be opened here.
  startCloudDevice()
})
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <AppShell>
      <RouterView />
    </AppShell>
    <SettingsDialog />
    <RecoveryDialog />
    <VersionHistoryDrawer />
    <CommentsDrawer />
    <PublishLibraryDialog />
    <LibraryUpdateReviewDialog />
    <AppToast />
  </TooltipProvider>
</template>
