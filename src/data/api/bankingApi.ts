import type { Customer } from '../../domain/customers/customer'
import type { Account } from '../../domain/accounts/account'
import type { Beneficiary } from '../../domain/beneficiaries/beneficiary'
import type {
  PaginatedTransactions,
  TransactionQuery,
} from '../../use-cases/transactions/listTransactions'

export type { PaginatedTransactions, TransactionQuery }

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Typed boundary for the controlled mock API. Abort signals pass through to fetch. */
export type BankingFetch = (
  url: string,
  init: { method: string; signal?: AbortSignal; headers: Record<string, string> },
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

export function createBankingApi(
  baseUrl = '/api/',
  fetcher: BankingFetch = (url, init) => fetch(url, init),
) {
  async function request<T>(path: string, signal?: AbortSignal, method = 'GET'): Promise<T> {
    const response = await fetcher(`${baseUrl.replace(/\/?$/, '/')}${path}`, {
      method,
      signal,
      headers: { Accept: 'application/json' },
    }).catch((error: unknown) => {
      if (signal?.aborted) throw error
      throw new ApiError(
        503,
        'SERVICE_UNAVAILABLE',
        'The banking service is unavailable. Please try again.',
      )
    })
    if (!response.ok) {
      let code = 'REQUEST_FAILED'
      let message = 'The request could not be completed. Please try again.'
      try {
        const body: unknown = await response.json()
        if (
          body &&
          typeof body === 'object' &&
          'error' in body &&
          body.error &&
          typeof body.error === 'object'
        ) {
          if ('code' in body.error && typeof body.error.code === 'string') code = body.error.code
          if ('message' in body.error && typeof body.error.message === 'string')
            message = body.error.message
        }
      } catch {
        /* Keep a safe message for non-JSON failures. */
      }
      throw new ApiError(response.status, code, message)
    }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  }
  return {
    customer: (signal?: AbortSignal) => request<Customer>('customer', signal),
    accounts: (signal?: AbortSignal) => request<Account[]>('accounts', signal),
    account: (id: string, signal?: AbortSignal) =>
      request<Account>(`accounts/${encodeURIComponent(id)}`, signal),
    transactions: (query: Partial<TransactionQuery> = {}, signal?: AbortSignal) => {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(query))
        if (value !== undefined) params.set(key, String(value))
      return request<PaginatedTransactions>(`transactions?${params}`, signal)
    },
    beneficiaries: (signal?: AbortSignal) => request<Beneficiary[]>('beneficiaries', signal),
    reset: (signal?: AbortSignal) => request<void>('demo/reset', signal, 'POST'),
  }
}
