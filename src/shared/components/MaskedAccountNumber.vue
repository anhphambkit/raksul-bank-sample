<script setup lang="ts">
import { maskAccountNumber } from '@/domain/accounts/maskAccountNumber'
defineProps<{ accountNumber: string }>()
</script>
<template>
  <span class="font-mono tracking-wide">{{ maskAccountNumber(accountNumber) }}</span>
</template>
