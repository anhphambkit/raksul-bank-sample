import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { createIndexedDbBankingRepository } from '../../data/repositories/indexedDbBankingRepository'
import { createSeedState } from '../../data/seed/createSeedState'
import { executeTransfer, getTransfer } from '../../use-cases/transfers/executeTransfer'
import type { BankingRepository } from '../../use-cases/ports/BankingRepository'
import type { TransferRequest } from '../../contracts/transfers'

let repository: BankingRepository
let factory: IDBFactory
const request = (patch: Partial<TransferRequest> = {}): TransferRequest => ({
  idempotencyKey: 'request-1',
  sourceAccountId: 'account-checking',
  destination: { kind: 'OWN_ACCOUNT', accountId: 'account-savings' },
  amountMinor: 1050,
  currency: 'USD',
  reference: 'Test transfer',
  ...patch,
})
beforeEach(() => {
  factory = new IDBFactory()
  repository = createIndexedDbBankingRepository(() => factory)
})

describe('atomic transfer execution', () => {
  it.each([
    [{ kind: 'OWN_ACCOUNT', accountId: 'account-savings' }, 'account-savings', 2],
    [{ kind: 'BENEFICIARY', beneficiaryId: 'beneficiary-alex' }, 'account-internal-alex', 2],
    [{ kind: 'BENEFICIARY', beneficiaryId: 'beneficiary-rent' }, undefined, 1],
  ] as const)(
    'moves exact cents and persists the linked activity for %j',
    async (destination, targetId, count) => {
      const before = await repository.load()
      const transfer = await executeTransfer(repository, request({ destination }))
      const after = await createIndexedDbBankingRepository(() => factory).load()
      expect(after.accounts[0]!.balanceMinor).toBe(before.accounts[0]!.balanceMinor - 1050)
      for (const account of after.accounts.slice(1)) {
        expect(account.balanceMinor).toBe(
          before.accounts.find((item) => item.id === account.id)!.balanceMinor +
            (account.id === targetId ? 1050 : 0),
        )
      }
      const entries = after.transactions.filter((entry) => entry.transferId === transfer.id)
      expect(entries).toHaveLength(count)
      expect(entries[0]).toMatchObject({
        amountMinor: 1050,
        direction: 'DEBIT',
        status: 'COMPLETED',
      })
      if (count === 2)
        expect(entries[1]).toMatchObject({ accountId: targetId, direction: 'CREDIT' })
      expect(await getTransfer(repository, transfer.id)).toEqual(transfer)
      if (destination.kind === 'BENEFICIARY') {
        expect(transfer.destination).toHaveProperty('recipientSnapshot')
        await repository.update((state) => {
          state.beneficiaries.find((item) => item.id === destination.beneficiaryId)!.displayName =
            'Renamed'
          return state
        })
        expect((await getTransfer(repository, transfer.id)).destination).toEqual(
          transfer.destination,
        )
      }
      await repository.reset()
      expect(await repository.load()).toEqual(createSeedState())
    },
  )

  it.each([
    [{ amountMinor: 0 }, 'INVALID_AMOUNT'],
    [{ amountMinor: -1 }, 'INVALID_AMOUNT'],
    [{ amountMinor: 1.5 }, 'INVALID_AMOUNT'],
    [{ amountMinor: Number.MAX_SAFE_INTEGER + 1 }, 'INVALID_AMOUNT'],
    [{ amountMinor: Number.MAX_SAFE_INTEGER }, 'INSUFFICIENT_FUNDS'],
    [{ sourceAccountId: 'missing' }, 'SOURCE_NOT_FOUND'],
    [{ sourceAccountId: 'account-internal-alex' }, 'SOURCE_NOT_OWNED'],
    [{ sourceAccountId: 'account-frozen' }, 'SOURCE_NOT_ACTIVE'],
    [{ destination: { kind: 'OWN_ACCOUNT', accountId: 'account-checking' } }, 'SAME_ACCOUNT'],
    [
      { destination: { kind: 'OWN_ACCOUNT', accountId: 'account-frozen' } },
      'DESTINATION_NOT_ACTIVE',
    ],
    [
      { destination: { kind: 'OWN_ACCOUNT', accountId: 'account-internal-alex' } },
      'INVALID_DESTINATION',
    ],
    [{ destination: { kind: 'BENEFICIARY', beneficiaryId: 'missing' } }, 'INVALID_RECIPIENT'],
  ] as const)('leaves the full snapshot unchanged on %j', async (patch, code) => {
    const before = await repository.load()
    await expect(executeTransfer(repository, request(patch))).rejects.toMatchObject({ code })
    expect(await repository.load()).toEqual(before)
  })

  it('replays the same key once across concurrent connections, even after the balance changes', async () => {
    const second = createIndexedDbBankingRepository(() => factory)
    const before = await repository.load()
    const [first, duplicate] = await Promise.all([
      executeTransfer(repository, request()),
      executeTransfer(second, request()),
    ])
    expect(duplicate).toEqual(first)
    expect((await repository.load()).transfers).toHaveLength(before.transfers.length + 1)
    await repository.update((state) => {
      state.accounts[0]!.balanceMinor = 0
      return state
    })
    expect(await executeTransfer(repository, request())).toEqual(first)
    const snapshot = await repository.load()
    await expect(executeTransfer(repository, request({ amountMinor: 2000 }))).rejects.toMatchObject(
      { code: 'IDEMPOTENCY_CONFLICT' },
    )
    expect(await repository.load()).toEqual(snapshot)
  })

  it('serializes competing spends against the current balance without an overdraft', async () => {
    await repository.update((state) => {
      state.accounts[0]!.balanceMinor = 1500
      return state
    })
    const results = await Promise.allSettled([
      executeTransfer(repository, request()),
      executeTransfer(
        createIndexedDbBankingRepository(() => factory),
        request({ idempotencyKey: 'request-2' }),
      ),
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: { code: 'INSUFFICIENT_FUNDS' },
    })
    expect((await repository.load()).accounts[0]!.balanceMinor).toBe(450)
  })

  it('aborts every change if storage fails after queuing the write', async () => {
    const before = await repository.load()
    const original = IDBObjectStore.prototype.put
    const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      ...args: Parameters<typeof original>
    ) {
      const result = original.apply(this, args)
      this.transaction.abort()
      return result
    })
    await expect(executeTransfer(repository, request())).rejects.toMatchObject({
      code: 'STORAGE_WRITE_FAILED',
    })
    put.mockRestore()
    expect(await repository.load()).toEqual(before)
  })

  it('rejects a destination overflow without debiting the source', async () => {
    await repository.update((state) => {
      state.accounts[1]!.balanceMinor = Number.MAX_SAFE_INTEGER
      return state
    })
    const before = await repository.load()
    await expect(executeTransfer(repository, request())).rejects.toMatchObject({
      code: 'BALANCE_OVERFLOW',
    })
    expect(await repository.load()).toEqual(before)
  })
})
