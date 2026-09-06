import process from 'node:process'
import { Buffer } from 'node:buffer'
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

export async function createTestEnvironment() {
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
    if (/customer=(?:error|storage-error)/.test(req.headers.cookie ?? '')) {
      res.writeHead(503)
      res.end(
        JSON.stringify({
          error: {
            code: req.headers.cookie?.includes('customer=storage-error')
              ? 'STORAGE_UNAVAILABLE'
              : 'SERVICE_UNAVAILABLE',
            message: 'Fixture unavailable',
          },
        }),
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
      child.once('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
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
  return {
    requests,
    backendUrl,
    start,
    close: async () => {
      await Promise.all(
        children.map(async (child) => {
          if (child.exitCode !== null || child.signalCode !== null) return
          const exited = once(child, 'exit')
          child.kill('SIGTERM')
          const timer = setTimeout(() => child.kill('SIGKILL'), 5_000)
          try {
            await exited
          } finally {
            clearTimeout(timer)
          }
        }),
      )
      backend.closeAllConnections()
      await new Promise((resolve) => backend.close(resolve))
    },
  }
}
