import { test, expect } from '@playwright/test'
const stories = [
  'accountcard--active',
  'accountcard--frozen',
  'moneydisplay--default',
  'moneyinput--default',
  'moneyinput--invalid',
  'transactiontable--default',
  'transferdetailsform--default',
  'transferreview--default',
  'transferreview--confirming',
  'transferreview--uncertain',
  'transferreceipt--default',
]
for (const theme of ['light', 'dark']) {
  test(`all component stories render in ${theme}`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const story of stories) {
      await page.goto(`/iframe.html?id=banking-${story}&viewMode=story&globals=theme:${theme}`)
      await expect(page.locator('#storybook-root')).not.toBeEmpty()
      await expect(page.locator('#storybook-root')).toBeVisible()
      await expect(page.locator('.sb-errordisplay')).not.toBeVisible()
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^((?!dark).)*$/)
    }
    expect(errors).toEqual([])
  })
}

test('seven component groups are indexed and Controls update the rendered amount', async ({
  page,
  request,
}) => {
  const index = await (await request.get('/index.json')).json()
  expect(
    new Set(
      Object.values(index.entries)
        .filter((entry) => entry.type === 'story')
        .map((entry) => entry.title),
    ).size,
  ).toBe(7)
  await page.goto('/?path=/story/banking-moneydisplay--default')
  await page.getByRole('tab', { name: /Controls/ }).click()
  await page.locator('#control-amountMinor').fill('250075')
  await page.locator('#control-amountMinor').press('Tab')
  await expect(
    page.frameLocator('#storybook-preview-iframe').locator('#storybook-root'),
  ).toContainText('$2,500.75')
})
