<script setup lang="ts">
import UBadge from '@nuxt/ui/components/Badge.vue'
import UTable from '@nuxt/ui/components/Table.vue'
import type { TableColumn } from '@nuxt/ui'
import type { Transaction } from '@/domain/transactions/transaction'
import type { Account } from '@/domain/accounts/account'
import MoneyDisplay from '@/shared/components/MoneyDisplay.vue'
defineProps<{ transactions: Transaction[]; accounts: Account[] }>()
const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const columns: TableColumn<Transaction>[] = [
  { accessorKey: 'description', header: 'Transaction' },
  { accessorKey: 'occurredAt', header: 'Date · UTC' },
  { accessorKey: 'accountId', header: 'Account' },
  { accessorKey: 'type', header: 'Type' },
  { accessorKey: 'status', header: 'Status' },
  {
    accessorKey: 'amountMinor',
    header: 'Amount · USD',
    meta: { class: { th: 'text-right', td: 'text-right' } },
  },
]
const types = { TRANSFER: 'Transfer', CARD: 'Card', CASH: 'Cash', FEE: 'Fee', INTEREST: 'Interest' }
const statuses = {
  COMPLETED: { label: 'Completed', color: 'neutral' },
  PENDING: { label: 'Pending', color: 'warning' },
  FAILED: { label: 'Failed', color: 'error' },
} as const
</script>
<template>
  <UTable
    :data="transactions"
    :columns="columns"
    caption="Account transactions, newest first"
    class="hidden rounded-xl border border-default bg-white lg:block"
    :ui="{
      th: 'bg-slate-50 px-4 py-3 text-xs font-medium text-muted',
      td: 'px-4 py-4 text-sm',
      caption: 'sr-only',
    }"
  >
    <template #description-cell="{ row }">
      <p class="font-medium whitespace-normal text-highlighted">{{ row.original.description }}</p>
      <p v-if="row.original.counterparty" class="mt-1 whitespace-normal text-muted">
        {{ row.original.counterparty }}
      </p>
      <p class="mt-1 text-xs text-muted">{{ row.original.id }}</p>
    </template>
    <template #occurredAt-cell="{ row }"
      ><time :datetime="row.original.occurredAt" class="text-muted">{{
        dateFormat.format(new Date(row.original.occurredAt))
      }}</time></template
    >
    <template #accountId-cell="{ row }"
      ><span class="whitespace-normal">{{
        accounts.find((account) => account.id === row.original.accountId)?.displayName ?? 'Account'
      }}</span></template
    >
    <template #type-cell="{ row }">{{ types[row.original.type] }}</template>
    <template #status-cell="{ row }"
      ><UBadge :color="statuses[row.original.status].color" variant="subtle">{{
        statuses[row.original.status].label
      }}</UBadge></template
    >
    <template #amountMinor-cell="{ row }">
      <MoneyDisplay
        :amount-minor="row.original.amountMinor"
        :direction="row.original.direction"
        class="font-semibold"
        :class="row.original.direction === 'CREDIT' ? 'text-green-700' : 'text-highlighted'"
      />
      <p class="mt-1 text-xs text-muted">
        {{ row.original.direction === 'CREDIT' ? 'Money in' : 'Money out' }}
      </p>
    </template>
  </UTable>
  <ul
    aria-label="Account transactions, newest first"
    class="divide-y divide-default rounded-xl border border-default bg-white lg:hidden"
  >
    <li v-for="entry in transactions" :key="entry.id" class="space-y-3 p-4 sm:p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 break-words">
          <p class="font-medium text-highlighted">{{ entry.description }}</p>
          <p v-if="entry.counterparty" class="mt-1 text-sm text-muted">{{ entry.counterparty }}</p>
        </div>
        <div class="max-w-[50%] min-w-0 shrink-0 text-right">
          <MoneyDisplay
            :amount-minor="entry.amountMinor"
            :direction="entry.direction"
            class="font-semibold"
            :class="entry.direction === 'CREDIT' ? 'text-green-700' : 'text-highlighted'"
          />
          <p class="mt-1 text-xs text-muted">
            {{ entry.direction === 'CREDIT' ? 'Money in' : 'Money out' }} · USD
          </p>
        </div>
      </div>
      <p class="text-sm text-muted">
        {{ accounts.find((account) => account.id === entry.accountId)?.displayName ?? 'Account' }}
      </p>
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span
          ><time :datetime="entry.occurredAt">{{
            dateFormat.format(new Date(entry.occurredAt))
          }}</time>
          · UTC · {{ types[entry.type] }}</span
        >
        <UBadge :color="statuses[entry.status].color" variant="subtle">{{
          statuses[entry.status].label
        }}</UBadge>
      </div>
      <p class="text-xs break-all text-muted">{{ entry.id }}</p>
    </li>
  </ul>
</template>
