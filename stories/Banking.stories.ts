import type { Meta, StoryObj } from '@storybook/vue3-vite'
import AccountCard from '../src/features/accounts/components/AccountCard.vue'
import TransactionTable from '../src/features/transactions/components/TransactionTable.vue'
import MoneyDisplay from '../src/shared/components/MoneyDisplay.vue'
import MoneyInput from '../src/shared/components/MoneyInput.vue'
import TransferDetailsForm from '../src/features/transfers/components/TransferDetailsForm.vue'
import TransferReview from '../src/features/transfers/components/TransferReview.vue'
import TransferReceipt from '../src/features/transfers/components/TransferReceipt.vue'
import { createSeedState } from '../src/data/seed/createSeedState'
import { prepareTransfer } from '../src/features/transfers/transferDraft'
const seed = createSeedState()
const accounts = seed.accounts.filter((account) => account.ownerId === seed.customer.id)
const draft = prepareTransfer(
  {
    sourceAccountId: accounts[0]!.id,
    recipientType: 'OWN_ACCOUNT',
    destinationId: accounts[1]!.id,
    amount: '10.50',
    reference: 'Savings top-up',
  },
  accounts,
  seed.beneficiaries,
)
export default { title: 'Banking/Components' } satisfies Meta
export const ActiveAccount: StoryObj = {
  render: () => ({
    components: { AccountCard },
    setup: () => ({ account: accounts[0] }),
    template: '<AccountCard :account="account" class="max-w-sm" />',
  }),
}
export const FrozenAccount: StoryObj = {
  render: () => ({
    components: { AccountCard },
    setup: () => ({ account: accounts[2] }),
    template: '<AccountCard :account="account" class="max-w-sm" />',
  }),
}
export const Money: StoryObj = {
  render: () => ({
    components: { MoneyDisplay },
    template: '<MoneyDisplay :amount-minor="125050" class="text-3xl" />',
  }),
}
export const AmountInput: StoryObj = {
  render: () => ({ components: { MoneyInput }, template: '<label>Amount<MoneyInput /></label>' }),
}
export const InvalidAmount: StoryObj = {
  render: () => ({ components: { MoneyInput }, template: '<MoneyInput model-value="1.234" />' }),
}
export const Transactions: StoryObj = {
  render: () => ({
    components: { TransactionTable },
    setup: () => ({
      accounts,
      transactions: seed.transactions
        .filter((t) => accounts.some((a) => a.id === t.accountId))
        .slice(0, 6),
    }),
    template: '<TransactionTable :accounts="accounts" :transactions="transactions" />',
  }),
}
export const Details: StoryObj = {
  render: () => ({
    components: { TransferDetailsForm },
    setup: () => ({ accounts, beneficiaries: seed.beneficiaries }),
    template: '<TransferDetailsForm :accounts="accounts" :beneficiaries="beneficiaries" />',
  }),
}
export const Review: StoryObj = {
  render: () => ({
    components: { TransferReview },
    setup: () => ({ draft }),
    template: '<TransferReview :draft="draft" :pending="false" />',
  }),
}
export const Confirming: StoryObj = {
  render: () => ({
    components: { TransferReview },
    setup: () => ({ draft }),
    template: '<TransferReview :draft="draft" pending />',
  }),
}
export const UncertainOutcome: StoryObj = {
  render: () => ({
    components: { TransferReview },
    setup: () => ({ draft }),
    template:
      '<TransferReview :draft="draft" :pending="false" :failure="{ uncertain: true, message: \'The response was interrupted. Retry the same transfer to check its outcome.\' }" />',
  }),
}
export const Receipt: StoryObj = {
  render: () => ({
    components: { TransferReceipt },
    setup: () => ({
      recipient: draft.recipient,
      receipt: {
        id: 'transfer-story',
        sourceAccountId: draft.request.sourceAccountId,
        destination: draft.request.destination,
        amountMinor: 1050,
        currency: 'USD',
        reference: 'Savings top-up',
        status: 'COMPLETED',
        createdAt: '2026-09-07T05:00:00Z',
        completedAt: '2026-09-07T05:00:00Z',
      },
    }),
    template: '<TransferReceipt :receipt="receipt" :recipient="recipient" />',
  }),
}
