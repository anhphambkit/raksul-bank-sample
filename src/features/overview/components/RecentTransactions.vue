<script setup lang="ts">
import { onServerPrefetch } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import UButton from '@nuxt/ui/components/Button.vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UTable from '@nuxt/ui/components/Table.vue'
import type { TableColumn } from '@nuxt/ui'
import type { Transaction } from '@/domain/transactions/transaction'
import type { Account } from '@/domain/accounts/account'
import { useBankingContext } from '@/data/api/bankingContext'
import { bankingQueryKeys } from '@/data/api/bankingQueryKeys'
import DataState from '@/shared/components/DataState.vue'
import MoneyDisplay from '@/shared/components/MoneyDisplay.vue'
defineProps<{ accounts: Account[] }>()
const { api, ready } = useBankingContext()
const { data, isPending, isError, error, refetch, suspense } = useQuery({
  enabled: ready,
  queryKey: bankingQueryKeys.recentTransactions,
  queryFn: ({ signal }) => api.transactions({ page: 1, pageSize: 5 }, signal),
})
onServerPrefetch(async () => {
  if (ready.value) await suspense().catch(() => {})
})
const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const columns: TableColumn<Transaction>[] = [
  { accessorKey: 'description', header: 'Transaction' },
  { accessorKey: 'occurredAt', header: 'Date · UTC' },
  { accessorKey: 'status', header: 'Status' },
  {
    accessorKey: 'amountMinor',
    header: 'Amount',
    meta: { class: { th: 'text-right', td: 'text-right' } },
  },
]
const statuses = {
  COMPLETED: { label: 'Completed', color: 'neutral', text: 'text-slate-700' },
  PENDING: { label: 'Pending', color: 'warning', text: 'text-amber-800' },
  FAILED: { label: 'Failed', color: 'error', text: 'text-red-800' },
} as const
</script>
<template>
  <section aria-labelledby="recent-title" class="mt-8">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h2 id="recent-title" class="text-xl font-semibold text-highlighted">Recent activity</h2>
      <UButton
        to="/transactions"
        color="neutral"
        variant="link"
        trailing-icon="i-lucide-arrow-right"
        >View transactions</UButton
      >
    </div>
    <DataState
      :loading="isPending"
      :error="isError ? error : null"
      :empty="!data?.data.length"
      label="transactions"
      empty-message="Your account activity will appear here."
      @retry="refetch()"
    >
      <UTable
        :data="data?.data ?? []"
        :columns="columns"
        caption="Five most recent transactions"
        class="hidden rounded-xl border border-default bg-white md:block"
        :ui="{
          th: 'bg-slate-50 px-5 py-3 text-xs font-medium text-muted',
          td: 'px-5 py-4 text-sm',
          caption: 'sr-only',
        }"
      >
        <template #description-cell="{ row }">
          <p class="font-medium text-highlighted">{{ row.original.description }}</p>
          <p class="mt-1 text-xs text-muted">
            {{
              accounts.find((account) => account.id === row.original.accountId)?.displayName ??
              'Account'
            }}
          </p>
        </template>
        <template #occurredAt-cell="{ row }">
          <time :datetime="row.original.occurredAt" class="text-muted">{{
            dateFormat.format(new Date(row.original.occurredAt))
          }}</time>
        </template>
        <template #status-cell="{ row }">
          <UBadge
            :color="statuses[row.original.status].color"
            variant="subtle"
            class="rounded-full text-xs"
            :class="statuses[row.original.status].text"
            >{{ statuses[row.original.status].label }}</UBadge
          >
        </template>
        <template #amountMinor-cell="{ row }">
          <MoneyDisplay
            :amount-minor="row.original.amountMinor"
            :direction="row.original.direction"
            class="font-medium"
            :class="row.original.direction === 'CREDIT' ? 'text-green-700' : 'text-highlighted'"
          />
        </template>
      </UTable>
      <ul class="divide-y divide-default rounded-xl border border-default bg-white md:hidden">
        <li
          v-for="entry in data?.data"
          :key="entry.id"
          class="flex items-start justify-between gap-3 px-4 py-5 sm:px-6"
        >
          <div class="min-w-0">
            <p class="font-medium text-highlighted">{{ entry.description }}</p>
            <p class="mt-1 text-sm text-muted">
              {{
                accounts.find((account) => account.id === entry.accountId)?.displayName ?? 'Account'
              }}
            </p>
            <p class="mt-1 text-sm text-muted">
              <time :datetime="entry.occurredAt">{{
                dateFormat.format(new Date(entry.occurredAt))
              }}</time>
              · UTC
            </p>
          </div>
          <div class="flex max-w-[50%] min-w-0 shrink-0 flex-col items-end gap-2 text-right">
            <MoneyDisplay
              :amount-minor="entry.amountMinor"
              :direction="entry.direction"
              class="font-semibold"
              :class="entry.direction === 'CREDIT' ? 'text-green-700' : 'text-highlighted'"
            /><UBadge
              :color="statuses[entry.status].color"
              variant="subtle"
              class="text-sm"
              :class="statuses[entry.status].text"
              >{{ statuses[entry.status].label }}</UBadge
            >
          </div>
        </li>
      </ul>
    </DataState>
  </section>
</template>
