import { z } from 'zod'

import type { SiteObjectStore } from '@/app/integrations/storage'

import type { SiteFile } from './build'

/** Published sites live under their own prefix, apart from synced documents. */
export const SITES_PREFIX = 'sites'

export const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'
export const NO_CACHE = 'no-cache'

const manifestSchema = z.object({
  format: z.literal('redrob-design.publish'),
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  publishedAt: z.string(),
  documentId: z.string(),
  pageId: z.string(),
  files: z.array(z.string())
})

/** What `publish.json` records about the site currently live under a slug. */
export type PublishManifest = z.infer<typeof manifestSchema>

export function siteKey(slug: string, path: string): string {
  return `${SITES_PREFIX}/${slug}/${path}`
}

export async function readManifest(
  objects: SiteObjectStore,
  slug: string
): Promise<PublishManifest | null> {
  const bytes = await objects.getObject(siteKey(slug, 'publish.json'))
  if (!bytes) return null
  try {
    const parsed = manifestSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export interface UploadSiteInput {
  slug: string
  files: SiteFile[]
  documentId: string
  pageId: string
  now?: number
}

/**
 * Uploads a site so visitors never see a page pointing at files that are not
 * there yet: assets first, then `publish.json`, then `index.html`. Assets the
 * previous publish listed and this one does not are removed last.
 */
export async function uploadSite(
  objects: SiteObjectStore,
  input: UploadSiteInput
): Promise<PublishManifest> {
  const previous = await readManifest(objects, input.slug)
  const assets = input.files.filter((file) => file.immutable)
  const pages = input.files.filter((file) => !file.immutable)

  for (const file of assets) {
    await objects.putObject(
      siteKey(input.slug, file.path),
      file.bytes,
      file.contentType,
      IMMUTABLE_CACHE
    )
  }

  const manifest: PublishManifest = {
    format: 'redrob-design.publish',
    version: 1,
    revision: (previous?.revision ?? 0) + 1,
    publishedAt: new Date(input.now ?? Date.now()).toISOString(),
    documentId: input.documentId,
    pageId: input.pageId,
    files: input.files.map((file) => file.path)
  }
  await objects.putObject(
    siteKey(input.slug, 'publish.json'),
    new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`),
    'application/json',
    NO_CACHE
  )

  for (const file of pages) {
    await objects.putObject(siteKey(input.slug, file.path), file.bytes, file.contentType, NO_CACHE)
  }

  const kept = new Set(manifest.files)
  for (const path of previous?.files ?? []) {
    if (!kept.has(path)) await objects.deleteObject(siteKey(input.slug, path))
  }
  return manifest
}

/** Takes a site down: its page first, so nobody loads a page with missing files. */
export async function removeSite(objects: SiteObjectStore, slug: string): Promise<boolean> {
  const manifest = await readManifest(objects, slug)
  if (!manifest) return false
  const ordered = [
    ...manifest.files.filter((path) => path === 'index.html'),
    ...manifest.files.filter((path) => path !== 'index.html')
  ]
  for (const path of ordered) await objects.deleteObject(siteKey(slug, path))
  await objects.deleteObject(siteKey(slug, 'publish.json'))
  return true
}
