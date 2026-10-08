<script setup lang="ts">
import { ref, watch } from 'vue'
import { useSharingMessages } from '@redrob-design/vue'

import {
  describeOpenFailure,
  listSharedFiles,
  openCloudFile,
  type SharedFileEntry
} from '@/app/cloud/files'
import { signedIn } from '@/app/integrations/console'

/** Files shared with the signed-in person, from Redrob Cloud. Hidden when signed out. */
const messages = useSharingMessages()
const entries = ref<SharedFileEntry[]>([])
const problem = ref<string | null>(null)

async function load(): Promise<void> {
  problem.value = null
  try {
    entries.value = await listSharedFiles()
  } catch {
    problem.value = messages.value.unreachable
  }
}

async function open(entry: SharedFileEntry): Promise<void> {
  problem.value = null
  try {
    await openCloudFile({ fileId: entry.file.id, view: null })
  } catch (error) {
    const kind = describeOpenFailure(error)
    if (kind === 'pending') problem.value = messages.value.waitingForKey
    else if (kind === 'no-access') problem.value = messages.value.noAccess
    else problem.value = messages.value.unreachable
  }
}

watch(
  signedIn,
  (isSignedIn) => {
    if (isSignedIn) void load()
    else entries.value = []
  },
  { immediate: true }
)
</script>

<template>
  <section v-if="signedIn" class="mt-7" data-test-id="home-shared-files">
    <h2 class="mb-3 text-base font-semibold">{{ messages.sharedWithYou }}</h2>
    <p v-if="problem" class="mb-3 text-xs text-error" role="alert">{{ problem }}</p>
    <div v-if="entries.length" class="overflow-hidden rounded-lg border border-border">
      <button
        v-for="entry in entries"
        :key="entry.file.id"
        type="button"
        class="flex min-h-14 w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-hover sm:min-h-0 sm:px-4 sm:py-3"
        @click="open(entry)"
      >
        <icon-lucide-users class="size-4 shrink-0 text-accent" />
        <span class="min-w-0 flex-1 truncate text-xs font-medium">
          {{ entry.name ?? messages.waitingForAccess }}
        </span>
      </button>
    </div>
    <p
      v-else-if="!problem"
      class="rounded-lg border border-dashed border-border px-4 py-4 text-center text-xs text-muted sm:py-6"
    >
      {{ messages.noSharedFiles }}
    </p>
  </section>
</template>
