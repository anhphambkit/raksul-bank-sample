import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-06',
  srcDir: 'src/',
  ssr: true,
  modules: ['@nuxt/ui'],
  css: ['~/shared/styles/main.css'],
  devtools: { enabled: false },
  ui: { colorMode: false, fonts: false },
  icon: { clientBundle: { scan: true } },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Raksul-bank',
      meta: [
        { name: 'description', content: 'A personal banking dashboard with fictional demo data.' },
      ],
    },
  },
  runtimeConfig: {
    apiBaseUrl: '',
    public: { enableMocks: 'true' },
  },
  routeRules: { '/**': { headers: { 'cache-control': 'private, no-store' } } },
  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true,
      },
    },
  },
})
