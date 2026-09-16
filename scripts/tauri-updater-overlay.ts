#!/usr/bin/env bun
/**
 * Emit the Tauri config overlay that turns updater artefacts on for a release build.
 *
 * `desktop/tauri.conf.json` deliberately keeps `createUpdaterArtifacts: false` and carries no
 * `plugins.updater` section, because both of those make `tauri build` demand the signing key: a
 * contributor running a local build must not need the release keypair. The release workflow already
 * layers per-runner settings through `--config <overlay>` (Windows signs by certificate thumbprint
 * that way), so the updater is layered the same way instead of being switched on in the committed
 * config.
 *
 * The names are the ones this organization already publishes and `.github/workflows/build.yml`
 * already consumes: TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD as org
 * secrets, and the public key as the org VARIABLE `TAURI_SIGNING_PUBLIC_KEY` -- a public key is not
 * a secret. Do not invent a second name for either half; build.yml and this overlay must agree, or
 * one pipeline signs with a key the other does not advertise.
 *
 * Without a public key this prints nothing and exits 0. The app already handles that state:
 * `updater_configured()` in desktop/src/lib.rs reports no `plugins.updater` section and
 * src/app/shell/updater.ts skips the check rather than failing. A fork with no keypair must still be
 * able to build; it just gets no updates.
 *
 * A signing key WITHOUT a public key is the one hard error. That combination produces signed
 * artefacts the app can never verify, which looks like a working release until an update is
 * attempted, so it is refused up front.
 *
 * Usage: bun scripts/tauri-updater-overlay.ts <output-path>
 * Environment:
 *   TAURI_SIGNING_PUBLIC_KEY   base64 minisign public key (org variable)
 *   TAURI_SIGNING_PRIVATE_KEY  read by the bundler itself, only checked for consistency here
 *   REDROB_UPDATER_ENDPOINT    override the feed URL (defaults to the CDN feed)
 */

import { writeFile } from 'node:fs/promises'

export const DEFAULT_UPDATER_ENDPOINT = 'https://cdn.redrob.ai/design/latest/latest.json'

export interface UpdaterOverlayEnvironment {
  TAURI_SIGNING_PUBLIC_KEY?: string
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
  const pubkey = env.TAURI_SIGNING_PUBLIC_KEY?.trim()
  const signingKey = env.TAURI_SIGNING_PRIVATE_KEY?.trim()

  if (!pubkey) {
    if (signingKey) {
      throw new Error(
        'TAURI_SIGNING_PRIVATE_KEY is set but TAURI_SIGNING_PUBLIC_KEY is not. ' +
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
    console.log('::notice::TAURI_SIGNING_PUBLIC_KEY is not set, so this build produces no update artefacts.')
    process.exit(0)
  }

  await writeFile(output, `${JSON.stringify(overlay, null, 2)}\n`)
  console.log(`Updater overlay written to ${output} (endpoint ${overlay.plugins.updater.endpoints[0]}).`)
}
