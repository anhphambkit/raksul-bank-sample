<script setup lang="ts">
import { ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import UButton from '@nuxt/ui/components/Button.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { useBankingContext } from '@/data/api/bankingContext'
const { api, ready, mocksEnabled } = useBankingContext()
import { bankingQueryKeys } from '@/data/api/bankingQueryKeys'
const open = ref(false)
const restored = ref(false)
const client = useQueryClient()
const { mutate, isPending, isError, reset } = useMutation({
  mutationFn: () => api.reset(),
  onMutate: async () => {
    restored.value = false
    await client.cancelQueries({ queryKey: bankingQueryKeys.all })
  },
  onSuccess: async () => {
    await client.invalidateQueries({ queryKey: bankingQueryKeys.all })
    open.value = false
    restored.value = true
  },
})
function prepareReset() {
  reset()
  restored.value = false
}
</script>
<template>
  <div v-if="mocksEnabled" class="flex flex-col items-end gap-2">
    <UModal
      v-model:open="open"
      title="Reset demo data?"
      description="Restore the original accounts and activity. Changes made in this demo will be removed."
      :dismissible="!isPending"
      :close="!isPending"
    >
      <UButton
        color="neutral"
        variant="ghost"
        class="min-h-11"
        icon="i-lucide-rotate-ccw"
        :disabled="!ready"
        @click="prepareReset"
        >Reset demo data</UButton
      >
      <template #body
        ><p v-if="isError" role="alert" class="text-sm text-error">
          Demo data could not be reset. Please try again.
        </p>
        <p v-else class="text-sm text-toned">This affects demonstration data only.</p></template
      >
      <template #footer
        ><div class="flex w-full justify-end gap-3">
          <UButton color="neutral" variant="outline" :disabled="isPending" @click="open = false"
            >Cancel</UButton
          ><UButton :loading="isPending" @click="mutate()">Reset demo</UButton>
        </div></template
      >
    </UModal>
    <p v-if="restored" role="status" class="text-sm text-primary">Demo data restored.</p>
  </div>
</template>
