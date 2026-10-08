import { watch } from 'vue'

import { cloudState, consoleClient, signedIn } from '@/app/integrations/console'

import { deviceKeyPair, forgetFileKeys } from './crypto'

let registering: Promise<void> | null = null

/**
 * Makes sure Console has this installation's public key, so collaborators can wrap file keys for
 * it. Idempotent: an account that already reports the same key is left alone.
 */
export function registerCloudDevice(): Promise<void> {
  registering ??= (async () => {
    const pair = await deviceKeyPair()
    if (cloudState.account?.device?.publicKey === pair.publicKey) return
    const { data } = await consoleClient().call('registerDevice', {
      body: { publicKey: pair.publicKey }
    })
    if (cloudState.account) cloudState.account = { ...cloudState.account, device: data }
  })().finally(() => {
    registering = null
  })
  return registering
}

let started = false

/**
 * Registers the device key whenever someone signs in, and forgets every unwrapped file key when
 * they sign out: the keys belong to the person's access, not to this computer.
 */
export function startCloudDevice(): void {
  if (started) return
  started = true
  watch(
    signedIn,
    (isSignedIn, wasSignedIn) => {
      if (isSignedIn) {
        registerCloudDevice().catch((error: unknown) => {
          console.warn('[Cloud] Could not register this computer’s key yet', error)
        })
      } else if (wasSignedIn) void forgetFileKeys()
    },
    { immediate: true }
  )
}
