import { deviceKeyPair, generateContentKey, wrapContentKey } from '@/app/cloud/crypto'
import { registerCloudDevice } from '@/app/cloud/device'
import type { EditorStore } from '@/app/editor/active-store'
import {
  ConsoleError,
  consoleClient,
  signedIn,
  type CloudFile,
  type FileMembers,
  type FileRole,
  type InviteRole
} from '@/app/integrations/console'
import { closeTab, getTabForStore, getTabsSnapshot, reusableTabStore, switchTab } from '@/app/tabs'

import { bindCloudFile, cloudBindingOf, type CloudFileBinding } from './binding'
import { encodeGraphState, applyGraphState } from './graph-state'
import {
  CloudKeyPendingError,
  adoptNewKey,
  contentKey,
  rawContentKey,
  rememberLinkKey
} from './keyring'
import { newCloudFileId, viewLink, type ParsedCloudLink } from './link'
import { openText, sealText } from './sealed'
import { loadSnapshot, saveSnapshot } from './snapshot'

/** The first content key of a file. A rotation would move it on. */
const FIRST_EPOCH = 1

export class CloudSignInRequiredError extends Error {
  constructor() {
    super('Sign in to Redrob Cloud to share files')
    this.name = 'CloudSignInRequiredError'
  }
}

function requireSignedIn(): void {
  if (!signedIn.value) throw new CloudSignInRequiredError()
}

/**
 * Shares a document: makes it a Redrob Cloud file owned by the person signed in, sealed with a new
 * content key that only this device holds until it is handed to others.
 *
 * The id is chosen here, so the name and the key can be sealed to the file before Console has it.
 */
export async function shareDocument(store: EditorStore): Promise<CloudFileBinding> {
  requireSignedIn()
  const existing = cloudBindingOf(store)
  if (existing) return existing
  await registerCloudDevice()
  const device = await deviceKeyPair()
  const fileId = newCloudFileId()
  const epoch = FIRST_EPOCH
  const raw = generateContentKey()
  const key = await adoptNewKey(fileId, epoch, raw)
  const name = store.state.documentName
  const [encryptedName, wrappedKey] = await Promise.all([
    sealText(key, { fileId, epoch, purpose: { kind: 'name' } }, name),
    wrapContentKey(raw, device.publicKey, { fileId, epoch })
  ])
  await consoleClient().call('createCloudFile', {
    body: { id: fileId, encryptedName, keyGrant: { wrappedKey } }
  })
  const seed = encodeGraphState(store)
  const saved = await saveSnapshot(fileId, epoch, seed, 0)
  const binding: CloudFileBinding = {
    fileId,
    name,
    role: 'owner',
    epoch,
    revision: saved.saved ? saved.revision : 0,
    link: null,
    seed
  }
  bindCloudFile(store, binding)
  return binding
}

/** The plain name of a file, or null while this computer is still waiting for its key. */
export async function cloudFileName(file: CloudFile, link?: string): Promise<string | null> {
  void link
  try {
    const key = await contentKey(file.id, file.keyEpoch)
    return await openText(key, { fileId: file.id, purpose: { kind: 'name' } }, file.encryptedName)
  } catch (error) {
    if (error instanceof CloudKeyPendingError) return null
    throw error
  }
}

/**
 * Opens a shared file, from the list or a pasted link, in its own tab. A view link opens it for
 * reading whether or not anyone is signed in; anything else needs access of one's own.
 */
export async function openCloudFile(target: ParsedCloudLink): Promise<EditorStore> {
  const { fileId, view } = target
  if (view) rememberLinkKey(fileId, view.epoch, view.raw)
  else requireSignedIn()
  const open = getTabsSnapshot().find((tab) => tab.store.getSourceIdentity().cloudFileId === fileId)
  if (open) {
    switchTab(open.id)
    return open.store
  }

  const link = view?.token
  const { data: file } = await consoleClient().call('getCloudFile', { params: { fileId }, link })
  const key = await contentKey(fileId, file.keyEpoch)
  const name = await openText(key, { fileId, purpose: { kind: 'name' } }, file.encryptedName)

  const { store, created } = reusableTabStore()
  try {
    const snapshot = await loadSnapshot(fileId, link)
    if (snapshot) applyGraphState(store, snapshot.state)
    bindCloudFile(store, {
      fileId,
      name,
      role: file.role,
      epoch: file.keyEpoch,
      revision: snapshot?.revision ?? 0,
      link: link ?? null,
      seed: snapshot?.state ?? null
    })
    store.requestRender()
    return store
  } catch (error) {
    if (created) {
      const tab = getTabForStore(store)
      if (tab) await closeTab(tab.id)
    }
    throw error
  }
}

export type SharedFileEntry = { file: CloudFile; name: string | null }

/** Files shared with this person, with their names where this computer can read them. */
export async function listSharedFiles(): Promise<SharedFileEntry[]> {
  requireSignedIn()
  const { data } = await consoleClient().call('listCloudFiles')
  return Promise.all(data.items.map(async (file) => ({ file, name: await cloudFileName(file) })))
}

// ------------------------------------------------------------------ people

export async function fileMembers(fileId: string): Promise<FileMembers> {
  return (await consoleClient().call('listFileMembers', { params: { fileId } })).data
}

/** Shares with an address: they are added if they have an account, else invited. */
export async function inviteToFile(
  fileId: string,
  email: string,
  role: InviteRole
): Promise<FileMembers> {
  await consoleClient().call('addFileMember', { params: { fileId }, body: { email, role } })
  return fileMembers(fileId)
}

export async function changeMemberRole(
  fileId: string,
  userId: string,
  role: FileRole
): Promise<FileMembers> {
  return (
    await consoleClient().call('updateFileMember', { params: { fileId, userId }, body: { role } })
  ).data
}

export async function removeMember(fileId: string, userId: string): Promise<FileMembers> {
  await consoleClient().call('removeFileMember', { params: { fileId, userId } })
  return fileMembers(fileId)
}

export async function withdrawInvite(fileId: string, inviteId: string): Promise<FileMembers> {
  await consoleClient().call('revokeFileInvite', { params: { fileId, inviteId } })
  return fileMembers(fileId)
}

// ------------------------------------------------------------------- links

export async function fileViewLinkEnabled(fileId: string): Promise<boolean> {
  return (await consoleClient().call('getFileLink', { params: { fileId } })).data.enabled
}

/**
 * Makes a new view link and returns it whole. Console only ever sees the token; the key is put in
 * the fragment here, from this device's own copy of it. Any earlier link stops working.
 */
export async function createViewLink(binding: CloudFileBinding): Promise<string> {
  const { data } = await consoleClient().call('createFileLink', {
    params: { fileId: binding.fileId }
  })
  const raw = await rawContentKey(binding.fileId, binding.epoch)
  return viewLink(binding.fileId, { token: data.token, epoch: binding.epoch, raw })
}

export async function turnOffViewLink(fileId: string): Promise<void> {
  await consoleClient().call('revokeFileLink', { params: { fileId } })
}

/** What a Console refusal means for someone trying to open a file. */
export function describeOpenFailure(
  error: unknown
): 'no-access' | 'pending' | 'signed-out' | 'unreachable' {
  if (error instanceof CloudKeyPendingError) return 'pending'
  if (error instanceof CloudSignInRequiredError) return 'signed-out'
  if (error instanceof ConsoleError) {
    if (error.kind === 'not-found' || error.kind === 'forbidden') return 'no-access'
    if (error.kind === 'not-signed-in') return 'signed-out'
  }
  return 'unreachable'
}
