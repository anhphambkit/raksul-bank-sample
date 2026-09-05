<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney } from '@/shared/utils/formatMoney'
const props = defineProps<{ amountMinor: number | bigint; direction?: 'DEBIT' | 'CREDIT' }>()
const groups = computed(() => formatMoney(props.amountMinor, props.direction).split(','))
</script>
<template>
  <span class="min-w-0 tabular-nums whitespace-normal"
    ><template v-for="(group, index) in groups" :key="index"
      ><span class="whitespace-nowrap">{{ group }}{{ index < groups.length - 1 ? ',' : '' }}</span
      ><wbr v-if="index < groups.length - 1" /></template
  ></span>
</template>
