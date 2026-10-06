import { useLocalStorage } from '@vueuse/core'

import type { SceneGraph } from '@redrob-design/scene-graph'

import {
  PUBLISH_STORAGE_PROFILE,
  activeStorageProviderID,
  createActiveStorageAdapter,
  storageCredentialStatuses,
  storagePreferencesComplete,
  storageProviderRegistry,
  type SiteObjectStore
} from '@/app/integrations/storage'
import { storageFetch } from '@/app/integrations/storage/s3/fetch'
import { demoMode } from '@/app/runtime/demo'

import { buildSite, slugOf, type BuildSiteOptions } from './build'
import { currentPublicSiteURL } from './site'
import { removeSite, uploadSite } from './upload'

export type PublishResult =
  | {
      status: 'published'
      url: string
      /** False when the address could not be checked from here (for example, CORS); the files are up. */
      verified: boolean
      fontFallbacks: string[]
    }
  | { status: 'no-profile' | 'no-public-url' }
  | { status: 'upload-failed' | 'unreachable'; detail: string }

export interface PublishRequest {
  graph: SceneGraph
  pageId: string
  /** The document's stable identity, so republishing a page reuses its address. */
  documentId: string
}

export interface PublishDependencies {
  objects: () => Promise<SiteObjectStore | null>
  siteURL: () => string | null
  /** HEAD the published address: true when it answered, false when it did not, null when it cannot be checked. */
  verify: (url: string) => Promise<boolean | null>
  build: BuildSiteOptions
}

/** Slugs of published pages, by document and page, kept on this computer. */
const slugs = useLocalStorage<Record<string, string>>(
  'redrob-design:publish:slugs',
  {},
  {
    writeDefaults: false
  }
)

function slugKey(documentId: string, pageId: string): string {
  return `${documentId}#${pageId}`
}

export function publishedSlug(documentId: string, pageId: string): string | null {
  return slugs.value[slugKey(documentId, pageId)] ?? null
}

/** The first publish takes the page name; later ones keep the same address. */
function slugFor(request: PublishRequest): string {
  const existing = publishedSlug(request.documentId, request.pageId)
  if (existing) return existing
  const page = request.graph.getNode(request.pageId)
  const base = slugOf(page?.name ?? 'page')
  const taken = new Set(Object.values(slugs.value))
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
  return slug
}

async function publishObjects(): Promise<SiteObjectStore | null> {
  const providerID = activeStorageProviderID.value
  if (!storagePreferencesComplete(providerID, PUBLISH_STORAGE_PROFILE)) return null
  const provider = storageProviderRegistry.get(providerID)
  const statuses = await storageCredentialStatuses(providerID, PUBLISH_STORAGE_PROFILE)
  const ready = provider.credentialFields.every(
    (field) => !field.required || statuses[field.id] === 'configured'
  )
  if (!ready) return null
  return createActiveStorageAdapter(providerID, PUBLISH_STORAGE_PROFILE).siteObjects ?? null
}

async function verifyAddress(url: string): Promise<boolean | null> {
  try {
    const response = await storageFetch(url, { method: 'HEAD', credentials: 'omit' })
    return response.ok
  } catch (error) {
    // A browser blocks reading a site that sends no CORS headers; that says nothing about the site.
    return error instanceof TypeError ? null : false
  }
}

export const defaultPublishDependencies: PublishDependencies = {
  objects: publishObjects,
  siteURL: currentPublicSiteURL,
  verify: verifyAddress,
  build: { fonts: 'assets' }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Whether Publish can run: the publish bucket and its public address are set. */
export async function publishReady(
  dependencies: PublishDependencies = defaultPublishDependencies
): Promise<boolean> {
  return (await dependencies.objects()) !== null && dependencies.siteURL() !== null
}

/** Builds the page as a static site, uploads it to the publish bucket and checks the address. */
export async function publishPage(
  request: PublishRequest,
  dependencies: PublishDependencies = defaultPublishDependencies
): Promise<PublishResult> {
  if (demoMode.value) {
    return {
      status: 'published',
      url: 'https://redrob.io/pricing',
      verified: true,
      fontFallbacks: []
    }
  }
  const objects = await dependencies.objects()
  if (!objects) return { status: 'no-profile' }
  const base = dependencies.siteURL()
  if (!base) return { status: 'no-public-url' }

  const slug = slugFor(request)
  let fontFallbacks: string[]
  try {
    const site = await buildSite(request.graph, request.pageId, dependencies.build)
    fontFallbacks = site.fontFallbacks
    await uploadSite(objects, {
      slug,
      files: site.files,
      documentId: request.documentId,
      pageId: request.pageId
    })
  } catch (error) {
    return { status: 'upload-failed', detail: errorText(error) }
  }
  slugs.value = { ...slugs.value, [slugKey(request.documentId, request.pageId)]: slug }

  const url = `${base}/${slug}/`
  const answered = await dependencies.verify(url)
  if (answered === false) return { status: 'unreachable', detail: url }
  return { status: 'published', url, verified: answered === true, fontFallbacks }
}

/** Takes the page's site down and forgets its address. */
export async function unpublishPage(
  request: Omit<PublishRequest, 'graph'>,
  dependencies: PublishDependencies = defaultPublishDependencies
): Promise<boolean> {
  const slug = publishedSlug(request.documentId, request.pageId)
  if (!slug) return false
  const objects = await dependencies.objects()
  if (!objects) return false
  await removeSite(objects, slug)
  const key = slugKey(request.documentId, request.pageId)
  slugs.value = Object.fromEntries(Object.entries(slugs.value).filter(([entry]) => entry !== key))
  return true
}

export function forgetPublishedSlugsForTests(): void {
  slugs.value = {}
}
