import type { DBSchema, IDBPDatabase } from 'idb'

import { APP_DATABASE_NAMES, defineAppDatabase, openAppDatabase } from '@/app/storage/idb'

import { exportDevicePublicKey } from './wrap'

/**
 * This installation's device key pair, and the file keys it has unwrapped, in IndexedDB.
 *
 * The private key is a non-extractable WebCrypto key: IndexedDB keeps the CryptoKey object by
 * structured clone, and no script -- this app's included -- can read its bytes back out. File keys
 * are kept the same way, so a file opens offline without unwrapping again.
 */
export interface DeviceKeyPair {
  privateKey: CryptoKey
  /** SPKI DER, base64url: what Console stores and collaborators wrap for. */
  publicKey: string
  createdAt: string
}

interface CloudKeysDB extends DBSchema {
  device: { key: string; value: DeviceKeyPair }
  /** `${fileId}:${epoch}` -> the content key for sealing and opening. */
  fileKeys: { key: string; value: CryptoKey }
}

const DEVICE_KEY = 'current'

const database = defineAppDatabase<CloudKeysDB>({
  name: APP_DATABASE_NAMES.cloudKeys,
  version: 1,
  callbacks: {
    upgrade(db) {
      db.createObjectStore('device')
      db.createObjectStore('fileKeys')
    }
  }
})

let opened: Promise<IDBPDatabase<CloudKeysDB>> | null = null

function db(): Promise<IDBPDatabase<CloudKeysDB>> {
  opened ??= openAppDatabase(database)
  return opened
}

let generating: Promise<DeviceKeyPair> | null = null

/** The device key pair, made the first time it is asked for and kept from then on. */
export async function deviceKeyPair(): Promise<DeviceKeyPair> {
  const existing = await (await db()).get('device', DEVICE_KEY)
  if (existing) return existing
  generating ??= (async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
      'deriveBits'
    ])
    const value: DeviceKeyPair = {
      privateKey: pair.privateKey,
      publicKey: await exportDevicePublicKey(pair.publicKey),
      createdAt: new Date().toISOString()
    }
    await (await db()).put('device', value, DEVICE_KEY)
    return value
  })().finally(() => {
    generating = null
  })
  return generating
}

function fileKeyId(fileId: string, epoch: number): string {
  return `${fileId}:${epoch}`
}

export async function cachedFileKey(fileId: string, epoch: number): Promise<CryptoKey | null> {
  return (await (await db()).get('fileKeys', fileKeyId(fileId, epoch))) ?? null
}

export async function cacheFileKey(fileId: string, epoch: number, key: CryptoKey): Promise<void> {
  await (await db()).put('fileKeys', key, fileKeyId(fileId, epoch))
}

/** Signing out forgets every file key; the device key stays, since it is this installation's. */
export async function forgetFileKeys(): Promise<void> {
  await (await db()).clear('fileKeys')
}

/** For tests: a fresh database between cases. */
export function resetKeystoreForTests(): void {
  opened = null
  generating = null
}
