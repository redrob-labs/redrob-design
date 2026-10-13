/**
 * The release manifest Redrob Launcher reads beside the installers: `redrob-launcher.json`.
 *
 * The launcher learns from this one small file what a release can do, so nothing in the launcher
 * has to change when this app ships. Schema 1 carries one fact: `sharedAccount` is true when the
 * release reads the launcher's shared account file, so signing in to the launcher is all it needs.
 * The launcher reads the file only from the release's own download URL and ignores unknown fields.
 *
 * The release workflow writes the file from `launcherManifestText()` before the asset-name check,
 * and the check refuses to publish a release that lacks it or carries anything else under the name.
 */

export const LAUNCHER_MANIFEST_NAME = 'redrob-launcher.json'

export const LAUNCHER_MANIFEST_SCHEMA = 1

/** This app reads the launcher's shared account file (desktop/src-tauri, shared-account). */
export const LAUNCHER_MANIFEST_SHARED_ACCOUNT = true

export interface LauncherManifest {
  schema: typeof LAUNCHER_MANIFEST_SCHEMA
  sharedAccount: boolean
}

export function launcherManifest(): LauncherManifest {
  return { schema: LAUNCHER_MANIFEST_SCHEMA, sharedAccount: LAUNCHER_MANIFEST_SHARED_ACCOUNT }
}

/** The exact bytes the workflow uploads: one line, newline-terminated. */
export function launcherManifestText(): string {
  return `{ "schema": ${LAUNCHER_MANIFEST_SCHEMA}, "sharedAccount": ${LAUNCHER_MANIFEST_SHARED_ACCOUNT} }\n`
}

/** What the launcher reads: an object whose two known fields may hold anything until checked. */
interface LauncherManifestCandidate {
  schema?: unknown
  sharedAccount?: unknown
}

function isCandidate(value: unknown): value is LauncherManifestCandidate {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Judge the manifest about to become a release asset. `null` means the file is absent.
 *
 * Returns every problem rather than the first: not JSON, not an object, the wrong schema, or a
 * `sharedAccount` that does not say what this app's develop branch does.
 */
export function checkLauncherManifest(text: string | null): string[] {
  if (text === null) {
    return [
      `missing ${LAUNCHER_MANIFEST_NAME}: Redrob Launcher reads it to learn that this release uses the launcher sign-in`
    ]
  }
  let manifest: unknown
  try {
    manifest = JSON.parse(text)
  } catch {
    return [`${LAUNCHER_MANIFEST_NAME}: not valid JSON`]
  }
  if (!isCandidate(manifest)) {
    return [`${LAUNCHER_MANIFEST_NAME}: must be a JSON object`]
  }
  const errors: string[] = []
  if (manifest.schema !== LAUNCHER_MANIFEST_SCHEMA) {
    errors.push(
      `${LAUNCHER_MANIFEST_NAME}: schema must be ${LAUNCHER_MANIFEST_SCHEMA}, got ${JSON.stringify(manifest.schema)}`
    )
  }
  if (manifest.sharedAccount !== LAUNCHER_MANIFEST_SHARED_ACCOUNT) {
    errors.push(
      `${LAUNCHER_MANIFEST_NAME}: sharedAccount must be ${LAUNCHER_MANIFEST_SHARED_ACCOUNT}, got ${JSON.stringify(manifest.sharedAccount)}`
    )
  }
  return errors
}
