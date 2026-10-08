import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkDocsIntegrity } from '../src/integrity'

async function fixture() {
  const docsRoot = await mkdtemp(join(tmpdir(), 'redrob-design-docs-integrity-'))
  return docsRoot
}

async function write(path: string, content = '# Page') {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content, 'utf8')
}

function check(docsRoot: string, sidebarLinks: string[] = []) {
  return checkDocsIntegrity({
    docsRoot,
    localePrefixes: ['ru'],
    sidebarLinks
  })
}

describe('checkDocsIntegrity', () => {
  test('accepts valid Markdown, sidebars, and incomplete locales', async () => {
    const docsRoot = await fixture()
    await write(join(docsRoot, 'index.md'), '[Page](/page)')
    await write(join(docsRoot, 'page.md'))
    await write(join(docsRoot, 'ru/index.md'))
    await write(join(docsRoot, 'legacy.md'))

    const result = check(docsRoot, ['/page'])

    expect(result.errors).toEqual([])
    expect(result.localeMissingPages.ru).toEqual(['legacy.md', 'page.md'])
  })

  test('rejects pages copied identically into every locale', async () => {
    const docsRoot = await fixture()
    await write(join(docsRoot, 'index.md'), '# English')
    await write(join(docsRoot, 'ru/index.md'), '# Русский')
    await write(join(docsRoot, 'fr/index.md'), '# Français')
    await write(join(docsRoot, 'page.md'), '# Canonical page')
    await write(join(docsRoot, 'ru/page.md'), '# English placeholder')
    await write(join(docsRoot, 'fr/page.md'), '# English placeholder')

    const result = checkDocsIntegrity({
      docsRoot,
      localePrefixes: ['ru', 'fr'],
      sidebarLinks: []
    })

    expect(result.localePlaceholderPages).toEqual({ ru: ['page.md'], fr: ['page.md'] })
    expect(result.errors).toEqual([
      'fr/page.md is identical across every locale and must use the canonical English page instead.',
      'ru/page.md is identical across every locale and must use the canonical English page instead.'
    ])
  })

  test('rejects substantial localized pages detected as English', async () => {
    const docsRoot = await fixture()
    const english = Array.from(
      { length: 20 },
      () => 'This localized page contains English documentation that should not be published here.'
    ).join(' ')
    await write(join(docsRoot, 'index.md'), '# English')
    await write(
      join(docsRoot, 'ru/index.md'),
      `# Русский\n\n${'Это русская документация. '.repeat(80)}`
    )
    await write(join(docsRoot, 'ru/page.md'), english)

    const result = check(docsRoot)

    expect(result.localeSuspectPages.ru).toEqual(['page.md'])
    expect(result.errors).toEqual([
      'ru/page.md is detected as English and must be translated or use the canonical English page.'
    ])
  })

  test('uses Markdown syntax instead of treating code parentheses as links', async () => {
    const docsRoot = await fixture()
    const markdown = [
      '`call(not-a-link)`',
      '',
      '```ts',
      'call(still-not-a-link)',
      '```',
      '',
      '[Page][page]',
      '',
      '[page]: /page'
    ].join('\n')
    await write(join(docsRoot, 'index.md'), markdown)
    await write(join(docsRoot, 'page.md'))

    expect(check(docsRoot).errors).toEqual([])
  })

  test('reports missing Markdown and sidebar targets', async () => {
    const docsRoot = await fixture()
    await write(join(docsRoot, 'index.md'), '[Missing](./missing)')

    expect(check(docsRoot, ['/also-missing']).errors).toEqual([
      "Sidebar links to missing page '/also-missing'.",
      "index.md links to missing target './missing'."
    ])
  })
})
