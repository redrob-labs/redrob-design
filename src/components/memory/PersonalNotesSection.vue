<script setup lang="ts">
import { ref, watch } from 'vue'

import { usePlanMessages } from '@redrob-design/vue'

import { downloadBlob } from '@/app/document/io/browser'
import {
  MAX_NOTE_LENGTH,
  addPersonalNote,
  exportPersonalNotes,
  loadPersonalNotes,
  personalNotes,
  removePersonalNote,
  updatePersonalNote
} from '@/app/memory/notes/store'
import AppButton from '@/components/ui/AppButton.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import IconButton from '@/components/ui/IconButton.vue'

/**
 * The person's notes on how they like to work. Kept on this computer, read
 * before every answer when Memory is set to All my work, and downloadable.
 */
const t = usePlanMessages()
const drafts = ref<Record<string, string>>({})
const draft = ref('')

void loadPersonalNotes()
watch(
  personalNotes,
  (notes) => {
    drafts.value = Object.fromEntries(notes.map((note) => [note.id, note.text]))
  },
  { immediate: true }
)

async function add(): Promise<void> {
  if (await addPersonalNote(draft.value)) draft.value = ''
}

function save(id: string): void {
  void updatePersonalNote(id, drafts.value[id] ?? '')
}

function download(): void {
  const json = exportPersonalNotes(personalNotes.value)
  downloadBlob(new TextEncoder().encode(json), 'redrob-notes.json', 'application/json')
}
</script>

<template>
  <section data-slot="personal-notes" :aria-label="t.sectionNotes" class="flex flex-col gap-2">
    <h3 class="text-[13px] font-semibold text-surface">{{ t.sectionNotes }}</h3>
    <p class="text-muted">{{ t.notesIntro }}</p>
    <p v-if="personalNotes.length === 0" class="text-muted">{{ t.notesEmpty }}</p>
    <ul v-else class="flex flex-col gap-2">
      <li v-for="(note, i) in personalNotes" :key="note.id" class="flex items-start gap-1.5">
        <label class="flex flex-1 flex-col">
          <span class="sr-only">{{ t.noteLabel({ index: i + 1 }) }}</span>
          <AppTextarea
            v-model="drafts[note.id]"
            :rows="2"
            :maxlength="MAX_NOTE_LENGTH"
            @blur="save(note.id)"
          />
        </label>
        <IconButton :label="t.noteDelete" @click="removePersonalNote(note.id)">
          <icon-lucide-trash-2 class="size-3.5" />
        </IconButton>
      </li>
    </ul>
    <label class="flex flex-col gap-1">
      <span class="font-medium text-surface">{{ t.noteNew }}</span>
      <AppTextarea v-model="draft" :rows="2" :maxlength="MAX_NOTE_LENGTH" />
    </label>
    <div class="flex flex-wrap items-center gap-2">
      <AppButton color="primary" variant="solid" :disabled="!draft.trim()" @click="add">
        {{ t.noteAdd }}
      </AppButton>
      <AppButton
        color="neutral"
        variant="outline"
        :disabled="personalNotes.length === 0"
        @click="download"
      >
        <template #leading><icon-lucide-download /></template>
        {{ t.notesDownload }}
      </AppButton>
    </div>
  </section>
</template>
