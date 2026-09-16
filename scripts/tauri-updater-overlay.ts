#!/usr/bin/env bun
/**
 * Emit the Tauri config overlay that turns updater artefacts on for a release build.
 *
 * `desktop/tauri.conf.json` deliberately keeps `createUpdaterArtifacts: false` and carries no
 * `plugins.updater` section, because both of those make `tauri build` demand a signing key: a
 * contributor running a local build must not need the release keypair. The release workflow already
 * layers per-runner settings through `--config <overlay>` (Windows signs by certificate thumbprint
 * that way), so the updater is layered the same way instead of being switched on in the committed
 * config.
 *
 * Without a public key this prints nothing and exits 0. That is the state the repository shipped in
 * for every release so far, and the app already handles it: `updater_configured()` in
 * desktop/src/lib.rs reports no `plugins.updater` section and src/app/shell/updater.ts skips the
 * check rather than failing. An absent feed must not redden a build; it must only mean no updates.
 *
 * A signing key WITHOUT a public key is the one hard error. That combination produces signed
 * artefacts the app can never verify, which looks like a working release until an update is
 * attempted, so it is refused up front.
 *
 * Usage: bun scripts/tauri-updater-overlay.ts <output-path>
 * Environment:
 *   TAURI_UPDATER_PUBKEY   base64 minisign public key from `tauri signer generate`
 *   TAURI_SIGNING_PRIVATE_KEY  read by the bundler itself, only checked for consistency here
 *   REDROB_UPDATER_ENDPOINT    override the feed URL (defaults to the CDN feed)
 */

import { writeFile } from 'node:fs/promises'

export const DEFAULT_UPDATER_ENDPOINT = 'https://cdn.redrob.ai/design/latest/latest.json'

export interface UpdaterOverlayEnvironment {
  TAURI_UPDATER_PUBKEY?: string
  TAURI_SIGNING_PRIVATE_KEY?: string
  REDROB_UPDATER_ENDPOINT?: string
}

export interface UpdaterOverlay {
  bundle: { createUpdaterArtifacts: true }
  plugins: { updater: { endpoints: string[]; pubkey: string } }
}

/**
 * The overlay for an environment, or null when no public key is configured.
 *
 * Throws when a signing key is present without a public key, because that ships verifiable-looking
 * artefacts nothing can verify.
 */
export function updaterOverlay(env: UpdaterOverlayEnvironment): UpdaterOverlay | null {
  const pubkey = env.TAURI_UPDATER_PUBKEY?.trim()
  const signingKey = env.TAURI_SIGNING_PRIVATE_KEY?.trim()

  if (!pubkey) {
    if (signingKey) {
      throw new Error(
        'TAURI_SIGNING_PRIVATE_KEY is set but TAURI_UPDATER_PUBKEY is not. ' +
          'Signed update artefacts the app cannot verify are worse than no updater at all: ' +
          'set both, or neither.',
      )
    }
    return null
  }

  const endpoint = env.REDROB_UPDATER_ENDPOINT?.trim() || DEFAULT_UPDATER_ENDPOINT
  if (!/^https:\/\/\S+$/.test(endpoint)) {
    throw new Error(`REDROB_UPDATER_ENDPOINT must be an https URL, got: ${endpoint}`)
  }

  return {
    bundle: { createUpdaterArtifacts: true },
    plugins: { updater: { endpoints: [endpoint], pubkey } },
  }
}

if (import.meta.main) {
  const output = process.argv[2]
  if (!output) throw new Error('An output path is required: bun scripts/tauri-updater-overlay.ts <path>')

  const overlay = updaterOverlay(process.env)
  if (!overlay) {
    console.log('::notice::TAURI_UPDATER_PUBKEY is not set, so this build produces no update artefacts.')
    process.exit(0)
  }

  await writeFile(output, `${JSON.stringify(overlay, null, 2)}\n`)
  console.log(`Updater overlay written to ${output} (endpoint ${overlay.plugins.updater.endpoints[0]}).`)
}
