<script setup lang="ts">
import UCard from '@nuxt/ui/components/Card.vue'
import UIcon from '@nuxt/ui/runtime/vue/components/Icon.vue'

defineProps<{
  title: string
  description: string
  icon: string
  sectionTitle: string
  message: string
}>()
</script>

<template>
  <section class="py-4 sm:py-6" aria-labelledby="page-heading">
    <div class="mb-8 flex flex-wrap items-start justify-between gap-5 sm:mb-10">
      <div>
        <h1
          id="page-heading"
          class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl"
        >
          {{ title }}
        </h1>
        <p class="mt-3 max-w-xl text-base leading-7 text-muted">{{ description }}</p>
      </div>
      <slot name="actions" />
    </div>

    <UCard :ui="{ root: 'shadow-none', header: 'px-6 py-5', body: 'p-6 sm:p-10' }">
      <template #header>
        <h2 class="text-base font-semibold text-highlighted">{{ sectionTitle }}</h2>
      </template>
      <div class="flex min-h-72 flex-col items-center justify-center text-center">
        <span
          class="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary/5 text-primary"
        >
          <UIcon :name="icon" class="size-6" aria-hidden="true" />
        </span>
        <p class="text-base font-medium text-highlighted">Not available in this preview yet</p>
        <p class="mt-2 max-w-sm text-sm leading-6 text-muted">{{ message }}</p>
      </div>
    </UCard>
  </section>
</template>
