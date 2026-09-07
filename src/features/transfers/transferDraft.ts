import { z } from 'zod'
import type { Account } from '@/domain/accounts/account'
import type { Beneficiary } from '@/domain/beneficiaries/beneficiary'
import type { TransferRequest } from '@/contracts/transfers'
import { assertAmountMinor, decimalToMinor } from '@/domain/money/money'

export interface TransferDetails {
  sourceAccountId: string
  recipientType: 'OWN_ACCOUNT' | 'BENEFICIARY'
  destinationId: string
  recipientNetwork: 'SAME_BANK' | 'OTHER_BANK'
  recipientAccountId: string
  recipientName: string
  bankName: string
  amount: string
  reference: string
}
export interface TransferDraft {
  request: TransferRequest
  details: TransferDetails
  source: Account
  recipient: { name: string; bankName: string; accountNumber: string }
}
export function transferDetailsSchema(accounts: Account[], beneficiaries: Beneficiary[]) {
  return z
    .object({
      sourceAccountId: z.string().min(1, 'Choose a source account.'),
      recipientType: z.enum(['OWN_ACCOUNT', 'BENEFICIARY']),
      destinationId: z.string(),
      recipientNetwork: z.enum(['SAME_BANK', 'OTHER_BANK']),
      recipientAccountId: z.string(),
      recipientName: z.string().max(80, 'Use 80 characters or fewer.'),
      bankName: z.string().max(80, 'Use 80 characters or fewer.'),
      amount: z.string().min(1, 'Enter an amount.'),
      reference: z.string().max(140, 'Use 140 characters or fewer.'),
    })
    .superRefine((details, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message })
      const source = accounts.find((account) => account.id === details.sourceAccountId)
      if (!source || source.status !== 'ACTIVE')
        issue('sourceAccountId', 'Choose an active account.')
      if (details.recipientType === 'OWN_ACCOUNT') {
        const target = accounts.find((account) => account.id === details.destinationId)
        if (
          !target ||
          target.status !== 'ACTIVE' ||
          target.id === source?.id ||
          target.currency !== source?.currency
        )
          issue('destinationId', 'Choose a different active account in the same currency.')
      } else {
        const accountIdIsValid = /^\d{8,20}$/.test(details.recipientAccountId.trim())
        if (!accountIdIsValid) issue('recipientAccountId', 'Enter an Account ID with 8–20 digits.')
        if (details.recipientNetwork === 'OTHER_BANK') {
          if (!details.bankName.trim()) issue('bankName', 'Choose a bank.')
          if (!details.recipientName.trim())
            issue('recipientName', 'Enter the account holder name.')
        }
        const target = beneficiaries.find((item) => item.id === details.destinationId)
        if (
          accountIdIsValid &&
          details.recipientNetwork === 'SAME_BANK' &&
          (!target || !target.internalAccountId || target.currency !== source?.currency)
        )
          issue('recipientAccountId', 'Check the Account ID before continuing.')
      }
      if (details.amount) {
        try {
          const amount = decimalToMinor(details.amount)
          assertAmountMinor(amount)
          if (source && amount > source.balanceMinor)
            issue('amount', 'This amount exceeds your available balance.')
        } catch {
          issue('amount', 'Enter an amount above 0 with up to 2 decimal places.')
        }
      }
    })
}
export function prepareTransfer(
  details: TransferDetails,
  accounts: Account[],
  beneficiaries: Beneficiary[],
): TransferDraft {
  const valid = transferDetailsSchema(accounts, beneficiaries).parse(details)
  const source = accounts.find((account) => account.id === valid.sourceAccountId)!
  const target = accounts.find((account) => account.id === valid.destinationId)
  const beneficiary = beneficiaries.find((item) => item.id === valid.destinationId)
  return {
    details: { ...valid },
    source: { ...source },
    recipient:
      valid.recipientType === 'OWN_ACCOUNT'
        ? {
            name: target!.displayName,
            bankName: 'Raksul-bank',
            accountNumber: target!.accountNumber,
          }
        : {
            name: beneficiary!.displayName,
            bankName: beneficiary!.bankName,
            accountNumber: beneficiary!.accountNumber,
          },
    request: {
      idempotencyKey: crypto.randomUUID(),
      sourceAccountId: source.id,
      destination:
        valid.recipientType === 'OWN_ACCOUNT'
          ? { kind: 'OWN_ACCOUNT', accountId: valid.destinationId }
          : { kind: 'BENEFICIARY', beneficiaryId: valid.destinationId },
      amountMinor: decimalToMinor(valid.amount),
      currency: source.currency,
      ...(valid.reference.trim() ? { reference: valid.reference.trim() } : {}),
    },
  }
}
