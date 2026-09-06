<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import type { PaginatedTransactions } from '@/data/api/bankingApi'
const props = defineProps<{ pagination: PaginatedTransactions['pagination']; busy: boolean }>()
defineEmits<{ page: [page: number]; pageSize: [pageSize: number] }>()
const sizes = computed(() =>
  [...new Set([10, 20, 50, 100, props.pagination.pageSize])].sort((a, b) => a - b),
)
</script>
<template>
  <nav
    aria-label="Transaction pagination"
    class="mt-4 flex flex-wrap items-center justify-between gap-4"
  >
    <div class="flex items-center gap-3">
      <label for="transaction-page-size" class="text-sm text-muted">Rows per page</label>
      <USelect
        id="transaction-page-size"
        :model-value="pagination.pageSize"
        :items="sizes"
        :disabled="busy"
        class="min-w-20"
        @update:model-value="$emit('pageSize', $event)"
      />
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <p class="text-sm text-muted">
        Page {{ pagination.page }} of {{ Math.max(1, pagination.totalPages) }}
      </p>
      <UButton
        color="neutral"
        variant="outline"
        class="min-h-11"
        :disabled="busy || pagination.page <= 1"
        @click="$emit('page', pagination.page - 1)"
        >Previous</UButton
      >
      <UButton
        color="neutral"
        variant="outline"
        class="min-h-11"
        :disabled="busy || pagination.page >= pagination.totalPages"
        @click="$emit('page', pagination.page + 1)"
        >Next</UButton
      >
    </div>
  </nav>
</template>
