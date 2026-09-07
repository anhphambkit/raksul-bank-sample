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

Within one IndexedDB readwrite transaction, resolve the recipient and save a new contact only with the user’s explicit opt-in, debit the source, credit an own/internal recipient when applicable, add linked activity and store the completed transfer. External recipients have a stored identity snapshot and a source debit only. Review performs no mutation. Resolve success only after commit; rejection or abort leaves the previous committed state—including beneficiaries—intact.

Prepare a normalized request fingerprint before entering the synchronous callback. Persist the idempotency key/fingerprint with the transfer: the same key/payload returns the original receipt; changed payload (including the effective save-recipient choice) conflicts without mutation. Legacy requests with no save flag retain their original save-by-default fingerprint; the current form sends an explicit boolean. Copy caller input before hashing. Do not automatically retry mutations. Idempotency conflicts are terminal and link to activity, with their status preserved in recovery storage. The UI retains the exact request/key for explicit retries after an uncertain response and invalidates account/activity queries after success.

## Consequences

Beneficiaries, balances and resulting activity commit together, and competing connections validate against the latest committed balance. Tests cover own/internal/external transfers, new-recipient atomicity, invalid requests, duplicate replay, conflicting keys, overdraft prevention and rollback after a queued write aborts.

The safe integer limit is explicit; currencies with different minor units, fees and FX are unsupported. Completed here means committed in the demo, not settled over payment rails. Before confirmation, persist the exact draft/key locally; opening Transfer after a forced close restores an explicit same-key retry, never an automatic payment. Storage failure blocks confirmation. Web Locks serialize browser confirmations where available, and another unresolved request cannot be overwritten. Reset clears recovery records as well as transfers/idempotency records; a generation check rejects stale post-reset drafts. Browser storage can still be cleared or evicted. Production needs durable recovery, authenticated key scoping, a transactional database and a reconciliation model.
