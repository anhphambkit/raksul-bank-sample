<script setup lang="ts">
definePageMeta({ title: 'Transfer' })
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useAccounts } from '@/features/accounts/composables/useAccounts'
import { useBeneficiaries } from '@/features/transfers/composables/useBeneficiaries'
import TransferDetailsForm from '@/features/transfers/components/TransferDetailsForm.vue'
import type { TransferDraft } from '@/features/transfers/transferDraft'
import DataState from '@/shared/components/DataState.vue'
import MoneyDisplay from '@/shared/components/MoneyDisplay.vue'
const accounts = useAccounts()
const beneficiaries = useBeneficiaries()
const draft = ref<TransferDraft>()
const editing = ref(true)
function retry() {
  void accounts.refetch()
  void beneficiaries.refetch()
}
function review(value: TransferDraft) {
  draft.value = value
  editing.value = false
}
</script>
<template>
  <section aria-labelledby="transfer-title" class="space-y-8">
    <header>
      <p class="mb-2 text-xs font-semibold tracking-widest text-primary">MOVE MONEY</p>
      <h1 id="transfer-title" class="text-3xl font-semibold tracking-tight text-highlighted">
        Make a transfer
      </h1>
      <p class="mt-2 text-muted">
        Between your accounts or to someone else, in a few simple steps.
      </p>
    </header>
    <ol aria-label="Transfer progress" class="flex flex-wrap gap-6 text-sm">
      <li
        :aria-current="editing ? 'step' : undefined"
        :class="editing ? 'font-semibold text-primary' : 'text-muted'"
      >
        1. Details
      </li>
      <li
        :aria-current="!editing ? 'step' : undefined"
        :class="!editing ? 'font-semibold text-primary' : 'text-muted'"
      >
        2. Review
      </li>
      <li class="text-muted">3. Complete</li>
    </ol>
    <DataState
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
      <div
        v-if="accounts.data.value && beneficiaries.data.value"
        class="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_280px]"
      >
        <div class="bank-surface min-w-0 rounded-2xl border border-default bg-white p-5 sm:p-8">
          <TransferDetailsForm
            v-if="editing"
            :accounts="accounts.data.value"
            :beneficiaries="beneficiaries.data.value"
            :initial="draft?.details"
            @review="review"
          />
          <div v-else-if="draft" class="space-y-5">
            <h2 class="text-xl font-semibold">Transfer details ready</h2>
            <p>
              <MoneyDisplay :amount-minor="draft.request.amountMinor" /> to
              {{ draft.recipient.name }}
            </p>
            <p class="text-muted">
              No money has moved. Confirmation will be available in the next update.
            </p>
            <UButton variant="outline" @click="editing = true">Back to details</UButton>
          </div>
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
    </DataState>
  </section>
</template>
