# Raksul-bank — 10-minute walkthrough

This is a time-boxed presentation guide for a technical review. Keep the live demo on the happy path, then use the remaining time to explain the consistency and architecture decisions that distinguish the implementation.

## 0:00–1:00 — Frame the problem and scope

- The assignment has four Core outcomes: understand accounts, locate transactions, transfer funds and keep deliberate mock data consistent.
- This implementation assumes one authenticated fictional customer. It does not claim to implement production authentication, settlement or payment rails.
- I completed Core first, then added focused depth: transaction details, production architecture, browser tests, recovery, Storybook and visual regression.

Opening line:

> Raksul-bank is a customer-facing Nuxt banking dashboard designed around one invariant: after any transfer attempt, balances, activity and the reported outcome must never contradict one another.

## 1:00–3:30 — Demonstrate the customer journeys

### Accounts and overview

1. Open **Overview** and point out the total, active and frozen balance distinction.
2. Open **Accounts** and show masked identifiers and disabled transfer actions for frozen accounts.
3. Mention loading, error, empty and reset states without spending time forcing each one.

### Transactions

1. Search for a known description or counterparty.
2. Combine account/status/date filters and apply them.
3. Refresh or use Back/Forward to show that applied state lives in the URL.
4. Open a transaction detail drawer and close it with Escape to demonstrate focus restoration.

### Transfer

1. Choose an active source and either another owned account or **Someone else → Saved recipient**. Search for Alex Rivera to try a same-bank payment without entering account details. For manual same-bank entry, Alex’s demo account number is `200000001842`.
2. Enter an exact decimal amount, review the masked details and confirm.
3. Follow the receipt to activity or accounts and show the updated state.

## 3:30–5:30 — Explain the architecture

```text
Demo: Vue UI → BankingApi → MSW → use case → repository port → IndexedDB
Backend: Nuxt SSR/browser → BankingApi → Nitro /api/* → configured banking API
```

- Feature folders own interaction and presentation; domain modules own money and transfer rules.
- Use cases depend on a repository port, not Vue, HTTP, MSW or IndexedDB.
- TanStack Vue Query owns API state, Vue Router owns applied transaction filters, and local Vue state owns transient UI edits.
- ESLint makes the important dependency directions executable rather than relying only on documentation.
- The single IndexedDB snapshot is a deliberate demo-scale trade-off: it makes atomic consistency straightforward, while a production design would use a transactional database and ledger postings.

## 5:30–7:30 — Defend transfer consistency

- Money is stored as safe integer cents; editable decimal text is parsed exactly rather than using floating-point arithmetic.
- Validation and balance mutation run against the latest snapshot inside one readwrite transaction.
- A successful own/internal transfer writes the debit, credit, linked activity and transfer record together. Any thrown validation or storage error aborts all of it.
- Every request has an idempotency key and normalized SHA-256 fingerprint. Replaying the same key and payload returns the original receipt; reusing the key with different details conflicts.
- A lost response is not presented as a failed payment. The UI retains the exact request for an explicit same-key retry and never retries a financial mutation automatically.

## 7:30–8:30 — Show verification evidence

- Strict TypeScript, ESLint architecture rules, Prettier and production build form the static gate.
- Unit/integration tests cover money boundaries, ownership, query behavior, atomic rollback, concurrent updates and idempotency.
- SSR smoke verifies request isolation and the backend bridge.
- Chromium E2E covers the real journeys at desktop, tablet and mobile widths; separate Storybook and visual suites cover component states and theme regressions.
- CI reproduces the reviewer-facing quality gate from a clean checkout.

Use current command output or `docs/verification.md` for counts rather than memorizing a number that may become stale.

## 8:30–9:30 — State trade-offs and production gaps

- Authentication and authorization are intentionally absent from the demo. A production Nuxt boundary must manage an OIDC session, derive trusted upstream credentials and apply CSRF controls.
- Successful backend responses should receive runtime contract validation before integrating an uncontrolled API.
- Browser recovery contains fictional account snapshots and is unsuitable for real customer data; production recovery belongs server-side and must be session-scoped.
- IndexedDB is user-editable and has browser-dependent durability. It is not a banking database, audit log or ledger.
- External transfers complete immediately only because this is a mock. Production requires pending/settled/failed/reversed states, an outbox and reconciliation.

## 9:30–10:00 — Close

Closing line:

> The submission intentionally goes deepest on transfer correctness and observable trade-offs. The UI meets the Core journeys, while the boundaries make clear which guarantees belong to this demo and which must move to authenticated backend infrastructure.

Invite questions on the three decisions documented in the ADRs: feature-oriented boundaries, mock persistence and monetary consistency.

## Likely follow-up questions

### Why not Pinia?

Vue Query already owns asynchronous API state and invalidation. Router state and local component state cover the remaining requirements; Pinia would create another source of truth without a genuine global client-state need.

### Why one IndexedDB snapshot?

At roughly 100 transactions it keeps read–validate–write atomic and easy to reason about. Separate indexed stores would improve scale, but would add migration and cross-store consistency complexity that the demo does not need.

### Why SSR when demo data is browser-local?

Demo SSR intentionally renders a safe loading shell. The same UI can prefetch customer-specific data when configured with a compatible backend, and the query cache is created per request to prevent cross-user leakage.

### What would you cut with only one day?

Keep the three Core journeys, exact money arithmetic, atomic transfer consistency, run instructions and ADRs. Cut Storybook, visual regression, dark mode, cross-tab recovery and the backend SSR handoff first.

### What are the first production changes?

Add authenticated server-managed sessions and resource authorization; replace browser persistence with transactional ledger-backed storage and server-side idempotency; then model asynchronous settlement, durable recovery and audit/reconciliation.
