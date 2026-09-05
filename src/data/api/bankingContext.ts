import { inject, type InjectionKey, type Ref } from 'vue'
import type { createBankingApi } from './bankingApi'

export interface BankingContext {
  api: ReturnType<typeof createBankingApi>
  ready: Ref<boolean>
  mocksEnabled: boolean
}

export const bankingContextKey: InjectionKey<BankingContext> = Symbol('banking')

export function useBankingContext() {
  const context = inject(bankingContextKey)
  if (!context) throw new Error('Banking plugin is required.')
  return context
}
