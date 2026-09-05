import { afterEach, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
vi.stubGlobal('definePageMeta', () => {})
enableAutoUnmount(afterEach)
