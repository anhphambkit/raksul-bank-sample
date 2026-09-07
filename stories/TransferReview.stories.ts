import type { Meta, StoryObj } from '@storybook/vue3-vite'
import TransferReview from '../src/features/transfers/components/TransferReview.vue'
import { draft } from './fixtures'
const meta = {
  title: 'Banking/TransferReview',
  component: TransferReview,
  args: { draft, pending: false },
  argTypes: {
    draft: { control: 'object' },
    pending: { control: 'boolean' },
    failure: { control: 'object' },
  },
} satisfies Meta<typeof TransferReview>
export default meta
type Story = StoryObj<typeof meta>
export const Default: Story = {}
export const Confirming: Story = { args: { pending: true } }
export const Uncertain: Story = {
  args: {
    failure: {
      uncertain: true,
      message: 'The response was interrupted. Retry the same transfer to check its outcome.',
    },
  },
}
