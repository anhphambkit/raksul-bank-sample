import type { Account } from '../domain/accounts/account'
import type { Beneficiary } from '../domain/beneficiaries/beneficiary'
import type { Customer } from '../domain/customers/customer'
import type { PaginatedTransactions, TransactionQuery } from './transactions'

/** Public client contract; transport and persistence details belong to adapters. */
export interface BankingApi {
  customer(signal?: AbortSignal): Promise<Customer>
  accounts(signal?: AbortSignal): Promise<Account[]>
  account(id: string, signal?: AbortSignal): Promise<Account>
  transactions(
    query?: Partial<TransactionQuery>,
    signal?: AbortSignal,
  ): Promise<PaginatedTransactions>
  beneficiaries(signal?: AbortSignal): Promise<Beneficiary[]>
  reset(signal?: AbortSignal): Promise<void>
}
