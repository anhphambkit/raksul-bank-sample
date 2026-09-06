import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mount } from '@vue/test-utils'
import ui from '@nuxt/ui/vue-plugin'
import TransferDetailsForm from '../../features/transfers/components/TransferDetailsForm.vue'
import { createSeedState } from '../../data/seed/createSeedState'
import {
  prepareTransfer,
  type TransferDetails,
  type TransferDraft,
} from '../../features/transfers/transferDraft'
const seed = createSeedState()
const accounts = seed.accounts.filter((account) => account.ownerId === seed.customer.id)
const details: TransferDetails = {
  sourceAccountId: 'account-checking',
  recipientType: 'OWN_ACCOUNT',
  destinationId: 'account-savings',
  amount: '0.29',
  reference: '  Savings  ',
}
function form(initial?: TransferDetails) {
  return mount(TransferDetailsForm, {
    props: { accounts, beneficiaries: seed.beneficiaries, initial },
    attachTo: document.body,
    global: { plugins: [ui, createRouter({ history: createMemoryHistory(), routes: [] })] },
  })
}

describe('transfer details', () => {
  it('emits a validated exact-cent draft only after review, without submitting an API mutation', async () => {
    const wrapper = form(details)
    expect(wrapper.emitted('review')).toBeUndefined()
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(wrapper.emitted('review')).toHaveLength(1))
    const draft = wrapper.emitted('review')![0]![0] as TransferDraft
    expect(draft.request).toMatchObject({
      amountMinor: 29,
      reference: 'Savings',
      destination: { kind: 'OWN_ACCOUNT', accountId: 'account-savings' },
    })
    expect(draft.request.idempotencyKey).toBeTruthy()
    expect(draft.source.id).toBe('account-checking')
    expect(draft.recipient.name).toBe('Rainy Day Savings')
    expect(wrapper.html()).not.toContain(accounts[0]!.accountNumber)
  })
  it('excludes the source and frozen destination, and clears the recipient when choices change', async () => {
    const wrapper = form(details)
    const selects = wrapper.findAllComponents({ name: 'Select' })
    expect(selects[0]!.props('items')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'account-frozen', disabled: true }),
      ]),
    )
    expect(selects[1]!.props('items')).toEqual([
      expect.objectContaining({ value: 'account-savings' }),
    ])
    wrapper.findComponent({ name: 'RadioGroup' }).vm.$emit('update:modelValue', 'BENEFICIARY')
    await wrapper.vm.$nextTick()
    expect(selects[1]!.props('modelValue')).toBe('')
    expect(selects[1]!.props('items')).toHaveLength(6)
    expect(wrapper.text()).toContain('Someone else')
    expect(wrapper.text()).not.toMatch(/internal|external/i)
  })
  it.each(['1.005', '0', '99999999', '-2'])(
    'blocks invalid or unaffordable amount %s with an inline error',
    async (amount) => {
      const wrapper = form({ ...details, amount })
      await wrapper.get('form').trigger('submit')
      await vi.waitFor(() => expect(wrapper.text()).toMatch(/exceeds your available|above 0/))
      expect(wrapper.emitted('review')).toBeUndefined()
    },
  )
  it('requires account and recipient and preserves details after returning from review', async () => {
    const empty = form()
    await empty.get('form').trigger('submit')
    await vi.waitFor(() => expect(empty.text()).toContain('Choose a source account.'))
    expect(empty.emitted('review')).toBeUndefined()
    const existing = form(details)
    expect(existing.findAllComponents({ name: 'Select' })[1]!.props('modelValue')).toBe(
      'account-savings',
    )
    expect(existing.get<HTMLInputElement>('input[inputmode="decimal"]').element.value).toBe('0.29')
  })
  it('prepares beneficiary identity from the loaded recipient, not entered account details', () => {
    const draft = prepareTransfer(
      { ...details, recipientType: 'BENEFICIARY', destinationId: 'beneficiary-rent' },
      accounts,
      seed.beneficiaries,
    )
    expect(draft.request.destination).toEqual({
      kind: 'BENEFICIARY',
      beneficiaryId: 'beneficiary-rent',
    })
    expect(draft.recipient).toMatchObject({ name: 'Maple Apartments', bankName: 'Harbor Bank' })
  })
})
