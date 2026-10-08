import type { VersionInput, VersionMeta, VersionStore } from './types'

/** How many automatic versions a document keeps; named versions do not count. */
export const AUTO_VERSION_LIMIT = 30

/** The least time between two automatic versions of the same document. */
export const AUTO_VERSION_INTERVAL_MS = 10 * 60_000

function versionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  return `version-${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/** The automatic versions past the limit, oldest first, for removal. */
export function overflowingAutoVersions(
  versions: readonly VersionMeta[],
  limit = AUTO_VERSION_LIMIT
): VersionMeta[] {
  const autos = versions
    .filter((version) => version.kind === 'auto')
    .toSorted((left, right) => right.createdAt.localeCompare(left.createdAt))
  return autos.slice(limit).toReversed()
}

/**
 * Saves a version and drops the automatic ones past the limit. Returns the
 * saved version and those dropped, so Redrob Cloud can drop them too.
 */
export async function saveVersion(
  store: VersionStore,
  input: VersionInput,
  now = new Date()
): Promise<{ saved: VersionMeta; dropped: VersionMeta[] }> {
  const saved: VersionMeta = {
    id: versionId(),
    documentKey: input.documentKey,
    documentName: input.documentName || 'Untitled',
    kind: input.kind,
    name: input.kind === 'named' ? input.name : null,
    createdAt: now.toISOString(),
    sceneVersion: input.sceneVersion,
    byteLength: input.figBytes.byteLength,
    remoteId: null
  }
  await store.write(saved, input.figBytes, input.preview)
  const dropped = overflowingAutoVersions(await store.list(input.documentKey))
  for (const version of dropped) await store.remove(version.id)
  return { saved, dropped }
}

/** True when enough time has passed since the latest version for an automatic one. */
export function autoVersionDue(
  latest: VersionMeta | undefined,
  now: number,
  interval = AUTO_VERSION_INTERVAL_MS
): boolean {
  return !latest || now - Date.parse(latest.createdAt) >= interval
}
