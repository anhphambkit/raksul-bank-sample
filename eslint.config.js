import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import skipFormatting from 'eslint-config-prettier'

const testImports = {
  regex: '(^|/)(tests|vitest|fake-indexeddb)(/|$)|^@vue/test-utils(/|$)|\\.(test|spec)\\.',
  message: 'Test helpers and suites belong in src/tests, outside runtime code.',
}

export default defineConfigWithVueTs(
  {
    ignores: [
      'dist/**',
      '.nuxt/**',
      '.output/**',
      'coverage/**',
      '.tools/**',
      'public/mockServiceWorker.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        URL: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        console: 'readonly',
      },
    },
  },
  {
    files: ['src/pages/*.vue', 'src/app.config.ts'],
    languageOptions: {
      globals: {
        definePageMeta: 'readonly',
        defineAppConfig: 'readonly',
        useRequestEvent: 'readonly',
        setResponseStatus: 'readonly',
      },
    },
  },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/tests/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [testImports] }] },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            testImports,
            {
              regex: '^(?!\\.{1,2}/|@/domain/)',
              message: 'Domain code imports only domain modules.',
            },
            {
              regex: '(^|/)(app|use-cases|data|features|pages|shared)(/|$)',
              message: 'Domain rules must not depend on outer layers.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/use-cases/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            testImports,
            {
              regex:
                '(^|/)(app|data|features|pages|shared)(/|$)|^(vue|vue-router|nuxt|h3|nitropack|#app|#imports|msw|@vue|@nuxt|@tanstack)(/|$)',
              message: 'Use cases depend on domain and ports, not Vue or concrete adapters.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/use-cases/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'indexedDB',
        'localStorage',
        'sessionStorage',
        'fetch',
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression',
          message: 'Keep domain/use-cases dependencies explicit with static imports.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.vue', 'src/features/**/*.ts', 'src/shared/**/*.ts'],
    ignores: ['src/tests/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            testImports,
            {
              regex: '(^|/)use-cases(/|$)|(^|/)data/(repositories|seed|mock)(/|$)',
              message:
                'UI calls the API boundary; it must not import use cases, repositories or seed data.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/pages/*.vue', 'src/layouts/*.vue'],
    rules: { 'vue/multi-word-component-names': 'off' },
  },
  skipFormatting,
)
