<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import UForm from '@nuxt/ui/components/Form.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import { useBankingContext } from '@/data/api/bankingContext'
import { beneficiaryRequestSchema } from '@/data/api/beneficiaryRequestSchema'
import type { CreateBeneficiaryRequest } from '@/contracts/beneficiaries'
const emit = defineEmits<{ saved: [id: string]; cancel: [] }>()
const { api } = useBankingContext()
const client = useQueryClient()
const state = reactive<CreateBeneficiaryRequest>({
  displayName: '',
  bankName: '',
  accountNumber: '',
  currency: 'USD',
})
const formReady = computed(() => beneficiaryRequestSchema.safeParse(state).success)
const mutation = useMutation({
  mutationFn: () => api.createBeneficiary({ ...state }),
  retry: false,
  onSuccess: async (recipient) => {
    await client.invalidateQueries({ queryKey: ['bank', 'beneficiaries'] })
    emit('saved', recipient.id)
  },
})
function save() {
  if (!mutation.isPending.value) mutation.mutate()
}
</script>
<template>
  <UForm
    :schema="beneficiaryRequestSchema"
    :state="state"
    :validate-on="['blur', 'input']"
    class="space-y-5"
    @submit="save"
  >
    <h2 class="text-xl font-semibold text-highlighted">Add a recipient</h2>
    <p class="text-sm text-muted">
      Save a USD recipient for this and future transfers. External account details are simulated,
      not verified by a bank.
    </p>
    <UFormField label="Recipient name" name="displayName" required>
      <UInput v-model="state.displayName" :maxlength="80" class="w-full" />
    </UFormField>
    <UFormField label="Bank name" name="bankName" required>
      <UInput v-model="state.bankName" :maxlength="80" class="w-full" />
    </UFormField>
    <UFormField label="Account number" name="accountNumber" required>
      <UInput
        v-model="state.accountNumber"
        inputmode="numeric"
        :maxlength="20"
        autocomplete="off"
        class="w-full"
      />
    </UFormField>
    <p v-if="mutation.error.value" role="alert" class="text-sm text-error">
      {{ mutation.error.value.message }}
    </p>
    <div class="flex gap-3">
      <UButton
        type="submit"
        :loading="mutation.isPending.value"
        :disabled="mutation.isPending.value || !formReady"
      >
        Save recipient
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        :disabled="mutation.isPending.value"
        @click="emit('cancel')"
      >
        Cancel
      </UButton>
    </div>
  </UForm>
</template>
