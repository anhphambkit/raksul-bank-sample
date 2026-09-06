import type { CurrencyCode } from '../domain/money/currency'
import type { Transfer } from '../domain/transfers/transfer'

export interface TransferRequest {
  idempotencyKey: string
  sourceAccountId: string
  destination:
    { kind: 'OWN_ACCOUNT'; accountId: string } | { kind: 'BENEFICIARY'; beneficiaryId: string }
  amountMinor: number
  currency: CurrencyCode
  reference?: string
}

export type TransferReceipt = Omit<Transfer, 'idempotencyKey' | 'requestHash'>
