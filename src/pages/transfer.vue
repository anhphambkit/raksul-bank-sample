<script setup lang="ts">
definePageMeta({ title: 'Transfer' })
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useAccounts } from '@/features/accounts/composables/useAccounts'
import { useBeneficiaries } from '@/features/transfers/composables/useBeneficiaries'
import { useTransfer } from '@/features/transfers/composables/useTransfer'
import TransferDetailsForm from '@/features/transfers/components/TransferDetailsForm.vue'
import TransferReview from '@/features/transfers/components/TransferReview.vue'
import TransferReceipt from '@/features/transfers/components/TransferReceipt.vue'
import {
  clearRecovery,
  readRecovery,
  recoveryKey,
  saveDetails,
  saveReview,
} from '@/features/transfers/transferRecovery'
import { BANKING_RESET_EVENT, DEMO_RESET_KEY } from '@/data/sync/bankingChanges'
import { useBankingContext } from '@/data/api/bankingContext'
import type { TransferDetails } from '@/features/transfers/transferDraft'
import type { TransferDraft } from '@/features/transfers/transferDraft'
import type { TransferReceipt as Receipt } from '@/contracts/transfers'
import { transferFailure } from '@/features/transfers/transferFailure'
import DataState from '@/shared/components/DataState.vue'
const { mocksEnabled } = useBankingContext()
const storageError = ref('')
const recovered = ref(false)
const uncertain = ref(false)
const detailsDraft = ref<TransferDetails>()
const detailsVersion = ref(0)
let storageKey = ''
let resetGeneration = ''
const accounts = useAccounts()
const beneficiaries = useBeneficiaries()
const mutation = useTransfer()
const draft = ref<TransferDraft>()
const receipt = ref<Receipt>()
const stage = ref<'DETAILS' | 'REVIEW' | 'COMPLETE'>('DETAILS')
const failure = computed(() =>
  mutation.error.value
    ? transferFailure(mutation.error.value)
    : uncertain.value && !mutation.isPending.value
      ? {
          uncertain: true,
          message:
            'A previous confirmation may have completed. Retry the same transfer to retrieve its outcome without sending twice.',
        }
      : undefined,
)
const heading = ref<HTMLElement>()
let submitting = false
const waitingToConfirm = ref(false)
function retry() {
  void accounts.refetch()
  void beneficiaries.refetch()
}
async function focusStage() {
  await nextTick()
  heading.value?.focus()
}
function persist(action: () => void) {
  try {
    if (!storageKey) throw new Error('Transfer recovery storage is not ready.')
    if (mocksEnabled && (localStorage.getItem(DEMO_RESET_KEY) ?? '') !== resetGeneration)
      throw new Error('Demo data was reset in another tab. Reload before making a transfer.')
    action()
    storageError.value = ''
    return true
  } catch (error) {
    storageError.value =
      error instanceof Error
        ? error.message
        : 'Transfer recovery could not be saved. Nothing new was submitted.'
    return false
  }
}
function changed(value: TransferDetails) {
  detailsDraft.value = value
  persist(() => saveDetails(storageKey, value))
}
onMounted(() => {
  const stop = watch(
    () => accounts.data.value,
    (items) => {
      const owner = items?.[0]?.ownerId
      if (!owner || storageKey) return
      storageKey = recoveryKey(owner, mocksEnabled)
      try {
        resetGeneration = localStorage.getItem(DEMO_RESET_KEY) ?? ''
      } catch {
        storageError.value = 'Transfer recovery storage is unavailable.'
        return
      }
      persist(() => {
        const saved = readRecovery(storageKey)
        if (!saved) return
        recovered.value = true
        if (saved.stage === 'DETAILS') detailsDraft.value = saved.details
        else {
          draft.value = saved.draft
          stage.value = 'REVIEW'
          uncertain.value = saved.submitted
        }
      })
    },
    { immediate: true },
  )
  stopRecoveryWatch = stop
})
let stopRecoveryWatch: (() => void) | undefined
onBeforeUnmount(() => stopRecoveryWatch?.())
function review(value: TransferDraft) {
  if (!persist(() => saveReview(storageKey, value, false))) return
  uncertain.value = false
  draft.value = value
  mutation.reset()
  stage.value = 'REVIEW'
  void focusStage()
}
function back() {
  if (submitting || waitingToConfirm.value || failure.value?.uncertain) return
  if (!persist(() => clearRecovery(storageKey, draft.value?.request.idempotencyKey))) return
  detailsDraft.value = draft.value?.details
  if (detailsDraft.value) persist(() => saveDetails(storageKey, detailsDraft.value!))
  mutation.reset()
  stage.value = 'DETAILS'
  void focusStage()
}
function another() {
  if (!persist(() => clearRecovery(storageKey, draft.value?.request.idempotencyKey))) return
  detailsDraft.value = undefined
  recovered.value = false
  uncertain.value = false
  draft.value = undefined
  receipt.value = undefined
  mutation.reset()
  stage.value = 'DETAILS'
  void focusStage()
}
async function confirm() {
  if (waitingToConfirm.value || submitting || stage.value !== 'REVIEW') return
  waitingToConfirm.value = true
  try {
    if (navigator.locks)
      await navigator.locks.request(
        'raksul-transfer-confirm',
        { mode: 'exclusive' },
        performConfirm,
      )
    else await performConfirm()
  } finally {
    waitingToConfirm.value = false
  }
}
async function performConfirm() {
  if (submitting || stage.value !== 'REVIEW' || !draft.value) return
  if (!persist(() => saveReview(storageKey, draft.value!, true))) return
  uncertain.value = true
  submitting = true
  try {
    const request = draft.value.request
    const result = await mutation.mutateAsync(request)
    if (draft.value?.request.idempotencyKey !== request.idempotencyKey) return
    receipt.value = result
    persist(() => clearRecovery(storageKey, draft.value?.request.idempotencyKey))
    uncertain.value = false
    stage.value = 'COMPLETE'
    void focusStage()
  } catch {
    if (draft.value && mutation.error.value && !transferFailure(mutation.error.value).uncertain) {
      uncertain.value = false
      persist(() => saveReview(storageKey, draft.value!, false))
    }
  } finally {
    submitting = false
  }
}
function preventUncertainLeave(event: BeforeUnloadEvent) {
  if (submitting || waitingToConfirm.value || failure.value?.uncertain) {
    event.preventDefault()
    event.returnValue = ''
  }
}
function resetDraft() {
  detailsVersion.value++
  try {
    resetGeneration = localStorage.getItem(DEMO_RESET_KEY) ?? ''
  } catch {
    /* Confirmation will remain blocked by storage checks. */
  }
  draft.value = undefined
  detailsDraft.value = undefined
  receipt.value = undefined
  recovered.value = false
  uncertain.value = false
  storageError.value = ''
  mutation.reset()
  stage.value = 'DETAILS'
}
onMounted(() => {
  window.addEventListener('beforeunload', preventUncertainLeave)
  window.addEventListener(BANKING_RESET_EVENT, resetDraft)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', preventUncertainLeave)
  window.removeEventListener(BANKING_RESET_EVENT, resetDraft)
})
onBeforeRouteLeave(() => !(submitting || waitingToConfirm.value || failure.value?.uncertain))
</script>
<template>
  <section aria-labelledby="transfer-title" class="space-y-8 py-2 sm:py-3">
    <header>
      <p class="mb-2 text-xs font-semibold tracking-widest text-primary">MOVE MONEY</p>
      <h1
        id="transfer-title"
        ref="heading"
        tabindex="-1"
        class="text-3xl font-semibold tracking-tight text-highlighted focus:outline-none"
      >
        {{ stage === 'COMPLETE' ? 'All done' : 'Make a transfer' }}
      </h1>
      <p class="mt-2 text-muted">
        Between your accounts or to someone else, in a few simple steps.
      </p>
    </header>
    <p v-if="storageError" role="alert" class="text-error">{{ storageError }}</p>
    <p v-if="recovered" role="status" class="text-sm text-muted">
      Your saved transfer has been restored. Check the details before continuing.
    </p>
    <ol aria-label="Transfer progress" class="flex flex-wrap gap-6 text-sm">
      <li
        v-for="(item, index) in ['DETAILS', 'REVIEW', 'COMPLETE']"
        :key="item"
        :aria-current="stage === item ? 'step' : undefined"
        :class="stage === item ? 'font-semibold text-primary' : 'text-muted'"
      >
        {{ index + 1 }}. {{ ['Details', 'Review', 'Complete'][index] }}
      </li>
    </ol>
    <div class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div class="bank-surface min-w-0 rounded-2xl border border-default bg-default p-5 sm:p-8">
        <TransferReceipt
          v-if="stage === 'COMPLETE' && receipt && draft"
          :receipt="receipt"
          :recipient="
            receipt.destination.kind === 'OWN_ACCOUNT'
              ? draft.recipient
              : receipt.destination.recipientSnapshot
          "
          @another="another"
        />
        <TransferReview
          v-else-if="stage === 'REVIEW' && draft"
          :draft="draft"
          :pending="mutation.isPending.value || waitingToConfirm"
          :failure="failure"
          @back="back"
          @confirm="confirm"
        />
        <DataState
          v-else
          :loading="
            !accounts.isError.value &&
            !beneficiaries.isError.value &&
            (!accounts.data.value || !beneficiaries.data.value)
          "
          :error="accounts.error.value || beneficiaries.error.value"
          :empty="accounts.data.value?.length === 0"
          label="transfer details"
          empty-message="An active account is needed to make a transfer."
          @retry="retry"
        >
          <TransferDetailsForm
            v-if="accounts.data.value && beneficiaries.data.value"
            :key="detailsVersion"
            :accounts="accounts.data.value"
            :beneficiaries="beneficiaries.data.value"
            :initial="detailsDraft ?? draft?.details"
            @change="changed"
            @review="review"
          />
        </DataState>
      </div>
      <aside class="rounded-2xl border border-default bg-elevated p-6">
        <h2 class="font-semibold text-highlighted">A little peace of mind</h2>
        <p class="mt-3 text-sm leading-6 text-muted">
          Check the recipient and amount on the review screen. Your available balance is checked
          again when you confirm.
        </p>
        <p class="mt-4 text-sm leading-6 text-muted">
          All transfers use USD. Frozen accounts cannot send or receive money.
        </p>
      </aside>
    </div>
  </section>
</template>
