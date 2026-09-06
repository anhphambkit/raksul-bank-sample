import { test, expect } from './fixtures.mjs'

test('SSR data hydrates without a duplicate fetch; navigation reuses cache', async ({
  page,
  context,
  environment,
}) => {
  await context.addCookies([{ name: 'customer', value: 'b', url: environment.backend }])
  await context.setExtraHTTPHeaders({ authorization: 'Bearer browser-fixture' })
  const browserRequests = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/accounts') browserRequests.push(request)
  })
  const offset = environment.requests.length
  const response = await page.goto(`${environment.backend}/accounts`)
  const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  expect(html).toContain('Beta SSR Checking')
  expect(html).not.toContain('Alpha SSR Checking')
  await expect(page.getByRole('article', { name: 'Beta SSR Checking' })).toBeVisible()
  // Navigation proves the app hydrated and is interactive; the same accounts key stays fresh.
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(page).toHaveTitle('Overview · Raksul-bank')
  await expect(page.getByText('Beta SSR payroll').first()).toBeVisible()
  await page.getByRole('link', { name: 'Accounts', exact: true }).click()
  await expect(page.getByRole('article', { name: 'Beta SSR Checking' })).toBeVisible()
  expect(browserRequests).toHaveLength(0)
  const ssrRequests = environment.requests.slice(offset).filter((r) => r.path.endsWith('/accounts'))
  expect(ssrRequests).toHaveLength(1)
  expect(ssrRequests[0]).toMatchObject({
    cookie: 'customer=b',
    authorization: 'Bearer browser-fixture',
  })
  expect(
    await page.evaluate(() =>
      globalThis.navigator.serviceWorker.getRegistrations().then((items) => items.length),
    ),
  ).toBe(0)
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect.poll(() => browserRequests.length).toBe(1)
  await expect
    .poll(
      () => environment.requests.slice(offset).filter((r) => r.path.endsWith('/accounts')).length,
    )
    .toBe(2)
  await expect(page.getByRole('article', { name: 'Beta SSR Checking' })).toBeVisible()
})

test('SSR API error survives hydration and explicit retry recovers', async ({
  page,
  context,
  environment,
}) => {
  await context.addCookies([{ name: 'customer', value: 'storage-error', url: environment.backend }])
  const offset = environment.requests.length
  const response = await page.goto(`${environment.backend}/accounts`)
  expect((await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')).toContain(
    'Unable to load accounts',
  )
  await expect(page.getByText('Unable to load accounts')).toBeVisible()
  // This message requires instanceof ApiError, proving the payload reviver restored the class.
  await expect(
    page.getByText('Demo storage is unavailable. Close older tabs if necessary and try again.'),
  ).toBeVisible()
  await context.addCookies([{ name: 'customer', value: 'a', url: environment.backend }])
  await page.getByRole('button', { name: /retry|try again/i }).click()
  await expect(page.getByRole('article', { name: 'Alpha SSR Checking' })).toBeVisible()
  const requests = environment.requests.slice(offset).filter((r) => r.path.endsWith('/accounts'))
  expect(requests.map((r) => r.cookie)).toEqual(['customer=storage-error', 'customer=a'])
})
