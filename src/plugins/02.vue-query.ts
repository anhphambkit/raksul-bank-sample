import { defineNuxtPlugin, useState } from '#app'
import {
  dehydrate,
  hydrate,
  QueryClient,
  VueQueryPlugin,
  type DehydratedState,
} from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxtApp) => {
  const state = useState<DehydratedState | null>('banking-query', () => null)
  const stateTest = useState('banking-query-test', () => ({
    a: 1,
    b: 2,
  }))
  // Never share server state between SSR requests/users.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retryOnMount: false, retry: import.meta.server ? false : 1 },
      mutations: { retry: false },
    },
  })
  nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
  if (import.meta.server) {
    nuxtApp.hook('app:rendered', () => {
      state.value = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => query.state.status !== 'pending',
      })
      queryClient.clear()
    })
  } else {
    console.log(
    'banking-query-test CLIENT VALUE:',
    stateTest.value,
  )
    if (state.value) hydrate(queryClient, state.value)
  }
})
