<script setup lang="ts">
import UButton from '@nuxt/ui/components/Button.vue'
import USkeleton from '@nuxt/ui/components/Skeleton.vue'
import { ApiError } from '@/data/api/apiError'
defineProps<{
  loading: boolean
  error?: unknown
  empty: boolean
  label: string
  emptyMessage: string
}>()
defineEmits<{ retry: [] }>()
</script>
<template>
  <div v-if="loading" role="status" class="space-y-4 py-6" aria-live="polite">
    <p class="text-sm text-muted">Loading {{ label }}…</p>
    <USkeleton class="h-24 w-full rounded-xl" /><USkeleton class="h-24 w-full rounded-xl" />
  </div>
  <div v-else-if="error" role="alert" class="rounded-xl border border-error/25 bg-error/5 p-6">
    <h2 class="text-base font-semibold text-highlighted">Unable to load {{ label }}</h2>
    <p class="mt-2 text-sm text-toned">
      {{
        error instanceof ApiError && error.code === 'STORAGE_UNAVAILABLE'
          ? 'Demo storage is unavailable. Close older tabs if necessary and try again.'
          : 'Please check your connection and try again.'
      }}
    </p>
    <UButton class="mt-4" color="neutral" variant="outline" @click="$emit('retry')"
      >Try again</UButton
    >
  </div>
  <div v-else-if="empty" class="rounded-xl border border-default bg-white px-6 py-12 text-center">
    <h2 class="text-lg font-semibold text-highlighted">No {{ label }} yet</h2>
    <p class="mt-2 text-sm text-muted">{{ emptyMessage }}</p>
  </div>
  <slot v-else />
</template>
