import { lookupRecipient } from '../../../use-cases/beneficiaries/lookupRecipient'
import { createBeneficiary } from '../../../use-cases/beneficiaries/createBeneficiary'
import { beneficiaryRequestSchema } from '../../api/beneficiaryRequestSchema'
import { DomainError } from '../../../domain/errors'
import type { Transfer } from '../../../domain/transfers/transfer'
import {
  executeTransfer,
  getTransfer,
  TransferError,
} from '../../../use-cases/transfers/executeTransfer'
import { transferRequestSchema } from '../../api/transferRequestSchema'
import { http, HttpResponse } from 'msw'
import { createBankingQueries, QueryError } from '../../../use-cases/queries'
import { RepositoryError, type BankingRepository } from '../../../use-cases/ports/BankingRepository'
import { transactionQuerySchema } from '../../api/transactionQuerySchema'

function failure(status: number, code: string, message: string) {
  return HttpResponse.json({ error: { code, message } }, { status })
}

async function respond(action: () => Promise<unknown>) {
  try {
    const result = await action()
    return result === undefined
      ? new HttpResponse(null, { status: 204 })
      : HttpResponse.json(result)
  } catch (error) {
    if (error instanceof DomainError) return failure(422, error.code, error.message)
    if (error instanceof TransferError)
      return failure(
        error.code === 'IDEMPOTENCY_CONFLICT'
          ? 409
          : error.code === 'TRANSFER_NOT_FOUND'
            ? 404
            : 400,
        error.code,
        error.message,
      )
    if (error instanceof QueryError) return failure(404, error.code, error.message)
    if (error instanceof RepositoryError)
      return failure(
        503,
        'STORAGE_UNAVAILABLE',
        'Demo storage is unavailable. Close older tabs if necessary and try again.',
      )
    return failure(500, 'INTERNAL_ERROR', 'The request could not be completed. Please try again.')
  }
}

export function createBankingHandlers(repository: BankingRepository) {
  const queries = createBankingQueries(repository)
  const receipt = (transfer: Transfer) => {
    const { idempotencyKey: _key, requestHash: _hash, ...result } = transfer
    void _key
    void _hash
    return result
  }
  return [
    http.get('*/api/recipient-accounts/:accountNumber', ({ params }) =>
      respond(() => lookupRecipient(repository, String(params.accountNumber))),
    ),
    http.post('*/api/beneficiaries', async ({ request }) => {
      const parsed = beneficiaryRequestSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success)
        return failure(
          400,
          'INVALID_RECIPIENT',
          'Check the recipient name, bank and account number.',
        )
      return respond(() => createBeneficiary(repository, parsed.data))
    }),
    http.post('*/api/transfers', async ({ request }) => {
      const parsed = transferRequestSchema.safeParse(await request.json().catch(() => null))
      if (!parsed.success)
        return failure(400, 'INVALID_REQUEST', 'Check the transfer details and amount.')
      return respond(async () => receipt(await executeTransfer(repository, parsed.data)))
    }),
    http.get('*/api/transfers/:transferId', ({ params }) =>
      respond(async () => receipt(await getTransfer(repository, String(params.transferId)))),
    ),
    http.get('*/api/customer', () => respond(queries.customer)),
    http.get('*/api/accounts', () => respond(queries.accounts)),
    http.get('*/api/accounts/:accountId', ({ params }) =>
      respond(() => queries.account(String(params.accountId))),
    ),
    http.get('*/api/beneficiaries', () => respond(queries.beneficiaries)),
    http.post('*/api/demo/reset', () => respond(queries.reset)),
    http.get('*/api/transactions', ({ request }) => {
      const params = new URL(request.url).searchParams
      const parsed = transactionQuerySchema.safeParse(Object.fromEntries(params))
      if ([...params.keys()].some((key) => params.getAll(key).length > 1) || !parsed.success) {
        return failure(
          400,
          'INVALID_QUERY',
          'Check the transaction filters, date range and pagination.',
        )
      }
      return respond(() => queries.transactions(parsed.data))
    }),
  ]
}
