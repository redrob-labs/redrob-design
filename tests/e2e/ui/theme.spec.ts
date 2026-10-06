import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'

const editor = useEditorSetup()

async function setAppTheme(page: typeof editor.page, value: 'dark' | 'light') {
  // Through the app's theme API (module state, not raw localStorage), so the watcher applies it and
  // pushes the ruler theme to the active editor.
  await page.evaluate(async (next) => {
    const themeModulePath = '/src/app/shell/theme.ts'
    const themeModule = await import(themeModulePath)
    themeModule.useAppTheme().setTheme(next)
  }, value)
  await page.waitForFunction((next) => document.documentElement.dataset.theme === next, value)
}

test('rulers follow the active theme', async () => {
  const { page } = editor

  const readState = () =>
    page.evaluate(() => {
      const store = window.redrobDesign?.getStore?.()
      const style = getComputedStyle(document.documentElement)
      return {
        cssTheme: document.documentElement.dataset.theme,
        cssRulerBg: style.getPropertyValue('--color-ruler-bg').trim(),
        storeRulerBg: store?.state.rulerTheme?.background ?? null
      }
    })

  await setAppTheme(page, 'light')
  const light = await readState()
  expect(light.cssTheme).toBe('light')

  await setAppTheme(page, 'dark')
  const dark = await readState()
  expect(dark.cssTheme).toBe('dark')
  // Canvas ruler theme must track the dark tokens, not stay on the light values.
  expect(dark.cssRulerBg).not.toBe(light.cssRulerBg)
  expect(dark.storeRulerBg).not.toBeNull()

  await setAppTheme(page, 'light')
})

test('the canvas page follows the theme until the page has its own colour', async () => {
  const { page } = editor
  const readPage = () =>
    page.evaluate(() => {
      const state = window.redrobDesign?.getStore?.()?.state
      return { own: state?.pageColor ?? null, theme: state?.canvasTheme?.page ?? null }
    })
  const to255 = (color: { r: number; g: number; b: number } | null) =>
    color ? [color.r, color.g, color.b].map((channel) => Math.round(channel * 255)) : null

  await setAppTheme(page, 'light')
  const light = await readPage()
  expect(light.own).toBeNull()
  // The .fig page default, so files look the same here and in Figma.
  expect(to255(light.theme)).toEqual([245, 245, 245])

  await setAppTheme(page, 'dark')
  const dark = await readPage()
  expect(dark.own).toBeNull()
  // The design system's dark sunken surface, #1c1f26.
  expect(to255(dark.theme)).toEqual([28, 31, 38])

  await page.evaluate(() =>
    window.redrobDesign?.getStore?.()?.setPageColor({ r: 1, g: 1, b: 1, a: 1 })
  )
  await setAppTheme(page, 'light')
  expect((await readPage()).own).toEqual({ r: 1, g: 1, b: 1, a: 1 })
})

test('a fresh profile starts in the light theme', async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
  await context.close()
})
