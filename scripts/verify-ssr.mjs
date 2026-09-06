import process from 'node:process'
import assert from 'node:assert/strict'
import { createTestEnvironment } from './testing/environment.mjs'

const environment = await createTestEnvironment()
const { requests, backendUrl, start } = environment

try {
  const real = await start({ NUXT_PUBLIC_ENABLE_MOCKS: 'false', NUXT_API_BASE_URL: backendUrl })
  const read = async (path, customer = 'a') => {
    const response = await fetch(real.url + path, {
      headers: { cookie: `customer=${customer}`, authorization: 'Bearer fixture-token' },
    })
    assert.equal(response.status, 200)
    return response.text()
  }
  const [alpha, beta] = await Promise.all([read('/accounts'), read('/accounts', 'b')])
  const rendered = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')
  assert.match(rendered(alpha), /Alpha SSR Checking/)
  assert.doesNotMatch(alpha, /Beta SSR Checking/)
  assert.match(rendered(beta), /Beta SSR Checking/)
  assert.doesNotMatch(beta, /Alpha SSR Checking/)
  assert.match(alpha, /<title>Accounts · Raksul-bank<\/title>/)
  assert.doesNotMatch(alpha, /Reset demo data/)
  assert.doesNotMatch(alpha, new RegExp(backendUrl))
  assert.match(alpha, /__NUXT_DATA__/)
  assert.match(rendered(await read('/')), /Alpha SSR payroll/)
  assert.match(await read('/transactions?query=payroll&page=2'), /Alpha SSR payroll/)
  assert.ok(requests.some((r) => r.query.includes('query=payroll') && r.query.includes('page=2')))
  assert.ok(
    requests.some((r) => r.cookie === 'customer=b' && r.authorization === 'Bearer fixture-token'),
  )
  const beforeForm = requests.filter((r) => r.method === 'POST').length
  const transferHtml = rendered(await read('/transfer'))
  assert.match(transferHtml, /From account/)
  assert.match(transferHtml, /Review transfer/)
  assert.doesNotMatch(transferHtml, /Unable to load transfer details/)
  assert.equal(requests.filter((r) => r.method === 'POST').length, beforeForm)
  assert.ok(requests.some((r) => r.path.endsWith('/beneficiaries') && r.cookie === 'customer=a'))
  const transferBody = JSON.stringify({
    idempotencyKey: 'fixture-key',
    sourceAccountId: 'account-1',
    destination: { kind: 'BENEFICIARY', beneficiaryId: 'beneficiary-1' },
    amountMinor: 29,
    currency: 'USD',
    reference: 'Exact cents',
  })
  const postHeaders = {
    'Content-Type': 'application/json',
    cookie: 'customer=b',
    authorization: 'Bearer fixture-token',
  }
  const transferred = await fetch(real.url + '/api/transfers', {
    method: 'POST',
    headers: postHeaders,
    body: transferBody,
  })
  assert.equal(transferred.status, 200)
  assert.equal((await transferred.json()).amountMinor, 29)
  assert.match(transferred.headers.get('cache-control'), /private, no-store/)
  const posts = requests.filter((r) => r.method === 'POST' && r.path.endsWith('/transfers'))
  assert.equal(posts.length, 1)
  assert.equal(posts[0].body, transferBody)
  assert.equal(posts[0].cookie, 'customer=b')
  assert.equal(posts[0].authorization, 'Bearer fixture-token')
  const rejected = await fetch(real.url + '/api/transfers', {
    method: 'POST',
    headers: postHeaders,
    body: transferBody.replace('"amountMinor":29', '"amountMinor":999999'),
  })
  assert.equal(rejected.status, 422)
  assert.equal((await rejected.json()).error.code, 'INSUFFICIENT_FUNDS')
  assert.equal(
    requests.filter((r) => r.method === 'POST' && r.path.endsWith('/transfers')).length,
    2,
  )
  const beforeInvalid = requests.filter((r) => r.path.endsWith('/transactions')).length
  assert.match(await read('/transactions?page=invalid'), /Check the filters in this link/)
  assert.equal(requests.filter((r) => r.path.endsWith('/transactions')).length, beforeInvalid)
  assert.match(await read('/accounts', 'error'), /Unable to load accounts/)
  assert.equal((await fetch(real.url + '/api/demo/reset', { method: 'POST' })).status, 404)
  assert.equal((await fetch(real.url + '/missing-page')).status, 404)
  assert.match(
    (await fetch(real.url + '/accounts')).headers.get('cache-control'),
    /private, no-store/,
  )
  assert.match(
    (await fetch(real.url + '/api/accounts')).headers.get('cache-control'),
    /private, no-store/,
  )
  const demo = await start({ NUXT_PUBLIC_ENABLE_MOCKS: 'true', NUXT_API_BASE_URL: '' })
  const html = await (await fetch(demo.url + '/accounts')).text()
  assert.match(html, /Loading accounts/)
  assert.match(html, /Reset demo data/)
  assert.match(await (await fetch(demo.url + '/transfer')).text(), /Loading transfer details/)
  assert.equal(
    (
      await fetch(demo.url + '/api/transfers', {
        method: 'POST',
        headers: postHeaders,
        body: transferBody,
      })
    ).status,
    503,
  )
  assert.equal((await fetch(demo.url + '/api/accounts')).status, 503)
  assert.equal((await fetch(demo.url + '/mockServiceWorker.js')).status, 200)
  const missing = await start({ NUXT_PUBLIC_ENABLE_MOCKS: 'false', NUXT_API_BASE_URL: '' })
  const unavailable = await fetch(missing.url + '/api/accounts')
  assert.equal(unavailable.status, 503)
  assert.equal((await unavailable.json()).error.code, 'API_NOT_CONFIGURED')
  console.log(
    'SSR smoke passed: rendered data, request isolation, cookies/auth, filtered URLs, transfer form and POST forwarding, errors, 404, private cache, demo and missing-backend modes.',
  )
  if (process.argv.includes('--serve')) {
    console.log(`Browser verification: backend ${real.url}, demo ${demo.url}`)
    await new Promise((resolve) => process.once('SIGINT', resolve))
  }
} finally {
  await environment.close()
}
