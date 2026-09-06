<script setup lang="ts">
import { computed, ref, watch, type VNodeChild } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import type { Account } from '@/domain/accounts/account'
import { maskAccountNumber } from '@/domain/accounts/maskAccountNumber'
import { transactionQuerySchema } from '@/data/api/transactionQuerySchema'
import type { TransactionFiltersValue } from '../transactionFilters'

const props = withDefaults(
  defineProps<{
    filters: TransactionFiltersValue
    accounts: Account[]
    busy?: boolean
    idPrefix?: string
  }>(),
  { busy: false, idPrefix: 'transaction' },
)
const emit = defineEmits<{ apply: [filters: TransactionFiltersValue]; clear: [] }>()
const draft = ref({ ...props.filters })
const error = ref('')
interface FilterScope {
  draft: Readonly<TransactionFiltersValue>
  update: (patch: Partial<TransactionFiltersValue>) => void
  busy: boolean
}
interface SelectScope extends FilterScope {
  items: { label: string; value: string }[]
}
defineSlots<{
  search?(props: FilterScope): VNodeChild
  account?(props: SelectScope): VNodeChild
  direction?(props: SelectScope): VNodeChild
  type?(props: SelectScope): VNodeChild
  status?(props: SelectScope): VNodeChild
  dates?(props: FilterScope): VNodeChild
  'extra-fields'?(props: FilterScope): VNodeChild
  actions?(props: FilterScope & { apply: () => void; clear: () => void }): VNodeChild
  error?(props: { message: string }): VNodeChild
}>()
function update(patch: Partial<TransactionFiltersValue>) {
  draft.value = { ...draft.value, ...patch }
}
const fieldScope = computed(() => ({ draft: draft.value, update, busy: props.busy }))
watch(
  () => props.filters,
  (filters) => {
    draft.value = { ...filters }
    error.value = ''
  },
)
const accountItems = computed(() => [
  { label: 'All accounts', value: 'ALL' },
  ...props.accounts.map((account) => ({
    label: `${account.displayName} · ${maskAccountNumber(account.accountNumber)}${account.status === 'FROZEN' ? ' · Frozen' : ''}`,
    value: account.id,
  })),
])
const selectFilters: {
  key: 'direction' | 'type' | 'status'
  label: string
  items: { label: string; value: string }[]
}[] = [
  {
    key: 'direction',
    label: 'Direction',
    items: [
      { label: 'All directions', value: 'ALL' },
      { label: 'Money out', value: 'DEBIT' },
      { label: 'Money in', value: 'CREDIT' },
    ],
  },
  {
    key: 'type',
    label: 'Type',
    items: [
      { label: 'All types', value: 'ALL' },
      { label: 'Transfer', value: 'TRANSFER' },
      { label: 'Card', value: 'CARD' },
      { label: 'Cash', value: 'CASH' },
      { label: 'Fee', value: 'FEE' },
      { label: 'Interest', value: 'INTEREST' },
    ],
  },
  {
    key: 'status',
    label: 'Status',
    items: [
      { label: 'All statuses', value: 'ALL' },
      { label: 'Completed', value: 'COMPLETED' },
      { label: 'Pending', value: 'PENDING' },
      { label: 'Failed', value: 'FAILED' },
    ],
  },
]
function apply() {
  if (props.busy) return
  const values = Object.fromEntries(Object.entries(draft.value).filter(([, value]) => value.trim()))
  const parsed = transactionQuerySchema.safeParse(values)
  if (!parsed.success) {
    error.value =
      draft.value.dateFrom && draft.value.dateTo && draft.value.dateFrom > draft.value.dateTo
        ? 'Start date must be on or before end date.'
        : 'Check your filters. Use valid dates and a search of at most 200 characters.'
    return
  }
  error.value = ''
  emit('apply', { ...draft.value })
}
function clear() {
  // Clear local edits even when the URL already contains no filters.
  draft.value = {
    query: '',
    accountId: '',
    direction: '',
    type: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  }
  error.value = ''
  emit('clear')
}
</script>
<template>
  <form
    aria-label="Transaction filters"
    class="bank-surface rounded-2xl border border-default bg-white p-4 sm:p-5"
    @submit.prevent="apply"
  >
    <div class="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-6">
      <div class="min-w-0 sm:col-span-2 xl:col-span-3">
        <slot name="search" v-bind="fieldScope">
          <label
            :for="`${idPrefix}-search`"
            class="mb-1.5 block text-sm font-medium text-highlighted"
            >Search transactions</label
          >
          <UInput
            :id="`${idPrefix}-search`"
            v-model="draft.query"
            type="search"
            icon="i-lucide-search"
            placeholder="Description, counterparty or transaction ID"
            :maxlength="200"
            size="lg"
            class="w-full"
          />
        </slot>
      </div>
      <div class="min-w-0 sm:col-span-2 xl:col-span-3">
        <slot name="account" v-bind="fieldScope" :items="accountItems">
          <label
            :for="`${idPrefix}-account`"
            class="mb-1.5 block text-sm font-medium text-highlighted"
            >Account</label
          >
          <USelect
            :id="`${idPrefix}-account`"
            :model-value="draft.accountId || 'ALL'"
            :items="accountItems"
            size="lg"
            class="w-full"
            @update:model-value="draft.accountId = $event === 'ALL' ? '' : $event"
          />
        </slot>
      </div>
      <div v-for="filter in selectFilters" :key="filter.key" class="min-w-0">
        <slot :name="filter.key" v-bind="fieldScope" :items="filter.items">
          <label
            :for="`${idPrefix}-${filter.key}`"
            class="mb-1.5 block text-sm font-medium text-highlighted"
            >{{ filter.label }}</label
          >
          <USelect
            :id="`${idPrefix}-${filter.key}`"
            :model-value="draft[filter.key] || 'ALL'"
            :items="[...filter.items]"
            size="lg"
            class="w-full"
            @update:model-value="draft[filter.key] = $event === 'ALL' ? '' : $event"
          />
        </slot>
      </div>
      <div class="grid min-w-0 grid-cols-2 gap-3 sm:col-span-2 xl:col-span-3">
        <slot name="dates" v-bind="fieldScope">
          <div class="min-w-0">
            <label
              :for="`${idPrefix}-date-from`"
              class="mb-1.5 block text-sm font-medium text-highlighted"
              >From (UTC)</label
            >
            <UInput
              :id="`${idPrefix}-date-from`"
              v-model="draft.dateFrom"
              type="date"
              size="lg"
              class="w-full"
              :aria-describedby="error ? `${idPrefix}-filter-error` : undefined"
            />
          </div>
          <div class="min-w-0">
            <label
              :for="`${idPrefix}-date-to`"
              class="mb-1.5 block text-sm font-medium text-highlighted"
              >To (UTC)</label
            >
            <UInput
              :id="`${idPrefix}-date-to`"
              v-model="draft.dateTo"
              type="date"
              size="lg"
              class="w-full"
              :aria-describedby="error ? `${idPrefix}-filter-error` : undefined"
            />
          </div>
        </slot>
      </div>
      <slot name="extra-fields" v-bind="fieldScope" />
    </div>
    <p v-if="error" :id="`${idPrefix}-filter-error`" role="alert" class="mt-3 text-sm text-error">
      <slot name="error" :message="error">{{ error }}</slot>
    </p>
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <slot name="actions" v-bind="fieldScope" :apply="apply" :clear="clear">
        <UButton :loading="busy" type="submit" class="min-h-11" icon="i-lucide-list-filter"
          >Apply filters</UButton
        >
        <UButton type="button" color="neutral" variant="ghost" class="min-h-11" @click="clear"
          >Clear filters</UButton
        >
        <p class="text-xs text-muted">Dates include the full day in UTC.</p>
      </slot>
    </div>
  </form>
</template>
