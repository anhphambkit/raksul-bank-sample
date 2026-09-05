<script setup lang="ts">
import { computed } from 'vue'
import type { Account } from '@/domain/accounts/account'
import MoneyDisplay from '@/shared/components/MoneyDisplay.vue'
const props = defineProps<{ accounts: Account[] }>()
const total = computed(() =>
  props.accounts.reduce((sum, account) => sum + BigInt(account.balanceMinor), 0n),
)
const active = computed(() =>
  props.accounts
    .filter((account) => account.status === 'ACTIVE')
    .reduce((sum, account) => sum + BigInt(account.balanceMinor), 0n),
)
</script>
<template>
  <section
    aria-label="Account summary"
    class="grid gap-5 rounded-xl border border-default bg-white p-5 sm:p-6 md:grid-cols-[1.5fr_1fr_1fr] md:items-center"
  >
    <div class="min-w-0">
      <h2 class="text-sm text-muted">Total balance · USD</h2>
      <MoneyDisplay
        :amount-minor="total"
        class="mt-2 block text-4xl font-semibold tracking-tight text-highlighted sm:text-5xl"
      />
      <p class="mt-2 text-sm text-muted">
        Across {{ accounts.length }} {{ accounts.length === 1 ? 'account' : 'accounts' }}, including
        frozen balances
      </p>
    </div>
    <div class="min-w-0 border-t border-default pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
      <p class="text-sm text-muted">In active accounts</p>
      <MoneyDisplay
        :amount-minor="active"
        class="mt-2 block text-xl font-semibold text-highlighted"
      />
    </div>
    <div class="min-w-0 border-t border-default pt-5 md:border-t-0 md:border-l md:pt-0 md:pl-6">
      <p class="text-sm text-muted">In frozen accounts</p>
      <MoneyDisplay
        :amount-minor="total - active"
        class="mt-2 block text-xl font-semibold text-highlighted"
      />
    </div>
  </section>
</template>
