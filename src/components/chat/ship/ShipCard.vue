<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCommonMessages, useShipMessages, useThreadMessages } from '@redrob-design/vue'

import { getActiveEditorStore } from '@/app/editor/active-store'
import { downloadBlob } from '@/app/document/io/browser'
import { pageLanguages } from '@/app/language/versions'
import { toast } from '@/app/shell/ui'
import { threadKeyFor } from '@/app/assistant/thread/store'
import { openSettingsDialog } from '@/app/settings/dialog'
import {
  publishPage,
  publishedSlug,
  unpublishPage,
  type PublishResult
} from '@/app/ship/publish/service'
import { handToClaudeCode, reactAndTokens, type ShipData } from '@/app/ship/ship'
import { simulatePriceSheetChange, watchedSources } from '@/app/ship/watch'
import { useChatPost } from '@/components/chat/submit'
import AppButton from '@/components/ui/AppButton.vue'
import { AppConfirmationDialog } from '@/components/ui/dialog'

/** The ways a page ships, and the note that it keeps watching its sources. */
const { ship } = defineProps<{ ship: ShipData }>()

const t = useShipMessages()
const common = useCommonMessages()
const thread = useThreadMessages()
const post = useChatPost()
const documentId = threadKeyFor(getActiveEditorStore())
const published = ref(publishedSlug(documentId, ship.pageId) !== null)
const publishing = ref(false)
const confirmOpen = ref(false)
const updated = ref(false)
const sources = computed(() => watchedSources())
const languages = computed(() => {
  const store = getActiveEditorStore()
  return pageLanguages(store.graph, ship.pageId)
})

/** The first publish makes the page public, so it asks first; later ones update it. */
function publish(): void {
  if (published.value) void runPublish()
  else confirmOpen.value = true
}

function report(result: PublishResult): void {
  if (result.status === 'no-profile' || result.status === 'no-public-url') {
    toast.warning(
      result.status === 'no-profile' ? t.value.publishNoBucket : t.value.publishNoSiteURL
    )
    openSettingsDialog('storage')
    return
  }
  if (result.status === 'upload-failed') {
    toast.error(t.value.publishFailed({ error: result.detail }))
    return
  }
  if (result.status === 'unreachable') {
    published.value = true
    toast.warning(t.value.publishUnreachable({ url: result.detail }))
    return
  }
  if (result.status !== 'published') return
  published.value = true
  toast.info(
    result.verified
      ? t.value.publishedTo({ site: result.url })
      : t.value.publishedUnverified({ site: result.url })
  )
  if (result.fontFallbacks.length > 0) {
    toast.info(t.value.publishFontFallbacks({ fonts: result.fontFallbacks.join(', ') }))
  }
}

async function runPublish(): Promise<void> {
  publishing.value = true
  try {
    const store = getActiveEditorStore()
    report(await publishPage({ graph: store.graph, pageId: ship.pageId, documentId }))
  } finally {
    publishing.value = false
  }
}

async function unpublish(): Promise<void> {
  publishing.value = true
  try {
    if (await unpublishPage({ pageId: ship.pageId, documentId })) {
      published.value = false
      toast.info(t.value.unpublished)
    }
  } catch (error) {
    toast.error(
      t.value.publishFailed({ error: error instanceof Error ? error.message : String(error) })
    )
  } finally {
    publishing.value = false
  }
}

function downloadReact(): void {
  const { jsx, tokens } = reactAndTokens(getActiveEditorStore().graph, ship.pageId)
  const encoder = new TextEncoder()
  downloadBlob(encoder.encode(jsx), 'Page.jsx', 'text/javascript')
  downloadBlob(encoder.encode(tokens), 'tokens.json', 'application/json')
}

function handOff(): void {
  const result = handToClaudeCode()
  if (result.connected) toast.info(t.value.handedOff)
  else toast.warning(t.value.handoffNotConnected)
}

/** The whole page as a .fig file Figma opens with its layers intact. */
async function exportForFigma(): Promise<void> {
  const store = getActiveEditorStore()
  const frames = store.graph.getChildren(ship.pageId).map((node) => node.id)
  if (frames.length === 0) return
  store.select(frames)
  try {
    await store.exportSelection(1, 'fig')
  } finally {
    store.clearSelection()
  }
}

function tryUpdate(): void {
  const message = simulatePriceSheetChange(getActiveEditorStore(), {
    changed: t.value.updateChanged,
    nothing: t.value.updateNothing
  })
  if (!message) return
  updated.value = true
  post(message)
}
</script>

<template>
  <section v-if="ship.frameCount > 0" data-slot="ship-card" class="flex flex-col gap-3">
    <div role="group" :aria-label="t.actionsLabel" class="flex flex-wrap gap-2">
      <AppButton
        color="primary"
        variant="solid"
        :loading="publishing"
        :disabled="publishing"
        data-slot="ship-publish"
        @click="publish"
      >
        <template #leading><icon-lucide-globe /></template>
        {{ published ? t.publishAgain : t.publish }}
      </AppButton>
      <AppButton
        v-if="published"
        color="neutral"
        variant="ghost"
        :disabled="publishing"
        data-slot="ship-unpublish"
        @click="unpublish"
      >
        {{ t.unpublish }}
      </AppButton>
      <AppButton color="neutral" variant="outline" data-slot="ship-react" @click="downloadReact">
        <template #leading><icon-lucide-code /></template>
        {{ t.reactTokens }}
      </AppButton>
      <AppButton color="neutral" variant="outline" data-slot="ship-handoff" @click="handOff">
        <template #leading><icon-lucide-terminal /></template>
        {{ t.handToClaudeCode }}
      </AppButton>
      <AppButton color="neutral" variant="ghost" data-slot="ship-figma" @click="exportForFigma">
        <template #leading><icon-lucide-layout-template /></template>
        {{ t.exportForFigma }}
      </AppButton>
    </div>
    <p v-if="languages.length > 0" class="text-xs text-muted">
      {{ thread.shipsIn({ languages: languages.join(', ') }) }}
    </p>
    <div
      data-slot="ship-watch"
      class="flex items-start gap-2 rounded-xl border border-border bg-panel px-3 py-2.5 text-xs"
    >
      <icon-lucide-refresh-cw class="mt-0.5 size-3.5 shrink-0 text-muted" />
      <div class="flex min-w-0 flex-col gap-1">
        <p class="text-surface">
          <b>{{ t.watchTitle }}</b>
          {{ sources ? t.watchBody({ sources: sources.join(', ') }) : t.watchNotConnected }}
        </p>
        <button
          v-if="sources && !updated"
          type="button"
          class="self-start rounded font-medium text-brand-ink hover:underline focus-visible:ring-2 focus-visible:ring-panel-focus focus-visible:outline-none"
          @click="tryUpdate"
        >
          {{ t.tryUpdate }}
        </button>
      </div>
    </div>
    <AppConfirmationDialog
      v-model:open="confirmOpen"
      :heading="t.publishConfirmHeading"
      :description="t.publishConfirmText"
      :cancel-label="common.cancel"
      :confirm-label="t.publish"
      @confirm="runPublish"
    />
  </section>
</template>
