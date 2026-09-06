import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ui from '@nuxt/ui/vue-plugin'
import MoneyInput from '../../shared/components/MoneyInput.vue'

describe('exact money input', () => {
  it('preserves editable decimal text and emits exact cents', async () => {
    const wrapper = mount(MoneyInput, { props: { id: 'amount' }, global: { plugins: [ui] } })
    await wrapper.get('input').setValue('0.29')
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['0.29'])
    expect(wrapper.emitted('amount')?.at(-1)).toEqual([29])
    expect(wrapper.get('input').attributes('inputmode')).toBe('decimal')
  })
  it.each(['1.005', '-1', '0', '1e3', '1,000', '90071992547409.92'])(
    'rejects %s without rounding it into money',
    async (value) => {
      const wrapper = mount(MoneyInput, { global: { plugins: [ui] } })
      await wrapper.get('input').setValue(value)
      expect(wrapper.emitted('amount')?.at(-1)).toEqual([undefined])
      expect(wrapper.find('[role="alert"]').exists()).toBe(true)
      expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
    },
  )
})
