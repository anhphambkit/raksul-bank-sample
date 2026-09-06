import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { useBankingContext } from '@/data/api/bankingContext'
import { bankingQueryKeys } from '@/data/api/bankingQueryKeys'
import type { TransferRequest } from '@/contracts/transfers'

export function useTransfer() {
  const { api } = useBankingContext()
  const client = useQueryClient()
  return useMutation({
    mutationFn: (request: TransferRequest) => api.executeTransfer(request),
    retry: false,
    onSuccess: async () => {
      await client.cancelQueries({ queryKey: bankingQueryKeys.all })
      await client.invalidateQueries({ queryKey: bankingQueryKeys.all })
    },
  })
}
