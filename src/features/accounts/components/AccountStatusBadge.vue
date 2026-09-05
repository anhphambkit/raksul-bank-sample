<script setup lang="ts">
import UBadge from '@nuxt/ui/components/Badge.vue'
import type { Account } from '@/domain/accounts/account'
defineProps<{ status: Account['status'] }>()
</script>
<template>
  <UBadge
    :color="status === 'ACTIVE' ? 'success' : 'warning'"
    :icon="status === 'ACTIVE' ? 'i-lucide-circle-check' : 'i-lucide-lock-keyhole'"
    variant="subtle"
    class="rounded-full text-xs"
    :class="status === 'ACTIVE' ? 'text-emerald-800' : 'text-amber-800'"
    >{{ status === 'ACTIVE' ? 'Active' : 'Frozen' }}</UBadge
  >
</template>
