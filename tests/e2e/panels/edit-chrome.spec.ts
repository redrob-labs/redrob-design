import { expect, test, useEditorSetup } from '#tests/e2e/fixtures'
import { expectDefined } from '#tests/helpers/assert'
import { setAppTheme } from '#tests/helpers/theme'

const editor = useEditorSetup()

test('the right panel tabs read Design, Code and Redrob', async () => {
  const tabs = editor.page.getByTestId('properties-panel').getByRole('tab')
  await expect(tabs).toHaveText(['Design', 'Code', 'Redrob'])
  await expect(editor.page.getByTestId('collab-share-button')).toBeVisible()
  await expect(editor.page.getByTestId('pages-count')).toHaveText('1')
})

test('Ask Redrob in the tool bar opens the Redrob tab', async () => {
  const toolbar = editor.page.getByTestId('toolbar')
  await expect(toolbar.getByTestId('toolbar-ask-redrob')).toHaveText('Ask Redrob')
  await toolbar.getByTestId('toolbar-ask-redrob').click()
  await expect(editor.page.getByTestId('properties-tab-ai')).toHaveAttribute('data-state', 'active')
  await editor.page.getByTestId('properties-tab-design').click()
})

test('the right-click menu starts with Ask Redrob', async () => {
  await editor.canvas.drawRect(200, 200, 120, 80)
  const box = expectDefined(await editor.canvas.canvas.boundingBox(), 'canvas bounds')
  await editor.page.mouse.click(box.x + 250, box.y + 230, { button: 'right' })
  const first = editor.page.getByRole('menu').getByRole('menuitem').first()
  await expect(first).toHaveAttribute('data-test-id', 'context-ask-redrob')
  await expect(first).toContainText('Ask Redrob about this')
  await first.click()
  await expect(editor.page.getByTestId('properties-tab-ai')).toHaveAttribute('data-state', 'active')
  await editor.page.getByTestId('properties-tab-design').click()
})

for (const theme of ['light', 'dark'] as const) {
  test(`Edit chrome in the ${theme} theme`, async () => {
    await setAppTheme(editor.page, theme)
    await editor.canvas.waitForRender()
    await expect(editor.page.getByTestId('toolbar')).toHaveScreenshot(`toolbar-${theme}.png`)
    await expect(editor.page.getByTestId('properties-panel').getByRole('tablist')).toHaveScreenshot(
      `properties-tabs-${theme}.png`
    )
  })
}
