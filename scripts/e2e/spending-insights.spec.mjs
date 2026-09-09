import { test, expect } from './fixtures.mjs'

for (const width of [1440, 768, 390]) {
  test(`spending insights filters and exact demo spending at ${width}px`, async ({
    page,
    environment,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${environment.demo}/spending-insights?month=2026-08`)
    await expect(
      page.getByRole('heading', { name: 'Spending insights', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible()
    const expected = await page.evaluate(async () => {
      const response = await fetch(
        '/api/transactions?direction=DEBIT&status=COMPLETED&dateFrom=2026-08-01&dateTo=2026-08-31&pageSize=100',
      )
      const { data } = await response.json()
      const minor = data
        .filter((entry) => ['CARD', 'CASH', 'FEE'].includes(entry.type))
        .reduce((sum, entry) => sum + entry.amountMinor, 0)
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
        minor / 100,
      )
    })
    await expect(page.getByRole('region', { name: 'Spending summary' })).toContainText(expected)
    expect(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth,
      ),
    ).toBe(true)
    await page.getByLabel('Month (UTC)', { exact: true }).fill('2026-07')
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page).toHaveURL(/month=2026-07/)
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Month (UTC)', { exact: true })).toHaveValue('2026-07')
    await page.goBack()
    await expect(page.getByLabel('Month (UTC)', { exact: true })).toHaveValue('2026-08')
    await page.getByRole('combobox', { name: 'Account', exact: true }).click()
    await page.getByRole('option', { name: 'Rainy Day Savings', exact: true }).click()
    await page.getByRole('button', { name: 'Apply filters' }).click()
    await expect(page).toHaveURL(/accountId=account-savings/)
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Spending summary' })).toContainText(
      'No spending this month',
    )
    await page.screenshot({ path: `test-results/spending-insights-${width}.png`, fullPage: true })
  })
}

test('invalid insights link is recoverable without requesting transactions', async ({
  page,
  environment,
}) => {
  const requests = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/transactions') requests.push(request.url())
  })
  await page.goto(`${environment.demo}/spending-insights?month=2026-13&month=2026-08`)
  await expect(page.getByRole('heading', { name: 'Check the filters in this link' })).toBeVisible()
  expect(requests).toEqual([])
  await page.getByRole('button', { name: 'Clear invalid filters' }).click()
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible()
})

test('insights backend SSR is read-only and hydrates exact zero spending from credit fixture', async ({
  page,
  environment,
}) => {
  const browserReads = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/transactions') browserReads.push(request.url())
  })
  const offset = environment.requests.length
  const response = await page.goto(`${environment.backend}/spending-insights?month=2026-08`)
  const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  expect(html).toContain('$0.00')
  await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeVisible()
  await page.getByLabel('Month (UTC)', { exact: true }).focus()
  expect(browserReads).toHaveLength(0)
  const requests = environment.requests.slice(offset)
  expect(requests.filter((request) => request.method === 'POST')).toHaveLength(0)
  expect(requests.some((request) => request.path.endsWith('/transactions'))).toBe(true)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect.poll(() => browserReads.length).toBe(1)
})
