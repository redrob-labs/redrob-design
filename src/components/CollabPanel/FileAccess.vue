<script setup lang="ts">
import { computed } from 'vue'

import type { FileRole, InviteRole } from '@/app/integrations/console'
import AppButton from '@/components/ui/AppButton.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import { useCollabPanelContext } from '@/components/CollabPanel/context'

const collab = useCollabPanelContext()

const roleLabels = computed<Record<FileRole, string>>(() => ({
  owner: collab.messages.roleOwner,
  editor: collab.messages.roleEditor,
  commenter: collab.messages.roleCommenter,
  viewer: collab.messages.roleViewer
}))
const inviteOptions = computed(() =>
  (['editor', 'commenter', 'viewer'] as InviteRole[]).map((value) => ({
    value,
    label: roleLabels.value[value]
  }))
)
const memberOptions = computed(() =>
  (['owner', 'editor', 'commenter', 'viewer'] as FileRole[]).map((value) => ({
    value,
    label: roleLabels.value[value]
  }))
)
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <span class="truncate font-medium text-surface">{{ collab.file?.name }}</span>
    <AppButton data-test-id="collab-copy-link" variant="outline" @click="collab.copyMemberLink">
      <icon-lucide-check v-if="collab.copied" class="size-3" />
      <icon-lucide-link v-else class="size-3" />
      {{ collab.messages.copyLink }}
    </AppButton>
  </div>

  <div v-if="collab.canManage" class="flex items-center gap-1.5">
    <AppInput
      v-model="collab.inviteEmail"
      data-test-id="collab-invite-email"
      :aria-label="collab.messages.emailAddress"
      :placeholder="collab.messages.emailAddress"
      class="min-w-0 flex-1"
      @enter="collab.invite"
    />
    <AppSelect
      v-model="collab.inviteRole"
      data-test-id="collab-invite-role"
      :label="collab.messages.invite"
      :options="inviteOptions"
    />
    <AppButton
      data-test-id="collab-invite"
      color="primary"
      variant="solid"
      :disabled="!collab.inviteEmail.trim() || collab.busy"
      @click="collab.invite"
    >
      {{ collab.messages.invite }}
    </AppButton>
  </div>

  <section v-if="collab.roster" :aria-label="collab.messages.peopleWithAccess">
    <div class="mb-1 text-muted">{{ collab.messages.peopleWithAccess }}</div>
    <ul class="flex flex-col gap-1" data-test-id="collab-members">
      <li
        v-for="member in collab.roster.members"
        :key="member.userId"
        class="flex items-center gap-2"
        :data-role="member.role"
      >
        <span class="min-w-0 flex-1 truncate text-surface">
          {{ member.userId === collab.selfId ? collab.messages.you : member.email }}
        </span>
        <AppSelect
          v-if="collab.isOwner && member.userId !== collab.selfId"
          :model-value="member.role"
          :label="member.email"
          :options="memberOptions"
          @update:model-value="(role) => collab.setRole(member.userId, role)"
        />
        <span v-else class="text-muted">{{ roleLabels[member.role] }}</span>
        <AppButton
          v-if="collab.isOwner && member.userId !== collab.selfId"
          variant="ghost"
          size="xs"
          :aria-label="`${collab.messages.remove} ${member.email}`"
          @click="collab.remove(member.userId)"
        >
          <icon-lucide-x class="size-3" />
        </AppButton>
      </li>
      <li
        v-for="pending in collab.roster.invites"
        :key="pending.id"
        class="flex items-center gap-2 text-muted"
      >
        <span class="min-w-0 flex-1 truncate">{{ pending.email }}</span>
        <span>{{ collab.messages.invited }} · {{ roleLabels[pending.role] }}</span>
        <AppButton
          v-if="collab.canManage"
          variant="ghost"
          size="xs"
          :aria-label="`${collab.messages.withdraw} ${pending.email}`"
          @click="collab.withdraw(pending.id)"
        >
          <icon-lucide-x class="size-3" />
        </AppButton>
      </li>
    </ul>
  </section>

  <section class="flex flex-col gap-1.5" :aria-label="collab.messages.viewLinkTitle">
    <div class="font-medium text-surface">{{ collab.messages.viewLinkTitle }}</div>
    <p class="text-muted">
      {{ collab.linkEnabled ? collab.messages.viewLinkOn : collab.messages.viewLinkOff }}
    </p>
    <div v-if="collab.canManage" class="flex gap-1.5">
      <AppButton data-test-id="collab-view-link" variant="outline" @click="collab.makeViewLink">
        {{ collab.linkEnabled ? collab.messages.copyViewLink : collab.messages.createViewLink }}
      </AppButton>
      <AppButton
        v-if="collab.linkEnabled"
        data-test-id="collab-view-link-off"
        variant="ghost"
        @click="collab.viewLinkOff"
      >
        {{ collab.messages.turnOffViewLink }}
      </AppButton>
    </div>
  </section>
</template>
