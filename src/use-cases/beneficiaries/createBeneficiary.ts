import type { CreateBeneficiaryRequest } from '../../contracts/beneficiaries'
import { DomainError } from '../../domain/errors'
import type { BankingRepository } from '../ports/BankingRepository'

export async function createBeneficiary(
  repository: BankingRepository,
  input: CreateBeneficiaryRequest,
) {
  const request = {
    ...input,
    displayName: input.displayName.trim(),
    bankName: input.bankName.trim(),
    accountNumber: input.accountNumber.trim(),
  }
  if (
    !request.displayName ||
    request.displayName.length > 80 ||
    !request.bankName ||
    request.bankName.length > 80 ||
    !/^\d{8,20}$/.test(request.accountNumber) ||
    request.currency !== 'USD'
  )
    throw new DomainError('INVALID_RECIPIENT', 'Check the recipient name, bank and account number.')
  let id = `beneficiary-${crypto.randomUUID()}`
  const committed = await repository.update((state) => {
    const target = state.accounts.find((account) => account.accountNumber === request.accountNumber)
    if (
      target &&
      (target.ownerId === state.customer.id ||
        target.status !== 'ACTIVE' ||
        request.bankName.toLowerCase() !== 'raksul-bank')
    )
      throw new DomainError(
        'INVALID_RECIPIENT',
        'Choose an available recipient account and its correct bank. Use My accounts for your own accounts.',
      )
    if (!target && request.bankName.toLowerCase() === 'raksul-bank')
      throw new DomainError(
        'INVALID_RECIPIENT',
        'This Raksul-bank recipient account was not found.',
      )
    const previous = state.beneficiaries.find(
      (item) =>
        item.accountNumber === request.accountNumber &&
        item.bankName.toLowerCase() === request.bankName.toLowerCase(),
    )
    if (previous) {
      id = previous.id
      return state
    }
    state.beneficiaries.push({
      id,
      customerId: state.customer.id,
      ...request,
      ...(target ? { internalAccountId: target.id } : {}),
    })
    return state
  })
  return committed.beneficiaries.find((item) => item.id === id)!
}
