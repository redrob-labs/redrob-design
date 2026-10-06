import { afterEach, describe, expect, test } from 'bun:test'

import { createEditor } from '@redrob-design/core/editor'

import type { SiteObjectStore } from '@/app/integrations/storage'
import { demoMode } from '@/app/runtime/demo'
import { buildSite, contentTypeFor, slugOf } from '@/app/ship/publish/build'
import {
  forgetPublishedSlugsForTests,
  publishPage,
  publishedSlug,
  unpublishPage,
  type PublishDependencies
} from '@/app/ship/publish/service'
import {
  IMMUTABLE_CACHE,
  NO_CACHE,
  readManifest,
  removeSite,
  uploadSite
} from '@/app/ship/publish/upload'

interface Write {
  op: 'put' | 'delete'
  key: string
  cacheControl?: string
}

function memoryObjects() {
  const objects = new Map<string, Uint8Array>()
  const log: Write[] = []
  const store: SiteObjectStore = {
    getObject: (key) => Promise.resolve(objects.get(key) ?? null),
    putObject: (key, bytes, _type, cacheControl) => {
      objects.set(key, bytes)
      log.push({ op: 'put', key, cacheControl })
      return Promise.resolve()
    },
    deleteObject: (key) => {
      objects.delete(key)
      log.push({ op: 'delete', key })
      return Promise.resolve()
    }
  }
  return { store, objects, log }
}

function pricingPage() {
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  editor.graph.updateNode(pageId, { name: 'Pricing' })
  const card = editor.graph.createNode('FRAME', pageId, { name: 'Team', width: 240, height: 120 })
  editor.graph.createNode('TEXT', card.id, {
    name: 'Price',
    text: '$24 per person',
    fontFamily: 'Pretendard'
  })
  return { editor, pageId }
}

function file(path: string, text: string, immutable = true) {
  return {
    path,
    bytes: new TextEncoder().encode(text),
    contentType: contentTypeFor(path),
    immutable
  }
}

afterEach(() => {
  demoMode.value = false
  forgetPublishedSlugsForTests()
})

describe('building a site', () => {
  test('one page, a hashed stylesheet it links, and typefaces that fall back', async () => {
    const { editor, pageId } = pricingPage()
    const site = await buildSite(editor.graph, pageId, { fonts: 'none' })
    const paths = site.files.map((entry) => entry.path)
    expect(paths.at(-1)).toBe('index.html')
    const css = paths.find((path) => path.endsWith('.css'))
    expect(css).toMatch(/^assets\/redrobdesign\.[0-9a-f]{12}\.css$/)
    const html = new TextDecoder().decode(site.files.at(-1)?.bytes)
    expect(html).toContain(`href="${css}"`)
    expect(html).toContain('$24 per person')
    expect(site.files.find((entry) => entry.path === css)?.immutable).toBe(true)
    expect(site.files.at(-1)?.immutable).toBe(false)
    expect(site.fontFallbacks).toEqual(['Pretendard'])
  })

  test('the same page builds the same names', async () => {
    const { editor, pageId } = pricingPage()
    const first = await buildSite(editor.graph, pageId, { fonts: 'none' })
    const again = await buildSite(editor.graph, pageId, { fonts: 'none' })
    expect(again.files.map((entry) => entry.path)).toEqual(first.files.map((entry) => entry.path))
  })

  test('slugs are short, lowercase and URL safe', () => {
    expect(slugOf('Pricing — Q4 / Team')).toBe('pricing-q4-team')
    expect(slugOf('   ')).toBe('page')
  })
})

describe('uploading a site', () => {
  test('assets, then publish.json, then index.html, each cached right', async () => {
    const { store, log } = memoryObjects()
    await uploadSite(store, {
      slug: 'pricing',
      files: [file('assets/a.1.css', 'a'), file('index.html', '<p>', false)],
      documentId: 'doc',
      pageId: '0:1',
      now: 0
    })
    expect(log).toEqual([
      { op: 'put', key: 'sites/pricing/assets/a.1.css', cacheControl: IMMUTABLE_CACHE },
      { op: 'put', key: 'sites/pricing/publish.json', cacheControl: NO_CACHE },
      { op: 'put', key: 'sites/pricing/index.html', cacheControl: NO_CACHE }
    ])
    expect(await readManifest(store, 'pricing')).toMatchObject({
      revision: 1,
      documentId: 'doc',
      files: ['assets/a.1.css', 'index.html']
    })
  })

  test('republishing removes assets the page no longer uses, after the new page is up', async () => {
    const { store, log, objects } = memoryObjects()
    const base = { slug: 'pricing', documentId: 'doc', pageId: '0:1' }
    await uploadSite(store, {
      ...base,
      files: [file('assets/a.1.css', 'a'), file('index.html', '1', false)]
    })
    log.length = 0
    const manifest = await uploadSite(store, {
      ...base,
      files: [file('assets/a.2.css', 'b'), file('index.html', '2', false)]
    })
    expect(manifest.revision).toBe(2)
    expect(log.map((entry) => `${entry.op} ${entry.key}`)).toEqual([
      'put sites/pricing/assets/a.2.css',
      'put sites/pricing/publish.json',
      'put sites/pricing/index.html',
      'delete sites/pricing/assets/a.1.css'
    ])
    expect(objects.has('sites/pricing/assets/a.1.css')).toBe(false)
  })

  test('unpublishing takes the page down first and leaves nothing', async () => {
    const { store, log, objects } = memoryObjects()
    await uploadSite(store, {
      slug: 'pricing',
      documentId: 'doc',
      pageId: '0:1',
      files: [file('assets/a.1.css', 'a'), file('index.html', '1', false)]
    })
    log.length = 0
    expect(await removeSite(store, 'pricing')).toBe(true)
    expect(log[0]?.key).toBe('sites/pricing/index.html')
    expect(objects.size).toBe(0)
    expect(await removeSite(store, 'pricing')).toBe(false)
  })
})

describe('Publish', () => {
  function dependencies(overrides: Partial<PublishDependencies> = {}): PublishDependencies {
    const { store } = memoryObjects()
    return {
      objects: () => Promise.resolve(store),
      siteURL: () => 'https://site.example.com',
      verify: () => Promise.resolve(true),
      build: { fonts: 'none' },
      ...overrides
    }
  }

  test('says what is missing before it uploads anything', async () => {
    const { editor, pageId } = pricingPage()
    const request = { graph: editor.graph, pageId, documentId: 'doc' }
    expect(
      await publishPage(request, dependencies({ objects: () => Promise.resolve(null) }))
    ).toEqual({
      status: 'no-profile'
    })
    expect(await publishPage(request, dependencies({ siteURL: () => null }))).toEqual({
      status: 'no-public-url'
    })
  })

  test('publishes under the page name, keeps the address, and unpublishes', async () => {
    const { editor, pageId } = pricingPage()
    const deps = dependencies()
    const request = { graph: editor.graph, pageId, documentId: 'doc' }
    expect(await publishPage(request, deps)).toEqual({
      status: 'published',
      url: 'https://site.example.com/pricing/',
      verified: true,
      fontFallbacks: ['Pretendard']
    })
    editor.graph.updateNode(pageId, { name: 'Renamed' })
    expect(await publishPage(request, deps)).toMatchObject({
      url: 'https://site.example.com/pricing/'
    })
    expect(publishedSlug('doc', pageId)).toBe('pricing')

    expect(await unpublishPage({ pageId, documentId: 'doc' }, deps)).toBe(true)
    expect(publishedSlug('doc', pageId)).toBeNull()
  })

  test('reports an address that does not answer, and one that cannot be checked', async () => {
    const { editor, pageId } = pricingPage()
    const request = { graph: editor.graph, pageId, documentId: 'doc' }
    expect(
      await publishPage(request, dependencies({ verify: () => Promise.resolve(false) }))
    ).toEqual({
      status: 'unreachable',
      detail: 'https://site.example.com/pricing/'
    })
    expect(
      await publishPage(request, dependencies({ verify: () => Promise.resolve(null) }))
    ).toMatchObject({ status: 'published', verified: false })
  })

  test('reports a failed upload', async () => {
    const { editor, pageId } = pricingPage()
    const failing: SiteObjectStore = {
      getObject: () => Promise.resolve(null),
      putObject: () => Promise.reject(new Error('403 Forbidden')),
      deleteObject: () => Promise.resolve()
    }
    expect(
      await publishPage(
        { graph: editor.graph, pageId, documentId: 'doc' },
        dependencies({ objects: () => Promise.resolve(failing) })
      )
    ).toEqual({ status: 'upload-failed', detail: '403 Forbidden' })
    expect(publishedSlug('doc', pageId)).toBeNull()
  })

  test('the demo answers the way the prototype does', async () => {
    demoMode.value = true
    const { editor, pageId } = pricingPage()
    expect(
      await publishPage(
        { graph: editor.graph, pageId, documentId: 'doc' },
        dependencies({ objects: () => Promise.resolve(null) })
      )
    ).toMatchObject({ status: 'published', url: 'https://redrob.io/pricing' })
  })
})
