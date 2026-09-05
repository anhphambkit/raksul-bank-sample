import type { Account } from '../../domain/accounts/account'
import type { Beneficiary } from '../../domain/beneficiaries/beneficiary'
import type { Customer } from '../../domain/customers/customer'
import type { Transaction } from '../../domain/transactions/transaction'
import type { Transfer } from '../../domain/transfers/transfer'

export interface PersistedBankingState {
  schemaVersion: 1
  customer: Customer
  accounts: Account[]
  transactions: Transaction[]
  transfers: Transfer[]
  beneficiaries: Beneficiary[]
}

/** Privileged application boundary: snapshots include other owners' internal accounts.
 * Never return a complete snapshot from customer-facing HTTP handlers.
 */
export interface BankingRepository {
  load(): Promise<PersistedBankingState>
  /** Read, validate and update in one transaction. The callback must be synchronous,
   * use the supplied current snapshot, and perform no network/storage side effects.
   * Resolve only after commit; thrown errors abort the entire update.
   */
  update(
    change: (current: PersistedBankingState) => PersistedBankingState,
  ): Promise<PersistedBankingState>
  reset(): Promise<PersistedBankingState>
}

export class RepositoryError extends Error {
  constructor(
    readonly code:
      | 'STORAGE_OPEN_FAILED'
      | 'STORAGE_BLOCKED'
      | 'STORAGE_READ_FAILED'
      | 'STORAGE_WRITE_FAILED'
      | 'INVALID_STATE',
    message: string,
  ) {
    super(message)
    this.name = 'RepositoryError'
  }
}
