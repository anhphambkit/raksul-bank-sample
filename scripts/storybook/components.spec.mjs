import { test, expect } from '@playwright/test'
const stories = [
  'active-account',
  'frozen-account',
  'money',
  'amount-input',
  'invalid-amount',
  'transactions',
  'details',
  'review',
  'confirming',
  'uncertain-outcome',
  'receipt',
]
for (const theme of ['light', 'dark']) {
  test(`all component stories render in ${theme}`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const story of stories) {
      await page.goto(
        `/iframe.html?id=banking-components--${story}&viewMode=story&globals=theme:${theme}`,
      )
      await expect(page.locator('#storybook-root')).not.toBeEmpty()
      await expect(page.locator('#storybook-root')).toBeVisible()
      await expect(page.locator('.sb-errordisplay')).not.toBeVisible()
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^((?!dark).)*$/)
    }
    expect(errors).toEqual([])
  })
}
