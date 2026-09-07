# Nuxt migration and backend handoff

Revision: 2026-09-06, requested by the user. This document supersedes the previous standalone Vue/Vite setup. Earlier step reports retain their original verification evidence; their historical commands and framework constraints are not current instructions.

## Current architecture

The application runs Nuxt 4 with `ssr: true`, Vue 3, Vue Router 5, Nitro, Nuxt UI 4, Tailwind 4 and TanStack Vue Query. Domain rules, use cases, seed data and atomic IndexedDB persistence retain their existing contracts. There is no implemented production banking backend. Demo transfer execution and details/review/receipt are now implemented.

| Before                                          | Current                                                                                    |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `src/main.ts`, `index.html`, manual `createApp` | `src/app.vue`, Nuxt application startup                                                    |
| `src/app/router/index.ts`                       | `src/pages/index.vue`, `accounts.vue`, `transactions.vue`, `transfer.vue`, `[...slug].vue` |
| `src/app/layouts/BankingLayout.vue`             | `src/layouts/default.vue` with a slot                                                      |
| Router `afterEach` writes `document.title`      | Reactive `useHead` in `src/app.vue`; page metadata also renders on the server              |
| Module-global QueryClient                       | QueryClient created for each Nuxt application/SSR request                                  |
| Module-global HTTP client                       | Banking context injected per application/request                                           |
| Nuxt UI Vite/Vue application plugins            | `@nuxt/ui` Nuxt module and `src/app.config.ts`                                             |
| `VITE_ENABLE_MOCKS`, `.env.local`               | `NUXT_PUBLIC_ENABLE_MOCKS`, `.env` / deployment environment                                |
| Static `dist/`                                  | `.output/server/index.mjs` and `.output/public/`                                           |
| Manual app/node tsconfigs                       | Nuxt-generated app/server/shared/node project references                                   |
| `vite.config.ts` application config             | `nuxt.config.ts`; `vitest.vite.config.ts` only supports isolated tests                     |

`src/` is explicitly configured as Nuxt's `srcDir`. Root `server/` holds Nitro handlers. `@/` still points at `src/`, preserving the feature/domain/use-case/data/shared boundaries. ESLint continues to enforce framework-independent domain/use-case code and forbids repository/seed imports from UI.

## Demo mode

Default: `NUXT_PUBLIC_ENABLE_MOCKS=true`.

1. Nuxt renders navigation, page headings and loading states on the server.
2. The client begins with the same disabled-query state, preserving hydration consistency.
3. After `app:mounted`, the client loads MSW and starts the worker.
4. Queries become enabled only after startup; HTTP requests use the existing MSW/use-case/IndexedDB pipeline.
5. If worker startup fails, requests reach Nitro's explicit 503 demo-unavailable response and existing retry/error UI.

No IndexedDB access or Node MSW interception occurs during SSR. `src/data/mock/server.ts` is only a test helper. The database name, schema and seed remain unchanged, so migration does not delete stored demo data. The reset mutation still waits for committed storage, then invalidates banking queries. Other tabs still need to refetch.

## Backend mode and SSR

```dotenv
NUXT_PUBLIC_ENABLE_MOCKS=false
NUXT_API_BASE_URL=https://your-backend.example/api
```

The upstream root is private runtime config. The browser always calls same-origin `/api/*`; the Nitro handler maps that suffix and query string to the configured root. Server requests use Nuxt's `useRequestFetch` to preserve the current request context. The proxy forwards incoming cookies/authorization to the configured backend. It does not invent identity, obtain tokens, implement authorization or share credentials between requests.

`useAccounts`, `useBeneficiaries`, `useTransactions` and recent activity prefetch with `onServerPrefetch` in backend mode. The query plugin dehydrates completed success/error state into Nuxt's payload and hydrates it before the first client render. `ApiError` has a payload reducer/reviver; network failures normalize to that type. Reads have a 30-second stale time; SSR does not retry, the browser retries reads once, and mutations never auto-retry. Failed initial queries remain available for explicit retry instead of changing hydration output through an immediate mount retry.

The server QueryClient is created inside the plugin, serialized after rendering and cleared. Page/API responses have `Cache-Control: private, no-store`; do not introduce shared response caches for authenticated banking data. The reset UI is hidden and `/api/demo/*` returns 404 in backend mode. Missing backend configuration returns a structured 503. Unknown page routes return actual HTTP 404 responses.

Keep backend response shapes compatible with `src/contracts/transactions.ts`, `src/contracts/pagination.ts` and the domain models referenced by `src/contracts/banking.ts` and the endpoint/query tables in README. Success payloads remain trusted typed contracts; introduce runtime response validation when integrating an uncontrolled API. Customer ownership, permissions and transactional consistency must be enforced by the backend. Implement session login/refresh/logout and clear the banking query cache on identity changes when authentication is added. If backend SSR reads refresh cookies, explicitly propagate those cookies to the page response; the current bridge does not implement that session lifecycle. Transfer POST requests forward JSON bodies and their idempotency keys without automatic retries. A real backend must implement the documented request/receipt/error contract, server-side CSRF controls and idempotency.

## Commands and deployment

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run test -- --run
npm run build
npm run test:ssr
npm run preview
```

Node.js 24.14.0 and npm 11 remain pinned. `npm ci` runs `nuxt prepare`; Nuxt regenerates `.nuxt/` type declarations. Development normally uses port 3000. The smoke test starts disposable loopback backend/server processes and needs permission to bind local ports. It requires a completed build and stops its processes when finished.

Deploy `.output/` to a Node/Nitro-compatible host and run `npm start`, with `NUXT_PUBLIC_ENABLE_MOCKS=false` and `NUXT_API_BASE_URL` set in the server environment. The built server does not load `.env` automatically. `npm run preview` loads development configuration for local verification. Do not deploy the old `dist/` directory or turn off SSR to accommodate browser-only adapters. Domain/use cases remain reusable if a real backend is implemented separately or inside Nitro.

## Verification

- Clean lockfile install (`npm ci --offline` with the local npm cache), generated Nuxt types, typecheck, lint, formatting, production build and Git whitespace checks passed. Nuxt development startup and its SSR HTML response also passed.

- Unit/component suite: 153 tests passed after migration, including all existing domain, persistence, API and UI scenarios plus updated runtime configuration checks.
- Production SSR smoke: rendered account and recent transaction data; two concurrent cookie identities isolated; authorization/cookie forwarding; transaction query forwarding; invalid URL avoids transaction fetch; server error rendering/payload serialization; private cache headers; real HTTP 404; demo-only reset blocking; browser-only demo SSR; worker asset delivery; missing-backend error.
- Browser: Accounts populated through native MSW/IndexedDB, route navigation and transaction search worked, reload preserved `query=salary`, backend Accounts hydrated successfully, and no warning/error logs appeared in the inspected demo/backend pages.
- Isolated UI tests use real Nuxt UI primitives with a small routing/metadata adapter; they are not represented as full Nuxt runtime tests. The separate smoke and browser checks cover the actual Nuxt build.
- Historical tablet/mobile and transfer verification claims belong to the dated step reports; this migration does not implement or claim end-to-end transfer coverage.

## Shared contracts revision — 2026-09-06

`src/contracts/` is the common type boundary for UI, API adapters and use cases. Import each type from its defining module, without a client/use-case re-export:

- `transactions.ts`: `TransactionQuery` and `PaginatedTransactions`.
- `pagination.ts`: `Pagination`, used directly by the pagination component.
- `banking.ts`: `BankingApi`, implemented by `createBankingApi` and consumed by `BankingContext` without `ReturnType<typeof createBankingApi>`.

Contract files import only domain/contract types. ESLint disallows dependencies on implementation/UI layers, runtime imports and contract re-export barrels. Domain code cannot import contracts. Runtime query validation remains in the HTTP adapter; `ApiError` lives in `src/data/api/apiError.ts` and is shared directly by the client, error UI and Nuxt payload codec.

Domain entities and the privileged repository port/state remain in their owning layers. Do not publish complete persistence snapshots as API contracts. Keep fetch transport configuration with the adapter and feature-only form types inside their feature. This changes type ownership and import paths; HTTP shapes and SSR behavior stay the same.

Verification for this refactor: typecheck, lint, 153 unit/component tests, production build, SSR smoke, formatting and seven dependency-boundary checks passed.

## Next work

The transfer use case, HTTP endpoints and details/review/receipt UI are complete. Transfer request and receipt types live in `src/contracts/transfers.ts`. The SSR smoke suite also checks the transfer form, recipient prefetch, authenticated JSON POST forwarding, exact cents, rejection status and lack of automatic mutation retries. For new queries, use the injected banking context, honor readiness, add SSR prefetch, and avoid module-scoped user data. Real backend/auth integration remains a separate implementation task.

README and this migration document are versioned. The master handoff, earlier execution guides and recovered conversation notes remain ignored under the existing local documentation policy, and have also been updated locally.

References: [Nuxt plugins](https://nuxt.com/docs/4.x/directory-structure/app/plugins), [Nuxt server directory](https://nuxt.com/docs/4.x/directory-structure/server), [TanStack Query SSR](https://tanstack.com/query/latest/docs/framework/vue/guides/ssr).

## Optional enhancement integration

The frontend keeps Review read-only. New recipient details travel in the immutable transfer request, and Confirm creates the beneficiary atomically with the transfer only when `destination.saveRecipient` is true; false retains only the transfer snapshot. Omitted values preserve legacy save-by-default requests/fingerprints. Backends must support this flag and include its effective choice in idempotency checks. Saved contacts are selectable through a searchable menu. The standalone `POST /api/beneficiaries` contract remains available for a future explicit recipient-directory UI. Transfer drafts/request keys persist in customer/mode-scoped browser storage. A backend adapter must implement the documented recipient contract and idempotent transfers. Storage-event invalidation is enabled only for the IndexedDB demo; it is not backend realtime or cross-device synchronization. Nuxt color-mode provides the persisted light/dark preference. See [enhancement details](enhancements.md).

Same-bank recipient lookup uses `GET /api/recipient-accounts/:accountNumber` and returns `{ displayName, bankName, accountNumber, currency }` without balances or owner IDs. A compatible backend must verify active third-party account identity independently of the saved-contact list. Demo lookup exposes only fictional accounts; Other bank existence verification remains outside this mock.
