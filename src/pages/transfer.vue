<script setup lang="ts">
definePageMeta({ title: 'Transfer' })
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { useAccounts } from '@/features/accounts/composables/useAccounts'
import { useBeneficiaries } from '@/features/transfers/composables/useBeneficiaries'
import { useTransfer } from '@/features/transfers/composables/useTransfer'
import TransferDetailsForm from '@/features/transfers/components/TransferDetailsForm.vue'
import TransferReview from '@/features/transfers/components/TransferReview.vue'
import TransferReceipt from '@/features/transfers/components/TransferReceipt.vue'
import type { TransferDraft } from '@/features/transfers/transferDraft'
import type { TransferReceipt as Receipt } from '@/contracts/transfers'
import { transferFailure } from '@/features/transfers/transferFailure'
import DataState from '@/shared/components/DataState.vue'
const accounts = useAccounts()
const beneficiaries = useBeneficiaries()
const mutation = useTransfer()
const draft = ref<TransferDraft>()
const receipt = ref<Receipt>()
const stage = ref<'DETAILS' | 'REVIEW' | 'COMPLETE'>('DETAILS')
const failure = computed(() =>
  mutation.error.value ? transferFailure(mutation.error.value) : undefined,
)
const heading = ref<HTMLElement>()
let submitting = false
function retry() {
  void accounts.refetch()
  void beneficiaries.refetch()
}
async function focusStage() {
  await nextTick()
  heading.value?.focus()
}
function review(value: TransferDraft) {
  draft.value = value
  mutation.reset()
  stage.value = 'REVIEW'
  void focusStage()
}
function back() {
  if (submitting || failure.value?.uncertain) return
  mutation.reset()
  stage.value = 'DETAILS'
  void focusStage()
}
function another() {
  draft.value = undefined
  receipt.value = undefined
  mutation.reset()
  stage.value = 'DETAILS'
  void focusStage()
}
async function confirm() {
  if (submitting || stage.value !== 'REVIEW' || !draft.value) return
  submitting = true
  try {
    receipt.value = await mutation.mutateAsync(draft.value.request)
    stage.value = 'COMPLETE'
    void focusStage()
  } catch {
    /* Keep the immutable request and key for an explicit retry. */
  } finally {
    submitting = false
  }
}
function preventUncertainLeave(event: BeforeUnloadEvent) {
  if (submitting || failure.value?.uncertain) {
    event.preventDefault()
    event.returnValue = ''
  }
}
onMounted(() => window.addEventListener('beforeunload', preventUncertainLeave))
onBeforeUnmount(() => window.removeEventListener('beforeunload', preventUncertainLeave))
onBeforeRouteLeave(() => !(submitting || failure.value?.uncertain))
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
      <div class="bank-surface min-w-0 rounded-2xl border border-default bg-white p-5 sm:p-8">
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
          :pending="mutation.isPending.value"
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
            :accounts="accounts.data.value"
            :beneficiaries="beneficiaries.data.value"
            :initial="draft?.details"
            @review="review"
          />
        </DataState>
      </div>
      <aside class="rounded-2xl border border-default bg-slate-50 p-6">
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
