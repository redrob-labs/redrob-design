import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { openMainMenu } from '#tests/helpers/menu'
import { setAppTheme } from '#tests/helpers/theme'

const editor = useEditorSetup()

for (const theme of ['light', 'dark'] as const) {
  test(`window tab bar in the ${theme} theme`, async () => {
    const { page } = editor
    await setAppTheme(page, theme)

    const tabBar = page.getByTestId('tabbar')
    await expect(tabBar).toBeVisible()
    const box = await tabBar.boundingBox()
    expect(box?.height).toBe(40)
    await expect(tabBar).toHaveScreenshot(`tab-bar-${theme}.png`)

    const menu = await openMainMenu(page)
    await expect(menu).toHaveScreenshot(`main-menu-${theme}.png`)
    await page.keyboard.press('Escape')
  })
}
