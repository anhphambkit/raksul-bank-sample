import { test, expect, readAccounts } from './fixtures.mjs'
async function fillTransfer(page) {
  await page.getByRole('combobox', { name: 'From account' }).click()
  await page.getByRole('option', { name: /Everyday Checking/ }).click()
  await page.getByRole('combobox', { name: 'To account' }).click()
  await page.getByRole('option', { name: /Rainy Day Savings/ }).click()
  await page.getByPlaceholder('0.00').fill('10.50')
  await page.getByLabel('Reference').fill('Recovered browser transfer')
}
test('dark mode persists and can be changed with the keyboard', async ({ page, environment }) => {
  await page.goto(environment.demo)
  await expect(page.getByRole('article', { name: 'Everyday Checking' })).toBeVisible()
  await page.getByRole('button', { name: /Switch to dark mode/i }).focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('button', { name: /Switch to light mode/i }).click()
  await expect(page.locator('html')).toHaveClass(/light/)
})
test('new recipient is saved, selected, transferred to and retained after reload', async ({
  page,
  environment,
}) => {
  await page.goto(`${environment.demo}/transfer`)
  await page.getByRole('combobox', { name: 'From account' }).click()
  await page.getByRole('option', { name: /Everyday Checking/ }).click()
  await page.getByRole('radio', { name: 'Someone else' }).click()
  await page.getByRole('button', { name: 'Add recipient', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Recipient name').fill('New Browser Recipient')
  await dialog.getByLabel('Bank name').fill('Harbor Bank')
  await dialog.getByLabel('Account number').fill('987654321012')
  await dialog.getByRole('button', { name: 'Save recipient' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /^Recipient/ })).toContainText(
    'New Browser Recipient',
  )
  await page.getByPlaceholder('0.00').fill('10.50')
  await page.getByRole('button', { name: 'Review transfer' }).click()
  await expect(page.locator('body')).not.toContainText('987654321012')
  await page.getByRole('button', { name: 'Confirm transfer' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Transfer complete' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('combobox', { name: 'From account' })).toBeEnabled()
  const beneficiaries = await page.evaluate(async () => (await fetch('/api/beneficiaries')).json())
  expect(beneficiaries.some((b) => b.displayName === 'New Browser Recipient')).toBe(true)
})
test('restores draft and replays a committed request after closing the page without double debit', async ({
  page,
  context,
  environment,
}) => {
  await page.goto(`${environment.demo}/transfer`)
  await fillTransfer(page)
  await page.reload()
  await expect(page.getByPlaceholder('0.00')).toHaveValue('10.50')
  await expect(page.getByLabel('Reference')).toHaveValue('Recovered browser transfer')
  await page.getByRole('button', { name: 'Review transfer' }).click()
  const before = await readAccounts(page)
  // Simulate commit followed by losing the UI response/closing before receipt cleanup.
  const key = await page.evaluate(async () => {
    const key = Object.keys(globalThis.localStorage).find((k) =>
      k.startsWith('raksul-transfer-v1:'),
    )
    const record = JSON.parse(globalThis.localStorage.getItem(key))
    record.submitted = true
    globalThis.localStorage.setItem(key, JSON.stringify(record))
    const response = await fetch('/api/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record.draft.request),
    })
    if (!response.ok) throw new Error('Expected committed transfer')
    return record.draft.request.idempotencyKey
  })
  await page.close()
  const restored = await context.newPage()
  await restored.goto(`${environment.demo}/transfer`)
  await expect(restored.getByRole('button', { name: 'Retry same transfer' })).toBeVisible()
  const after = await readAccounts(restored)
  expect(after[0].balanceMinor).toBe(before[0].balanceMinor - 1050)
  const posts = []
  restored.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.postDataJSON())
  })
  await restored.getByRole('button', { name: 'Retry same transfer' }).click()
  await expect(restored.getByRole('status').filter({ hasText: 'Transfer complete' })).toBeVisible()
  expect(posts[0].idempotencyKey).toBe(key)
  expect(await readAccounts(restored)).toEqual(after)
})
test('another tab refreshes balances automatically after a commit and reset', async ({
  page,
  context,
  environment,
}) => {
  await page.goto(`${environment.demo}/accounts`)
  await expect(page.getByRole('article', { name: 'Everyday Checking' })).toBeVisible()
  const before = await readAccounts(page)
  const other = await context.newPage()
  await other.goto(`${environment.demo}/transfer`)
  await fillTransfer(other)
  await other.getByRole('button', { name: 'Review transfer' }).click()
  await other.getByRole('button', { name: 'Confirm transfer' }).click()
  const money = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100)
  await expect(page.getByRole('article', { name: 'Everyday Checking' })).toContainText(
    money(before[0].balanceMinor - 1050),
  )
  await other.evaluate(async () => fetch('/api/demo/reset', { method: 'POST' }))
  await expect(page.getByRole('article', { name: 'Everyday Checking' })).toContainText(
    money(before[0].balanceMinor),
  )
})
