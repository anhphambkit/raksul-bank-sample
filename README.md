# Raksul-bank

A personal banking dashboard built with Nuxt 4, Vue 3 and TypeScript. It uses a mock HTTP API and browser-local IndexedDB persistence, with fictional data and no real banking connection.

## What I Built

- Accounts and Overview with owned accounts, masked account numbers, USD balances, active/frozen status and recent activity.
- Transaction explorer with text, account, direction, type, status and inclusive UTC date filters, API pagination and URL state.
- Responsive navigation, keyboard focus management, loading/error/retry/empty states and confirmed demo reset.
- Typed API client and MSW handlers for customer, accounts, transaction queries, beneficiaries and reset.
- Deterministic seed data, validated persistence and atomic repository updates.
- Exact integer-cent arithmetic and pure transfer validation.

Transfer execution is not implemented yet. Its route currently displays a placeholder.

## Deliberately Left Out

Real authentication, authorization, OTP/MFA, currency conversion, fees, scheduled transfers, overdraft, payment rails, settlement, fraud detection and ledger reconciliation are outside this demo's scope. There is no implemented production banking backend or real customer data; the Nitro API boundary is ready to connect to a compatible backend.

## Technology Stack

Nuxt 4 (SSR with Nitro), Vue 3, strict TypeScript, Nuxt file-based routing (Vue Router 5), Nuxt UI 4, Tailwind CSS 4, TanStack Vue Query, Zod, MSW and IndexedDB. Tests use Vitest, Vue Test Utils and fake-indexeddb.

Dependencies are pinned in `package-lock.json`. Nuxt owns application startup, routing, layouts, head metadata and server rendering. Vite is used internally by Nuxt and separately for isolated component tests.

## Getting Started

Use Node.js 24.14.0 (pinned in `.nvmrc`) and npm 11.

```bash
nvm install
nvm use
npm ci
npm run dev
```

Open the URL printed by Nuxt, normally `http://127.0.0.1:3000`. `npm ci` runs `nuxt prepare` to generate Nuxt types.

To preview the production Node/Nitro server:

```bash
npm run build
npm run preview
```

No API keys or database server are required for the default demo. Copy `.env.example` to `.env` to override settings. `NUXT_PUBLIC_ENABLE_MOCKS=true` enables browser MSW and IndexedDB. Nuxt renders the shell and loading states on the server; demo queries start after hydration and worker startup because browser-local data cannot be read during SSR.

For backend integration and data SSR:

```dotenv
NUXT_PUBLIC_ENABLE_MOCKS=false
NUXT_API_BASE_URL=https://your-backend.example/api
```

The upstream root includes the backend API prefix. Both browser and SSR calls use `/api/*`; Nitro forwards them to that root, preserving query strings and the incoming cookie/authorization context. The upstream URL stays server-only. Accounts, recent activity and valid transaction queries are prefetched during SSR and hydrated into a request-local Vue Query cache. Reset is hidden and its server endpoint is blocked in backend mode.

Restart development/preview after changing `.env`. For deployment, set runtime environment variables and run `npm start` after building; the built server does not load `.env` itself. `PORT`/`HOST` (or Nitro equivalents) configure its listener. Use a Node/Nitro-capable host, not a static `dist/` upload. Serve over HTTPS in deployment. Missing backend configuration returns an explicit 503. Changing modes does not delete existing IndexedDB demo data.

See [Nuxt migration and backend handoff](docs/nuxt-migration.md) for contracts, SSR boundaries and verification.

## Available Scripts

| Command                 | Purpose                                                   |
| ----------------------- | --------------------------------------------------------- |
| `npm run dev`           | Start the local development server.                       |
| `npm run build`         | Typecheck and build Nitro into `.output/`.                |
| `npm run preview`       | Preview the production server locally.                    |
| `npm run typecheck`     | Check application and tooling types.                      |
| `npm run lint`          | Run ESLint.                                               |
| `npm run format:check`  | Check Prettier formatting.                                |
| `npm run test -- --run` | Run the unit/component suite once.                        |
| `npm run test:ssr`      | Verify the built SSR server with a local backend fixture. |
| `npm start`             | Run `.output/server/index.mjs` in deployment.             |

## Architecture Overview

```text
Demo: Nuxt UI → typed API client → browser MSW → use case → repository port → IndexedDB
Backend: Nuxt SSR/browser → typed API client → Nitro /api/* → configured backend
```

| Directory                          | Responsibility                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `src/app.vue`, `src/app.config.ts` | Nuxt root and UI theme configuration.                                          |
| `src/app/config/`                  | Validated runtime configuration.                                               |
| `src/layouts/`, `src/plugins/`     | Nuxt layout, request-scoped API/query plugins and payload codecs.              |
| `server/api/`                      | Same-origin backend forwarding boundary.                                       |
| `src/pages/`                       | Nuxt file-based route pages.                                                   |
| `src/features/`                    | Account and transaction components/queries, recent activity and demo reset.    |
| `src/domain/`                      | Banking entities, money, masking and pure transfer rules.                      |
| `src/use-cases/`                   | Repository contract, customer scoping and transaction queries.                 |
| `src/data/`                        | HTTP client, MSW handlers, seed, persistence validation and IndexedDB adapter. |
| `src/shared/`                      | Theme, async states, money display and masked account numbers.                 |
| `src/tests/`                       | Domain, data/API and component tests.                                          |
| `docs/adr/`                        | Architecture decision records.                                                 |

MSW translates HTTP requests and responses. Use cases own customer scoping and filtering. Vue components do not import repositories or seed data. Domain code is independent of Vue, HTTP and persistence. ESLint checks these import boundaries.

## Data Model

The seed contains one fictional customer, three owned accounts (active checking, active savings and frozen checking), two hidden internal recipient accounts, six beneficiaries, 100 transactions across March–August 2026 and six completed own-account transfers.

| Entity              | Main fields and relationships                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer            | ID and names; owns accounts and beneficiaries.                                                                                              |
| Account             | ID, owner, display name, type, account number, USD currency, balance in cents, active/frozen status and creation timestamp.                 |
| Transaction         | ID, account ID, optional transfer ID, direction, type, positive amount in cents, currency, status, description, counterparty and timestamp. |
| Beneficiary         | ID, customer ID, name, bank, account number, currency and optional internal account ID.                                                     |
| TransferDestination | An owned account, an internal recipient account with a recipient snapshot, or an external recipient snapshot.                               |
| Transfer            | ID, idempotency key, request hash, source, destination, amount, currency, reference, status and timestamps. Execution is pending.           |

Money uses safe integer minor units: `$10.50` is `1050` cents. Transaction direction supplies the debit/credit sign. Aggregate balances use BigInt, and formatting preserves exact cents. Account numbers are masked in the visible UI.

Seed balances reconcile to fixed opening balances plus completed activity. Pending and failed entries do not change balances. Total balance includes frozen accounts; active and frozen balances are shown separately. There is no holds or overdraft model.

## Mock API

| Method | Endpoint                   | Response                                            |
| ------ | -------------------------- | --------------------------------------------------- |
| GET    | `/api/customer`            | Current customer.                                   |
| GET    | `/api/accounts`            | Customer-owned accounts, including frozen accounts. |
| GET    | `/api/accounts/:accountId` | Owned account or 404.                               |
| GET    | `/api/transactions`        | Filtered activity and pagination.                   |
| GET    | `/api/beneficiaries`       | Current customer's beneficiaries.                   |
| POST   | `/api/demo/reset`          | 204 after restoring the seed.                       |

Transaction queries accept `accountId`, `query`, `direction`, `type`, `status`, `dateFrom`, `dateTo`, `page` and `pageSize`. Dates are inclusive UTC calendar dates. Results are scoped before filtering/counting and sorted newest first. Pagination defaults to 20 entries; the maximum page size is 100.

The client passes cancellation signals to fetch and surfaces structured API errors. In demo mode, MSW starts after hydration and before API queries are enabled. Unhandled `/api/` requests fail visibly. Successful response types are trusted contracts of the controlled mock API, not independently validated client payloads.

## Transaction Explorer

Open Transactions to browse activity, newest first. Search matches descriptions, counterparties and transaction IDs. Combine it with account, direction, type, status and date filters, then select **Apply filters**. **Clear filters** restores all activity. Frozen accounts remain available for reviewing past activity.

Applied filters and pagination live in the URL; refreshing, sharing the link and Back/Forward restore that view. The form holds only unapplied edits. Applying filters or changing page size returns to page 1. The UI renders the API page directly without filtering or paginating a local copy of the dataset.

The page distinguishes initial loading, API errors with retry, an empty dataset, no matching results and an out-of-range page. Invalid URL values require correction before fetching transactions. Desktop uses a table; smaller screens use stacked activity rows with signed, right-aligned amounts and explicit direction/status labels.

## Persistence and State

The IndexedDB database `raksul-bank` stores one versioned snapshot in object store `banking-state`, key `current`. It includes the customer, accounts, transactions, transfers and beneficiaries. Zod validates its structure and relationships.

The repository initializes missing data and recovers structurally invalid or incompatible snapshots to the seed. Read/open failures surface without resetting data. Write failures and transaction aborts preserve the previous committed state. A newer database version produces an open error instead of being deleted.

`load()`, `update(change)` and `reset()` are asynchronous. An update reads the latest snapshot and applies a synchronous callback within one IndexedDB readwrite transaction; it resolves only after commit. The callback must use that snapshot for checks and must not perform network or storage side effects. IndexedDB serializes these transactions across connections to the same object store.

TanStack Vue Query manages API state with a 30-second stale time, one query retry and no mutation retries. Reset cancels in-flight banking queries, awaits persistence and invalidates the cache. Other tabs still need to refetch; there is no push synchronization or cross-device persistence.

## Transfer Semantics

Pure validation currently checks positive safe amounts, source ownership and usability, sufficient funds, destination identity and usability, same-account rejection, currency compatibility, recipient fields and balance overflow. It does not mutate state.

Planned execution: own-account and internal transfers debit the source, credit the destination and create linked debit/credit activity. External transfers debit the source and create one source transaction. Validation failures must leave state unchanged; matching idempotent requests must return the previous result. Transfer orchestration, HTTP endpoints and the form/review/result workflow are not implemented yet.

## Testing

The unit/component suite covers domain, data/API, runtime configuration and UI behavior. Run `npm run test -- --run` for the current count; run `npm run build && npm run test:ssr` for production SSR integration checks.

Coverage includes exact money conversion and bounds, transfer validation, masking, deterministic seed reconciliation, ownership scoping, query validation/filtering, persistence reload/reset, corruption recovery, rollback, concurrent updates, API errors, and UI loading/error/retry/empty/reset states. Transaction tests also cover combined filters through HTTP, URL restoration, Back/Forward, pagination, invalid dates/URLs, empty results, retry and stale-response isolation. Isolated component tests render real Nuxt UI components with Vue Router, Vue Query and MSW, using a small Nuxt routing/metadata adapter. The separate SSR check runs the built Nuxt/Nitro application.

Manual browser checks cover desktop/tablet/mobile layouts, navigation, reset, native IndexedDB/API integration and large-balance wrapping. End-to-end transfer execution has not been tested because it is not implemented.

## Known Limitations

Transfer execution remains incomplete. Architecture decision records are not yet written. IndexedDB data is user-editable and subject to browser storage retention limits; the ownership projection in the mock API is demo scoping, not server-side authorization.

## Production Considerations

A production banking system would require server-side authentication/authorization, transactional persistence, auditability, backups and real payment integration. The browser demo does not provide those guarantees.
