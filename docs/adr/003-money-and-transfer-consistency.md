# 003 — Money representation and transfer consistency

## Context

A transfer affects balances, activity and a receipt. Rounding, stale balance checks or duplicate confirmation must not create inconsistent state. The demo supports USD own-account and saved-recipient transfers that complete within one request.

## Alternatives

- Floating-point major units are convenient for input but can introduce rounding during arithmetic.
- Decimal strings everywhere avoid binary rounding but complicate arithmetic; a decimal library is unnecessary for fixed two-decimal USD amounts at this scale.
- BigInt in every API field would require a custom JSON contract. Safe integer cents meet the demo's range while BigInt can still sum account balances for display.
- Loading a snapshot, validating it and saving later permits stale competing spends. Disabling the Confirm button alone cannot prevent duplicate HTTP requests.
- A ledger and distributed settlement workflow could model real payments but would exceed the synchronous mock scope.

## Decision

Persist safe integer minor units and reject nonpositive, fractional or unsafe transfer amounts. `MoneyInput` parses decimal text exactly; formatting is separate from arithmetic. Validate ownership, account usability, currency, sufficient funds and destination overflow against the current snapshot inside `executeTransfer`'s repository update callback.

Within one IndexedDB readwrite transaction, debit the source, credit an own/internal recipient when applicable, add linked activity and store the completed transfer. External recipients have a stored identity snapshot and a source debit only. Resolve success only after commit; rejection or abort leaves the previous committed state intact.

Prepare a normalized request fingerprint before entering the synchronous callback. Persist the idempotency key/fingerprint with the transfer: the same key/payload returns the original receipt; changed payload conflicts without mutation. Copy caller input before hashing. Do not automatically retry mutations. The UI retains the exact request/key for explicit retries after an uncertain response and invalidates account/activity queries after success.

## Consequences

Balances and resulting activity commit together, and competing connections validate against the latest committed balance. Tests cover own/internal/external transfers, invalid requests, duplicate replay, conflicting keys, overdraft prevention and rollback after a queued write aborts.

The safe integer limit is explicit; currencies with different minor units, fees and FX are unsupported. Completed here means committed in the demo, not settled over payment rails. A forcibly closed page loses its in-memory retry key; reset removes persisted transfers and idempotency records. Production needs durable recovery, authenticated key scoping, a transactional database and a reconciliation model.
