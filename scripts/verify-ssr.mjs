import process from 'node:process'
import { Buffer } from 'node:buffer'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const requests = []
const backend = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://fixture')
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = Buffer.concat(chunks).toString()
  requests.push({
    method: req.method,
    body,
    path: url.pathname,
    query: url.search,
    cookie: req.headers.cookie,
    authorization: req.headers.authorization,
  })
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'public, max-age=600')
  if (req.headers.cookie?.includes('customer=error')) {
    res.writeHead(503)
    res.end(
      JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Fixture unavailable' } }),
    )
    return
  }
  const owner = req.headers.cookie?.includes('customer=b') ? 'Beta' : 'Alpha'
  const account = {
    id: 'account-1',
    ownerId: owner,
    displayName: `${owner} SSR Checking`,
    type: 'CHECKING',
    accountNumber: '1234567890',
    currency: 'USD',
    balanceMinor: 123456,
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
  }
  if (url.pathname === '/bank/v1/accounts') res.end(JSON.stringify([account]))
  else if (url.pathname === '/bank/v1/beneficiaries')
    res.end(
      JSON.stringify([
        {
          id: 'beneficiary-1',
          customerId: owner,
          displayName: `${owner} recipient`,
          bankName: 'Fixture Bank',
          accountNumber: '9876543210',
          currency: 'USD',
        },
      ]),
    )
  else if (url.pathname === '/bank/v1/transfers' && req.method === 'POST') {
    const transfer = JSON.parse(body)
    if (transfer.amountMinor === 999999) {
      res.writeHead(422)
      res.end(
        JSON.stringify({ error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient funds.' } }),
      )
      return
    }
    res.end(
      JSON.stringify({
        id: 'transfer-fixture',
        sourceAccountId: transfer.sourceAccountId,
        destination: {
          kind: 'EXTERNAL_ACCOUNT',
          recipientSnapshot: {
            name: `${owner} recipient`,
            bankName: 'Fixture Bank',
            accountNumber: '9876543210',
          },
        },
        amountMinor: transfer.amountMinor,
        currency: transfer.currency,
        reference: transfer.reference,
        status: 'COMPLETED',
        createdAt: '2026-09-06T10:00:00.000Z',
        completedAt: '2026-09-06T10:00:00.000Z',
      }),
    )
  } else if (url.pathname === '/bank/v1/transactions')
    res.end(
      JSON.stringify({
        data: [
          {
            id: 'tx-ssr',
            accountId: 'account-1',
            direction: 'CREDIT',
            type: 'TRANSFER',
            amountMinor: 50000,
            currency: 'USD',
            status: 'COMPLETED',
            description: `${owner} SSR payroll`,
            occurredAt: '2026-08-01T00:00:00.000Z',
          },
        ],
        pagination: {
          page: Number(url.searchParams.get('page') || 1),
          pageSize: Number(url.searchParams.get('pageSize') || 20),
          totalItems: 1,
          totalPages: 1,
        },
      }),
    )
  else {
    res.writeHead(404)
    res.end('{}')
  }
})
backend.listen(0, '127.0.0.1')
await once(backend, 'listening')
const backendUrl = `http://127.0.0.1:${backend.address().port}/bank/v1`
const children = []
async function start(extraEnv) {
  const listener = createServer()
  listener.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = listener.address().port
  await new Promise((resolve) => listener.close(resolve))
  const child = spawn(process.execPath, ['.output/server/index.mjs'], {
    env: { ...process.env, NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port), ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.push(child)
  let logs = ''
  child.stderr.on('data', (chunk) => {
    logs += chunk
  })
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Server timeout: ${logs}`)), 20000)
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`Server exited ${code}: ${logs}`))
    })
    child.stdout.on('data', (chunk) => {
      logs += chunk
      const match = logs.match(/http:\/\/127\.0\.0\.1:\d+/)
      if (match) {
        clearTimeout(timer)
        resolve(match[0])
      }
    })
  })
  return { url, logs: () => logs }
}
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
  await Promise.all(
    children.map(async (child) => {
      child.kill('SIGTERM')
      if (child.exitCode === null) await once(child, 'exit')
    }),
  )
  backend.closeAllConnections()
  await new Promise((resolve) => backend.close(resolve))
}
