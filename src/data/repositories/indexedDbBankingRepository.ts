import {
  RepositoryError,
  type BankingRepository,
  type PersistedBankingState,
} from '../../use-cases/ports/BankingRepository'
import { createSeedState } from '../seed/createSeedState'
import { bankingStateSchema } from './bankingStateSchema'

export const BANKING_DATABASE_NAME = 'raksul-bank'
export const BANKING_DATABASE_VERSION = 1
export const BANKING_OBJECT_STORE = 'banking-state'
export const BANKING_STATE_KEY = 'current'

function validateState(value: unknown): PersistedBankingState {
  const parsed = bankingStateSchema.safeParse(value)
  if (!parsed.success) {
    throw new RepositoryError('INVALID_STATE', 'The banking state is invalid; nothing was saved.')
  }
  return parsed.data
}

/** Lazy browser access also allows importing this module in Node without IndexedDB. */
export function createIndexedDbBankingRepository(
  getFactory: () => IDBFactory = () => globalThis.indexedDB,
): BankingRepository {
  function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest
      let cancelled = false
      const openError = () =>
        new RepositoryError(
          'STORAGE_OPEN_FAILED',
          'Demo storage could not be opened. Check browser storage availability or reload the app.',
        )
      try {
        request = getFactory().open(BANKING_DATABASE_NAME, BANKING_DATABASE_VERSION)
      } catch {
        reject(openError())
        return
      }
      request.onblocked = () => {
        cancelled = true
        reject(
          new RepositoryError(
            'STORAGE_BLOCKED',
            'Another tab is blocking demo storage. Close older tabs and try again.',
          ),
        )
      }
      request.onerror = () => reject(openError())
      request.onupgradeneeded = () => {
        // A blocked open cannot be cancelled directly. Abort any later upgrade.
        if (cancelled) {
          request.transaction?.abort()
          return
        }
        if (!request.result.objectStoreNames.contains(BANKING_OBJECT_STORE)) {
          request.result.createObjectStore(BANKING_OBJECT_STORE)
        }
      }
      request.onsuccess = () => {
        const database = request.result
        if (cancelled) {
          database.close()
          return
        }
        database.onversionchange = () => database.close()
        if (!database.objectStoreNames.contains(BANKING_OBJECT_STORE)) {
          database.close()
          reject(openError())
          return
        }
        resolve(database)
      }
    })
  }

  async function transact(
    mode: 'load' | 'update' | 'reset',
    change?: (current: PersistedBankingState) => PersistedBankingState,
  ): Promise<PersistedBankingState> {
    const database = await openDatabase()
    try {
      return await new Promise<PersistedBankingState>((resolve, reject) => {
        let transaction: IDBTransaction
        let failure: unknown
        let result: PersistedBankingState
        let phase: 'read' | 'write' = mode === 'reset' ? 'write' : 'read'
        const storageError = () =>
          new RepositoryError(
            phase === 'read' ? 'STORAGE_READ_FAILED' : 'STORAGE_WRITE_FAILED',
            phase === 'read'
              ? 'Demo data could not be read. Try again.'
              : 'Demo data could not be saved. Check browser storage availability and try again.',
          )
        try {
          // Even load may initialize/recover. Serializing readwrite transactions
          // prevents concurrent first loads from replacing a just-committed update.
          transaction = database.transaction(BANKING_OBJECT_STORE, 'readwrite')
        } catch {
          reject(storageError())
          return
        }
        transaction.oncomplete = () => resolve(result)
        transaction.onabort = () => reject(failure ?? storageError())
        const abort = (error: unknown) => {
          failure = error
          transaction.abort()
        }
        const store = transaction.objectStore(BANKING_OBJECT_STORE)
        const persist = (next: unknown) => {
          result = validateState(next)
          phase = 'write'
          try {
            store.put(result, BANKING_STATE_KEY)
          } catch {
            abort(storageError())
          }
        }
        if (mode === 'reset') {
          try {
            persist(createSeedState())
          } catch (error) {
            abort(error)
          }
          return
        }
        let request: IDBRequest<unknown>
        try {
          request = store.get(BANKING_STATE_KEY)
        } catch {
          abort(storageError())
          return
        }
        // Request errors automatically abort. Only a successful read of invalid
        // data permits recovery; access/I/O errors never trigger a reset.
        request.onsuccess = () => {
          try {
            const parsed = bankingStateSchema.safeParse(request.result)
            const current = parsed.success ? parsed.data : createSeedState()
            if (change) {
              // Invoke synchronously while IndexedDB's request event is active.
              // Returning a Promise also fails runtime state validation.
              persist(change(current))
            } else if (!parsed.success) {
              persist(current)
            } else {
              result = current
            }
          } catch (error) {
            abort(error)
          }
        }
      })
    } finally {
      database.close()
    }
  }

  return {
    load: () => transact('load'),
    update: (change) => transact('update', change),
    reset: () => transact('reset'),
  }
}
