import { useClipboard } from '@vueuse/core'
import { computed, inject, provide, proxyRefs, ref, watch } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'

import { useI18n, useSharingMessages } from '@redrob-design/vue'

import {
  activeCloudFile,
  changeMemberRole,
  createViewLink,
  describeOpenFailure,
  fileMembers,
  fileViewLinkEnabled,
  inviteToFile,
  memberLink,
  openCloudFile,
  parseCloudLink,
  removeMember,
  shareDocument,
  turnOffViewLink,
  withdrawInvite
} from '@/app/cloud/files'
import { DEFAULT_COLLAB_STATE, useCollabInjected } from '@/app/collab/use'
import { getActiveEditorStore } from '@/app/editor/active-store'
import {
  cloudState,
  signedIn,
  type FileMembers,
  type FileRole,
  type InviteRole
} from '@/app/integrations/console'
import { openSettingsDialog } from '@/app/settings/dialog'
import { toast } from '@/app/shell/ui'

/**
 * The Share popover: share the open file through Redrob Cloud, see and change who has access,
 * make a view link, and open a file someone shared. Live presence comes from the collaboration
 * session for the shared file.
 */
function createCollabPanelContext() {
  const collab = useCollabInjected()
  const { copy, copied } = useClipboard({ copiedDuring: 2000 })
  const { common } = useI18n()
  const messages = useSharingMessages()

  const popoverOpen = ref(false)
  const busy = ref(false)
  const error = ref<string | null>(null)
  const inviteEmail = ref('')
  const inviteRole = ref<InviteRole>('editor')
  const openInput = ref('')
  const roster = ref<FileMembers | null>(null)
  const linkEnabled = ref(false)

  const state = computed(() => collab?.state.value ?? DEFAULT_COLLAB_STATE)
  const peers = computed(() => collab?.remotePeers.value ?? [])
  const followingPeer = computed(() => collab?.followingPeer.value ?? null)
  const file = activeCloudFile
  const canManage = computed(() => file.value?.role === 'owner' || file.value?.role === 'editor')
  const isOwner = computed(() => file.value?.role === 'owner')
  const selfId = computed(() => cloudState.account?.id ?? null)

  function failure(caught: unknown): string {
    const kind = describeOpenFailure(caught)
    if (kind === 'no-access') return messages.value.noAccess
    if (kind === 'pending') return messages.value.waitingForKey
    if (kind === 'signed-out') return messages.value.signInToOpen
    return caught instanceof Error ? caught.message : messages.value.unreachable
  }

  async function run(task: () => Promise<void>): Promise<void> {
    busy.value = true
    error.value = null
    try {
      await task()
    } catch (caught) {
      error.value = failure(caught)
    } finally {
      busy.value = false
    }
  }

  async function refresh(): Promise<void> {
    const current = file.value
    if (!current || current.link) {
      roster.value = null
      return
    }
    await run(async () => {
      roster.value = await fileMembers(current.fileId)
      linkEnabled.value = await fileViewLinkEnabled(current.fileId)
    })
  }

  watch(
    () => [popoverOpen.value, file.value?.fileId] as const,
    ([open]) => {
      if (open) void refresh()
    }
  )

  function share(): Promise<void> {
    return run(async () => {
      await shareDocument(getActiveEditorStore())
      await refresh()
    })
  }

  function invite(): Promise<void> {
    const current = file.value
    const email = inviteEmail.value.trim()
    if (!current || !email) return Promise.resolve()
    return run(async () => {
      roster.value = await inviteToFile(current.fileId, email, inviteRole.value)
      inviteEmail.value = ''
    })
  }

  function setRole(userId: string, role: FileRole): Promise<void> {
    const current = file.value
    if (!current) return Promise.resolve()
    return run(async () => {
      roster.value = await changeMemberRole(current.fileId, userId, role)
    })
  }

  function remove(userId: string): Promise<void> {
    const current = file.value
    if (!current) return Promise.resolve()
    return run(async () => {
      roster.value = await removeMember(current.fileId, userId)
    })
  }

  function withdraw(inviteId: string): Promise<void> {
    const current = file.value
    if (!current) return Promise.resolve()
    return run(async () => {
      roster.value = await withdrawInvite(current.fileId, inviteId)
    })
  }

  function copyMemberLink(): void {
    const current = file.value
    if (!current) return
    void copy(memberLink(current.fileId))
    toast.info(messages.value.linkCopied)
  }

  function makeViewLink(): Promise<void> {
    const current = file.value
    if (!current) return Promise.resolve()
    return run(async () => {
      void copy(await createViewLink(current))
      linkEnabled.value = true
      toast.info(messages.value.viewLinkCopied)
    })
  }

  function viewLinkOff(): Promise<void> {
    const current = file.value
    if (!current) return Promise.resolve()
    return run(async () => {
      await turnOffViewLink(current.fileId)
      linkEnabled.value = false
    })
  }

  function openShared(): Promise<void> {
    const target = parseCloudLink(openInput.value)
    if (!target) {
      error.value = messages.value.notALink
      return Promise.resolve()
    }
    return run(async () => {
      await openCloudFile(target)
      openInput.value = ''
      popoverOpen.value = false
    })
  }

  function signIn(): void {
    popoverOpen.value = false
    openSettingsDialog('cloud')
  }

  function toggleFollowPeer(clientId: number) {
    collab?.followPeer(followingPeer.value === clientId ? null : clientId)
  }

  return {
    common,
    messages,
    copied,
    popoverOpen,
    busy,
    error,
    inviteEmail,
    inviteRole,
    openInput,
    roster,
    linkEnabled,
    state,
    peers,
    followingPeer,
    file,
    canManage,
    isOwner,
    selfId,
    signedIn,
    share,
    invite,
    setRole,
    remove,
    withdraw,
    copyMemberLink,
    makeViewLink,
    viewLinkOff,
    openShared,
    signIn,
    toggleFollowPeer
  }
}

export type CollabPanelContext = ShallowUnwrapRef<ReturnType<typeof createCollabPanelContext>>

const COLLAB_PANEL_KEY: InjectionKey<CollabPanelContext> = Symbol('CollabPanelContext')

export function provideCollabPanel() {
  const ctx = proxyRefs(createCollabPanelContext())
  provide(COLLAB_PANEL_KEY, ctx)
  return ctx
}

export function useCollabPanelContext(): CollabPanelContext {
  const ctx = inject(COLLAB_PANEL_KEY)
  if (!ctx) throw new Error('Collab panel controls must be used within CollabPanel')
  return ctx
}
