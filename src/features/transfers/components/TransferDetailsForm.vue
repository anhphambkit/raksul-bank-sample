<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import UForm from '@nuxt/ui/components/Form.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import type { Account } from '@/domain/accounts/account'
import type { Beneficiary } from '@/domain/beneficiaries/beneficiary'
import { maskAccountNumber } from '@/domain/accounts/maskAccountNumber'
import MoneyInput from '@/shared/components/MoneyInput.vue'
import { strictNumericInput } from '@/shared/strictNumericInput'
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
const form = ref<{ clear(path?: string | RegExp): void }>()
const recipientError = ref('')
const checkedRecipient = ref<Beneficiary>()
const banks = [
  { label: 'Vietcombank', value: 'Vietcombank' },
  { label: 'Agribank', value: 'Agribank' },
  { label: 'BIDV', value: 'BIDV' },
  { label: 'VietinBank', value: 'VietinBank' },
  { label: 'Techcombank', value: 'Techcombank' },
  { label: 'MB Bank', value: 'MB Bank' },
  { label: 'ACB', value: 'ACB' },
  { label: 'Sacombank', value: 'Sacombank' },
  { label: 'VPBank', value: 'VPBank' },
  { label: 'TPBank', value: 'TPBank' },
]
const state = reactive<TransferDetails>(
  props.initial
    ? { ...props.initial }
    : {
        sourceAccountId: '',
        recipientType: 'OWN_ACCOUNT',
        destinationId: '',
        recipientNetwork: 'SAME_BANK',
        recipientAccountId: '',
        recipientName: '',
        bankName: '',
        amount: '',
        reference: '',
      },
)

const accountNumberInput = strictNumericInput(/^\d*$/, () => state.recipientAccountId)

const initialRecipient = props.beneficiaries.find((item) => item.id === state.destinationId)
if (state.recipientType === 'BENEFICIARY' && initialRecipient) {
  state.recipientNetwork = initialRecipient.internalAccountId ? 'SAME_BANK' : 'OTHER_BANK'
  state.recipientAccountId ||= initialRecipient.accountNumber
  state.recipientName ||= initialRecipient.displayName
  state.bankName ||= initialRecipient.internalAccountId ? '' : initialRecipient.bankName
  if (initialRecipient.internalAccountId) checkedRecipient.value = initialRecipient
}

watch(state, () => emit('change', { ...state }), { flush: 'sync' })
const schema = computed(() => transferDetailsSchema(props.accounts, props.beneficiaries))
const accountIdReady = computed(() => /^\d{8,20}$/.test(state.recipientAccountId.trim()))
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
const ownDestinations = computed(() =>
  props.accounts
    .filter(
      (account) =>
        account.id !== source.value?.id &&
        account.status === 'ACTIVE' &&
        account.currency === source.value?.currency,
    )
    .map((account) => ({
      label: `${account.displayName} · ${maskAccountNumber(account.accountNumber)}`,
      value: account.id,
    })),
)

watch(
  () => [state.sourceAccountId, state.recipientType],
  () => {
    state.destinationId = ''
    checkedRecipient.value = undefined
    recipientError.value = ''
  },
)
watch(
  () => state.recipientNetwork,
  () => {
    state.destinationId = ''
    state.recipientAccountId = ''
    state.recipientName = ''
    state.bankName = ''
    checkedRecipient.value = undefined
    recipientError.value = ''
  },
)
watch(
  () => state.recipientAccountId,
  () => {
    if (state.recipientNetwork !== 'SAME_BANK') return
    state.destinationId = ''
    state.recipientName = ''
    checkedRecipient.value = undefined
    recipientError.value = ''
  },
)

function checkAccount() {
  const accountId = state.recipientAccountId.trim()
  checkedRecipient.value = undefined
  state.destinationId = ''
  state.recipientName = ''
  recipientError.value = ''
  form.value?.clear(/recipientAccountId|destinationId/)
  if (!/^\d{8,20}$/.test(accountId)) {
    recipientError.value = 'Enter an Account ID with 8–20 digits.'
    return
  }
  const ownAccount = props.accounts.find((item) => item.accountNumber === accountId)
  if (ownAccount) {
    recipientError.value = 'This is one of your accounts. Choose My accounts instead.'
    return
  }
  const recipient = props.beneficiaries.find(
    (item) => item.internalAccountId && item.accountNumber === accountId,
  )
  if (!recipient) {
    recipientError.value = 'We could not find this Raksul-bank account.'
    return
  }
  checkedRecipient.value = recipient
  state.destinationId = recipient.id
  state.recipientName = recipient.displayName
}

function review() {
  recipientError.value = ''
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
    ref="form"
    :loading-auto="false"
    :schema="schema"
    :state="state"
    :validate-on="['blur', 'input']"
    class="space-y-5"
    @submit="review"
    @error="focusError"
  >
    <div class="grid gap-5 md:grid-cols-2">
      <UFormField label="From account" name="sourceAccountId" required>
        <USelect
          v-model="state.sourceAccountId"
          :items="sources"
          placeholder="Choose an account"
          class="w-full"
          size="lg"
        />
        <p v-if="source" class="mt-2 flex items-baseline gap-1.5 text-sm text-muted">
          <span>Available</span>
          <MoneyDisplay
            :amount-minor="source.balanceMinor"
            class="font-semibold text-highlighted"
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
    </div>

    <UFormField
      v-if="state.recipientType === 'OWN_ACCOUNT'"
      label="To account"
      name="destinationId"
      required
    >
      <USelect
        v-model="state.destinationId"
        :items="ownDestinations"
        :disabled="!source"
        placeholder="Choose an account"
        class="w-full"
        size="lg"
      />
      <p v-if="source && ownDestinations.length === 0" class="mt-2 text-sm text-muted">
        No eligible accounts are available for this transfer.
      </p>
    </UFormField>

    <div
      v-else
      class="space-y-4 rounded-2xl border border-primary/15 bg-primary/[0.025] p-4 sm:p-5"
    >
      <UFormField label="Recipient bank" name="recipientNetwork">
        <URadioGroup
          v-model="state.recipientNetwork"
          :items="[
            { label: 'Same bank', description: 'Raksul-bank account', value: 'SAME_BANK' },
            { label: 'Other bank', description: 'Domestic bank account', value: 'OTHER_BANK' },
          ]"
          orientation="horizontal"
          variant="card"
          class="w-full"
        />
      </UFormField>

      <div :class="state.recipientNetwork === 'OTHER_BANK' ? 'grid gap-4 md:grid-cols-2' : ''">
        <UFormField
          v-if="state.recipientNetwork === 'OTHER_BANK'"
          label="Bank"
          name="bankName"
          required
        >
          <USelect
            v-model="state.bankName"
            :items="banks"
            placeholder="Choose a bank"
            class="w-full"
            size="lg"
          />
        </UFormField>

        <UFormField
          label="Account ID"
          name="recipientAccountId"
          required
          :error="recipientError || undefined"
        >
          <div class="flex flex-col gap-3 sm:flex-row">
            <UInput
              v-model="state.recipientAccountId"
              inputmode="numeric"
              autocomplete="off"
              :maxlength="20"
              placeholder="Enter 8–20 digits"
              class="min-w-0 flex-1"
              size="lg"
              @beforeinput="accountNumberInput.beforeinput"
              @input.capture="accountNumberInput.input"
            />
            <UButton
              v-if="state.recipientNetwork === 'SAME_BANK'"
              type="button"
              color="neutral"
              variant="outline"
              size="lg"
              icon="i-lucide-search"
              class="justify-center"
              :disabled="!accountIdReady"
              @click="checkAccount"
            >
              Check account
            </UButton>
          </div>
        </UFormField>
      </div>

      <div
        v-if="checkedRecipient"
        role="status"
        class="flex items-center gap-3 rounded-xl border border-success/25 bg-success/5 px-4 py-3"
      >
        <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-success/10">
          <UIcon name="i-lucide-badge-check" class="size-5 text-success" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-highlighted">{{ checkedRecipient.displayName }}</p>
          <p class="text-sm text-muted">Verified Raksul-bank account</p>
        </div>
      </div>

      <UFormField
        v-if="state.recipientNetwork === 'OTHER_BANK'"
        label="Account holder name"
        name="recipientName"
        required
      >
        <UInput
          v-model="state.recipientName"
          placeholder="Enter the name on the account"
          :maxlength="80"
          class="w-full"
          size="lg"
        />
      </UFormField>
    </div>

    <div class="grid gap-5 sm:grid-cols-2">
      <UFormField label="Amount" name="amount" required>
        <MoneyInput v-model="state.amount" :show-error="false" />
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
      class="flex flex-col gap-3 border-t border-default pt-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="flex items-center gap-2 text-sm text-muted">
        <UIcon name="i-lucide-shield-check" class="size-4 text-primary" />
        Review before money moves
      </p>
      <UButton type="submit" size="lg" class="justify-center" trailing-icon="i-lucide-arrow-right">
        Review transfer
      </UButton>
    </div>
  </UForm>
</template>
