import { fileURLToPath, URL } from 'node:url'
import ui from '@nuxt/ui/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    vue(),
    ui({
      autoImport: false,
      components: false,
      colorMode: false,
      ui: { colors: { primary: 'blue', neutral: 'slate' } },
      icon: { clientBundle: { scan: true } },
    }),
  ],
  resolve: {
    alias: {
      '#app': fileURLToPath(new URL('./src/tests/nuxtAppStub.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
