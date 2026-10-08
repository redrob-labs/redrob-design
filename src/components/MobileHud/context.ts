import { useClipboard } from '@vueuse/core'
import { computed, inject, provide, proxyRefs } from 'vue'
import type { InjectionKey, ShallowUnwrapRef } from 'vue'
import IconFilePlus from '~icons/lucide/file-plus'
import IconFolderOpen from '~icons/lucide/folder-open'
import IconImageDown from '~icons/lucide/image-down'
import IconSave from '~icons/lucide/save'
import IconZoomIn from '~icons/lucide/zoom-in'

import { useEditorCommands, useI18n } from '@redrob-design/vue'

import { memberLink, shareDocument } from '@/app/cloud/files'
import { DEFAULT_COLLAB_STATE, useCollabInjected } from '@/app/collab/use'
import { useEditorStore } from '@/app/editor/active-store'
import { toolIcons } from '@/app/editor/icons'
import { useNotificationMessages } from '@/app/i18n/notifications'
import { signedIn } from '@/app/integrations/console'
import { openSettingsDialog } from '@/app/settings/dialog'
import { openFileDialog } from '@/app/shell/menu/use'
import { toast } from '@/app/shell/ui'
import type { ToolbarActionItem } from '@/components/Toolbar/types'

type MenuAction = ToolbarActionItem

function createMobileHudContext() {
  const collab = useCollabInjected()
  const store = useEditorStore()
  const { copy } = useClipboard()
  const { common, collaboration } = useI18n()
  const notifications = useNotificationMessages()
  const { getCommand } = useEditorCommands()

  const collabState = computed(() => collab?.state.value ?? DEFAULT_COLLAB_STATE)
  const collabPeers = computed(() => collab?.remotePeers.value ?? [])
  const followingPeer = computed(() => collab?.followingPeer.value ?? null)
  const onlineCount = computed(() => collabPeers.value.length + 1)
  const activeToolIcon = computed(() => toolIcons[store.state.activeTool])
  const actionToast = computed(() => store.state.actionToast)

  const menuItems: MenuAction[] = [
    {
      icon: IconFilePlus,
      label: 'New',
      action: () => void import('@/app/tabs').then((m) => m.createTab())
    },
    { icon: IconFolderOpen, label: 'Open…', action: () => void openFileDialog() },
    { icon: IconSave, label: 'Save', action: () => void store.saveFigFile() },
    { icon: IconImageDown, label: 'Export…', action: () => void store.exportSelection(1, 'png') },
    { icon: IconZoomIn, label: 'Zoom to fit', action: () => getCommand('view.zoomFit').run() }
  ]

  function undo() {
    getCommand('edit.undo').run()
  }

  function redo() {
    getCommand('edit.redo').run()
  }

  /** Shares the open file through Redrob Cloud and copies its link, or asks to sign in first. */
  async function share() {
    if (!signedIn.value) {
      openSettingsDialog('cloud')
      return
    }
    try {
      const binding = await shareDocument(store)
      void copy(memberLink(binding.fileId))
      toast.info(notifications.value.linkCopied)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    }
  }

  function disconnect() {
    collab?.disconnect()
  }

  function toggleFollowPeer(clientId: number) {
    collab?.followPeer(followingPeer.value === clientId ? null : clientId)
  }

  return {
    store,
    common,
    messages: collaboration,
    collabState,
    collabPeers,
    followingPeer,
    onlineCount,
    activeToolIcon,
    actionToast,
    menuItems,
    undo,
    redo,
    share,
    disconnect,
    toggleFollowPeer
  }
}

export type MobileHudContext = ShallowUnwrapRef<ReturnType<typeof createMobileHudContext>>

const MOBILE_HUD_KEY: InjectionKey<MobileHudContext> = Symbol('MobileHudContext')

export function provideMobileHud() {
  const ctx = proxyRefs(createMobileHudContext())
  provide(MOBILE_HUD_KEY, ctx)
  return ctx
}

export function useMobileHudContext(): MobileHudContext {
  const ctx = inject(MOBILE_HUD_KEY)
  if (!ctx) throw new Error('Mobile HUD controls must be used within MobileHud')
  return ctx
}
