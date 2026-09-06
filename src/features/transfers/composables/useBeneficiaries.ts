import { onServerPrefetch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { useBankingContext } from '@/data/api/bankingContext'
export function useBeneficiaries() {
  const { api, ready } = useBankingContext()
  const result = useQuery({
    queryKey: ['bank', 'beneficiaries'],
    enabled: ready,
    queryFn: ({ signal }) => api.beneficiaries(signal),
  })
  onServerPrefetch(async () => {
    if (ready.value) await result.suspense().catch(() => {})
  })
  return result
}
