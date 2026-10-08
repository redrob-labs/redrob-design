import type { RankedPick } from './types'

/** The parts of a saved model profile a pick is matched against. */
export interface PickableProfile {
  id: string
  name: string
  modelID: string
  customModelID?: string
}

function compact(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]/g, '')
}

/**
 * Finds the saved profile that runs a pinned pick, so pinning in the composer
 * uses the person's own key. Matches the pick's short name (e.g. "Opus 5.5")
 * against the profile's model id or name, ignoring case and punctuation.
 * Returns null when no profile runs that model; Redrob Auto keeps the role.
 */
export function profileForPick<T extends PickableProfile>(
  pick: RankedPick,
  profiles: readonly T[]
): T | null {
  const needle = compact(pick.short ?? pick.model)
  const full = compact(pick.model)
  if (!needle) return null
  for (const profile of profiles) {
    const haystacks = [profile.customModelID ?? '', profile.modelID, profile.name].map(compact)
    if (haystacks.some((hay) => hay.includes(full) || hay.includes(needle))) return profile
  }
  return null
}
