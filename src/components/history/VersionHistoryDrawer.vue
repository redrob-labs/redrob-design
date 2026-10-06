<script setup lang="ts">
import { computed, ref } from 'vue'

import { useHistoryMessages } from '@redrob-design/vue'

import {
  deleteVersion,
  renameVersion,
  restoreVersion,
  saveDocumentVersion,
  versionHistoryOpen,
  type HistoryEntry
} from '@/app/document/history/service'
import { getActiveEditorStoreOrNull } from '@/app/editor/active-store'
import { signedIn } from '@/app/integrations/console'
import { toast } from '@/app/shell/ui'
import { formatStorageBytes } from '@/app/storage/format-bytes'
import { useVersionHistory } from '@/components/history/useVersionHistory'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppDialog from '@/components/ui/dialog/AppDialog.vue'

/** Versions of the open file: save one by name, name, restore or delete the rest. */
const t = useHistoryMessages()
const document = () => getActiveEditorStoreOrNull()
const { entries, previews } = useVersionHistory(versionHistoryOpen, document)
const draftName = ref('')
const renaming = ref<string | null>(null)
const renameDraft = ref('')
const busy = ref(false)
const documentName = computed(() =>
  versionHistoryOpen.value ? (document()?.state.documentName ?? '') : ''
)

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function titleOf(entry: HistoryEntry): string {
  if (entry.name) return entry.name
  return entry.kind === 'auto' ? t.value.autosaved : t.value.unnamed
}

function whereOf(entry: HistoryEntry): string {
  if (entry.createdBy) return t.value.savedBy({ name: entry.createdBy })
  return entry.synced ? t.value.inCloud : t.value.notUploaded
}

async function run(step: () => Promise<void>): Promise<void> {
  busy.value = true
  try {
    await step()
  } catch (error) {
    toast.error(t.value.failed({ error: errorText(error) }))
  } finally {
    busy.value = false
  }
}

function save(): void {
  const target = document()
  if (!target) return
  const name = draftName.value.trim()
  void run(async () => {
    await saveDocumentVersion(target, 'named', name === '' ? null : name)
    draftName.value = ''
    toast.info(t.value.saved)
  })
}

function startRename(entry: HistoryEntry): void {
  renaming.value = entry.key
  renameDraft.value = entry.name ?? ''
}

function finishRename(entry: HistoryEntry): void {
  const local = entry.local
  renaming.value = null
  if (!local) return
  void run(async () => {
    await renameVersion(local, renameDraft.value)
  })
}

function remove(entry: HistoryEntry): void {
  const local = entry.local
  if (!local) return
  void run(() => deleteVersion(local))
}

async function restore(entry: HistoryEntry): Promise<void> {
  const target = document()
  if (!target) return
  busy.value = true
  try {
    await restoreVersion(target, entry)
    toast.info(t.value.restored({ name: titleOf(entry) }))
    versionHistoryOpen.value = false
  } catch (error) {
    toast.error(t.value.restoreFailed({ error: errorText(error) }))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AppDialog
    v-model:open="versionHistoryOpen"
    data-test-id="version-history"
    placement="right"
    size="lg"
    :heading="t.heading"
    :description="t.description({ name: documentName })"
    :close-label="t.close"
  >
    <div class="flex flex-col gap-4 text-xs">
      <p class="text-muted" data-slot="history-sharing">
        {{ signedIn ? t.shared : t.notShared }}
      </p>
      <form class="flex items-end gap-2" @submit.prevent="save">
        <label class="flex flex-1 flex-col gap-1">
          <span class="font-medium text-surface">{{ t.nameLabel }}</span>
          <AppInput v-model="draftName" :placeholder="t.namePlaceholder" />
        </label>
        <AppButton type="submit" color="primary" variant="solid" :disabled="busy">
          {{ t.save }}
        </AppButton>
      </form>

      <p v-if="entries.length === 0" class="text-muted">{{ t.empty }}</p>
      <ul v-else class="flex flex-col gap-2" :aria-label="t.heading">
        <li
          v-for="entry in entries"
          :key="entry.key"
          data-slot="history-version"
          :data-kind="entry.kind"
          :data-origin="entry.origin"
          class="flex items-start gap-3 rounded-lg border border-border p-2.5"
        >
          <img
            v-if="previews.get(entry.key)"
            :src="previews.get(entry.key)"
            :alt="t.previewAlt({ name: titleOf(entry) })"
            class="size-16 shrink-0 rounded border border-border bg-panel object-contain"
          />
          <icon-lucide-history v-else class="mt-0.5 size-4 shrink-0 text-muted" />
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <form
              v-if="renaming === entry.key"
              class="flex items-center gap-1.5"
              @submit.prevent="finishRename(entry)"
            >
              <AppInput v-model="renameDraft" :aria-label="t.nameLabel" autofocus size="sm" />
              <AppButton type="submit" size="xs" color="neutral" variant="outline">
                {{ t.renameDone }}
              </AppButton>
            </form>
            <p v-else class="truncate font-medium text-surface">{{ titleOf(entry) }}</p>
            <p class="text-muted">
              {{ dateFormat.format(new Date(entry.createdAt)) }} ·
              {{ formatStorageBytes(entry.byteLength) }} · {{ whereOf(entry) }}
            </p>
            <div class="flex flex-wrap gap-1.5">
              <AppButton
                size="xs"
                color="primary"
                variant="solid"
                :disabled="busy"
                @click="restore(entry)"
              >
                {{ t.restore }}
              </AppButton>
              <AppButton
                v-if="entry.local && renaming !== entry.key"
                size="xs"
                color="neutral"
                variant="ghost"
                :disabled="busy"
                @click="startRename(entry)"
              >
                {{ t.rename }}
              </AppButton>
              <AppButton
                v-if="entry.local"
                size="xs"
                color="error"
                variant="ghost"
                :disabled="busy"
                @click="remove(entry)"
              >
                {{ t.delete }}
              </AppButton>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </AppDialog>
</template>
