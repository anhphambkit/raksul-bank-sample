import {
  defineEventHandler,
  getRequestURL,
  proxyRequest,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import { useRuntimeConfig } from '#imports'
import { readEnv } from '../../src/app/config/env'

/** Same-origin backend boundary; the upstream URL is private runtime configuration. */
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  if (readEnv(config.public).mocksEnabled) {
    setResponseStatus(event, 503)
    return {
      error: {
        code: 'DEMO_BROWSER_ONLY',
        message: 'Demo data needs browser storage. Reload the page and try again.',
      },
    }
  }
  const request = getRequestURL(event)
  // Demo maintenance is never forwarded to a real banking backend.
  if (request.pathname.startsWith('/api/demo/')) {
    setResponseStatus(event, 404)
    return {
      error: { code: 'NOT_FOUND', message: 'This endpoint is available in demo mode only.' },
    }
  }
  if (!config.apiBaseUrl) {
    setResponseStatus(event, 503)
    return {
      error: { code: 'API_NOT_CONFIGURED', message: 'The banking service is not configured.' },
    }
  }
  const base = new URL(config.apiBaseUrl)
  if (!['http:', 'https:'].includes(base.protocol) || base.search || base.hash) {
    throw new Error('NUXT_API_BASE_URL must be an HTTP(S) URL without query or hash.')
  }
  const target = `${base.href.replace(/\/$/, '')}/${request.pathname.slice('/api/'.length)}${request.search}`
  return proxyRequest(event, target, {
    fetchOptions: { signal: AbortSignal.timeout(15_000) },
    onResponse(event) {
      setResponseHeader(event, 'cache-control', 'private, no-store')
    },
  })
})
