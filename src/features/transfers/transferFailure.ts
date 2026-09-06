import { ApiError } from '@/data/api/apiError'

export function transferFailure(error: unknown): { uncertain: boolean; message: string } {
  if (error instanceof ApiError && [400, 422].includes(error.status)) {
    return { uncertain: false, message: `${error.message} No money moved for this transfer.` }
  }
  return {
    uncertain: true,
    message:
      "We couldn't confirm whether money moved. Retry this same transfer to check its result safely. Keep this page open and don't start another transfer for the same payment.",
  }
}
