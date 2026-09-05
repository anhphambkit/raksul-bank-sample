import type { TransactionQuery } from './bankingApi'

export const bankingQueryKeys = {
  all: ['bank'] as const,
  accounts: ['bank', 'accounts'] as const,
  transactions: (query: TransactionQuery) => ['bank', 'transactions', query] as const,
  recentTransactions: ['bank', 'transactions', { page: 1, pageSize: 5 }] as const,
}
