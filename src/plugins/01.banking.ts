import { ref } from 'vue'
import { defineNuxtPlugin, useRequestFetch, useRuntimeConfig } from '#app'
import { readEnv } from '@/app/config/env'
import { createBankingApi, type BankingFetch } from '@/data/api/bankingApi'
import { bankingContextKey } from '@/data/api/bankingContext'

export default defineNuxtPlugin((nuxtApp) => {
  const { mocksEnabled } = readEnv(useRuntimeConfig().public)
  // The initial client render must match the server's demo loading state.
  const ready = ref(!mocksEnabled)
  const requestFetch = useRequestFetch()
  const fetcher: BankingFetch = import.meta.server
    ? async (url, init) => {
        try {
          const data = await requestFetch(url, {
            ...init,
            method: init.method as 'GET' | 'POST',
            retry: 0,
            timeout: 15_000,
          })
          return { ok: true, status: data === undefined ? 204 : 200, json: async () => data }
        } catch (error) {
          if (
            error &&
            typeof error === 'object' &&
            'statusCode' in error &&
            typeof error.statusCode === 'number'
          ) {
            return {
              ok: false,
              status: error.statusCode,
              json: async () => ('data' in error ? error.data : undefined),
            }
          }
          throw error
        }
      }
    : (url, init) => fetch(url, { ...init, credentials: 'same-origin' })

  nuxtApp.vueApp.provide(bankingContextKey, {
    api: createBankingApi('/api/', fetcher),
    ready,
    mocksEnabled,
  })

  if (import.meta.client && mocksEnabled) {
    nuxtApp.hook('app:mounted', async () => {
      try {
        const { worker } = await import('@/data/mock/browser')
        await worker.start({
          serviceWorker: { url: '/mockServiceWorker.js' },
          onUnhandledRequest(request, print) {
            if (new URL(request.url).pathname.startsWith('/api/')) print.error()
          },
        })
      } catch (error) {
        console.error('Demo services could not start.', error)
      } finally {
        // On startup failure queries reach Nitro's explicit demo-unavailable error.
        ready.value = true
      }
    })
  }
})
