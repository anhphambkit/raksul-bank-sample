<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import AddRecipientForm from './AddRecipientForm.vue'
import UForm from '@nuxt/ui/components/Form.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import type { Account } from '@/domain/accounts/account'
import type { Beneficiary } from '@/domain/beneficiaries/beneficiary'
import { maskAccountNumber } from '@/domain/accounts/maskAccountNumber'
import MoneyInput from '@/shared/components/MoneyInput.vue'
import MoneyDisplay from '@/shared/components/MoneyDisplay.vue'
import {
  prepareTransfer,
  transferDetailsSchema,
  type TransferDetails,
  type TransferDraft,
} from '../transferDraft'
const props = defineProps<{
  accounts: Account[]
  beneficiaries: Beneficiary[]
  initial?: TransferDetails
}>()
const emit = defineEmits<{ review: [draft: TransferDraft]; change: [details: TransferDetails] }>()
const addingRecipient = ref(false)
function recipientSaved(id: string) {
  state.destinationId = id
  addingRecipient.value = false
}
const state = reactive<TransferDetails>(
  props.initial
    ? { ...props.initial }
    : {
        sourceAccountId: '',
        recipientType: 'OWN_ACCOUNT',
        destinationId: '',
        amount: '',
        reference: '',
      },
)
watch(state, () => emit('change', { ...state }), { flush: 'sync' })
const schema = computed(() => transferDetailsSchema(props.accounts, props.beneficiaries))
const source = computed(() =>
  props.accounts.find((account) => account.id === state.sourceAccountId),
)
const sources = computed(() =>
  props.accounts.map((account) => ({
    label: `${account.displayName} · ${maskAccountNumber(account.accountNumber)}${account.status === 'FROZEN' ? ' · Frozen' : ''}`,
    value: account.id,
    disabled: account.status !== 'ACTIVE',
  })),
)
const destinations = computed(() =>
  state.recipientType === 'OWN_ACCOUNT'
    ? props.accounts
        .filter(
          (account) =>
            account.id !== source.value?.id &&
            account.status === 'ACTIVE' &&
            account.currency === source.value?.currency,
        )
        .map((account) => ({
          label: `${account.displayName} · ${maskAccountNumber(account.accountNumber)}`,
          value: account.id,
        }))
    : props.beneficiaries
        .filter((item) => item.currency === source.value?.currency)
        .map((item) => ({
          label: `${item.displayName} · ${item.bankName} · ${maskAccountNumber(item.accountNumber)}`,
          value: item.id,
        })),
)
watch(
  () => [state.sourceAccountId, state.recipientType],
  () => {
    state.destinationId = ''
  },
)
function review() {
  emit('review', prepareTransfer({ ...state }, props.accounts, props.beneficiaries))
}
async function focusError(event: { errors: { id?: string }[] }) {
  await nextTick()
  const id = event.errors[0]?.id
  if (id) document.getElementById(id)?.focus()
}
</script>
<template>
  <UForm
    :loading-auto="false"
    :schema="schema"
    :state="state"
    class="space-y-7"
    @submit="review"
    @error="focusError"
  >
    <UFormField label="From account" name="sourceAccountId" required>
      <USelect
        v-model="state.sourceAccountId"
        :items="sources"
        placeholder="Choose an account"
        class="w-full"
        size="lg"
      />
      <p v-if="source" class="mt-3 text-sm text-muted">
        Available balance
        <MoneyDisplay
          :amount-minor="source.balanceMinor"
          class="ml-1 font-semibold text-highlighted"
        />
        <span class="text-xs">USD</span>
      </p>
    </UFormField>
    <UFormField label="Transfer to" name="recipientType">
      <URadioGroup
        v-model="state.recipientType"
        :items="[
          { label: 'My accounts', value: 'OWN_ACCOUNT' },
          { label: 'Someone else', value: 'BENEFICIARY' },
        ]"
        orientation="horizontal"
        variant="card"
        class="w-full"
      />
    </UFormField>
    <UFormField
      :label="state.recipientType === 'OWN_ACCOUNT' ? 'To account' : 'Recipient'"
      name="destinationId"
      required
    >
      <USelect
        v-model="state.destinationId"
        :items="destinations"
        :disabled="!source"
        placeholder="Choose a recipient"
        class="w-full"
        size="lg"
      />
      <p v-if="source && destinations.length === 0" class="mt-2 text-sm text-muted">
        No eligible recipients are available for this account.
      </p>
    </UFormField>
    <UButton v-if="state.recipientType === 'BENEFICIARY'" @click="addingRecipient = true">
      Add recipient
    </UButton>
    <div class="grid gap-6 sm:grid-cols-2">
      <UFormField label="Amount" name="amount" required>
        <MoneyInput v-model="state.amount" />
      </UFormField>
      <UFormField label="Reference" name="reference" hint="Optional">
        <UInput
          v-model="state.reference"
          placeholder="What's this for?"
          :maxlength="140"
          class="w-full"
        />
      </UFormField>
    </div>
    <div
      class="flex flex-col gap-4 border-t border-default pt-6 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-sm text-muted">You'll review the details before sending.</p>
      <UButton
        type="submit"
        size="lg"
        class="justify-center"
        trailing-icon="i-lucide-arrow-right"
        :disabled="!accounts.some((account) => account.status === 'ACTIVE')"
      >
        Review transfer
      </UButton>
    </div>
  </UForm>
  <UModal
    v-model:open="addingRecipient"
    title="New recipient"
    description="Save recipient details before making a transfer."
  >
    <template #body>
      <AddRecipientForm
        v-if="addingRecipient"
        @saved="recipientSaved"
        @cancel="addingRecipient = false"
      />
    </template>
  </UModal>
</template>
