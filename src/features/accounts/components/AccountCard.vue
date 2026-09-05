<script setup lang="ts">
import UCard from '@nuxt/ui/components/Card.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import type { Account } from '@/domain/accounts/account'
import MoneyDisplay from '@/shared/components/MoneyDisplay.vue'
import MaskedAccountNumber from '@/shared/components/MaskedAccountNumber.vue'
import AccountStatusBadge from './AccountStatusBadge.vue'
defineProps<{ account: Account }>()
</script>
<template>
  <UCard
    as="article"
    :aria-label="account.displayName"
    :ui="{ root: 'h-full shadow-none', body: 'flex h-full min-w-0 flex-col p-5' }"
  >
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-muted">
        {{ account.type === 'CHECKING' ? 'Checking' : 'Savings' }} · {{ account.currency }}
      </p>
      <AccountStatusBadge :status="account.status" />
    </div>
    <h3 class="mt-4 text-lg font-semibold text-highlighted">{{ account.displayName }}</h3>
    <p class="mt-1 text-sm text-muted">
      <MaskedAccountNumber :account-number="account.accountNumber" />
    </p>
    <p class="mt-5 text-sm text-muted">Current balance</p>
    <MoneyDisplay
      :amount-minor="account.balanceMinor"
      class="mt-1 text-2xl font-semibold tracking-tight text-highlighted"
    />
    <p
      class="mt-3 min-h-10 text-sm leading-5"
      :class="account.status === 'FROZEN' ? 'text-amber-800' : 'text-muted'"
    >
      {{
        account.status === 'FROZEN'
          ? 'Transfers unavailable while this account is frozen.'
          : 'Available for transfers.'
      }}
    </p>
    <UButton
      :to="account.status === 'ACTIVE' ? '/transfer' : undefined"
      :disabled="account.status === 'FROZEN'"
      :color="account.status === 'ACTIVE' ? 'primary' : 'neutral'"
      variant="outline"
      class="mt-4 min-h-11 justify-center"
      icon="i-lucide-arrow-up-right"
      >Transfer</UButton
    >
  </UCard>
</template>
