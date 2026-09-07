# 002 — Mock HTTP boundary and demo persistence

## Context

The work sample needs realistic data, filterable activity and balances that survive refresh, without requiring a banking backend. Transfers must update balances and activity together. The Nuxt revision also needs an explicit handoff to a compatible backend.

## Alternatives

- Component fixtures or in-memory stores have little setup but bypass HTTP errors and lose changes on reload.
- JSON Server or a small backend adds an installation/runtime requirement before a reviewer can use the demo.
- A localStorage JSON snapshot survives refresh, but separate read/modify/write calls can lose concurrent updates across tabs and block the main thread.
- Separate IndexedDB entity stores/indexes scale queries better, but complicate migrations and consistency for approximately 100 seed transactions.

## Decision

Use `Vue UI → BankingApi HTTP client → browser MSW → use cases → BankingRepository → IndexedDB`. Handlers parse and map HTTP; filtering, ownership projection and transfer execution stay in use cases. Seed data is deterministic and lives in `src/data/seed/createSeedState.ts`.

Persist one validated versioned snapshot in database `raksul-bank`, object store `banking-state`, key `current`. `load`, `update` and `reset` run in readwrite transactions so initialization cannot overwrite a concurrent update. An update reads the latest snapshot, applies a synchronous callback, validates and writes once, then resolves on transaction completion. Validation or storage failure aborts the transaction. Missing or incompatible snapshot data recovers to seed; read/open failures and newer database versions surface errors without deleting the database.

Demo queries start after hydration and worker startup. Backend mode disables MSW and forwards same-origin `/api/*` through Nitro to the private configured upstream, preserving the incoming request context. Backend SSR uses per-request query caches and private, no-store responses.

## Consequences

The reviewer needs no server beyond Nuxt. HTTP behavior, native persistence and SSR can be checked independently using Vitest/MSW, Chromium and a listening backend fixture. Snapshot reads and writes are acceptable at demo scale but should not be mistaken for an indexed production query engine.

IndexedDB serializes writes across connections to the same object store, but browser storage is local, user-editable and subject to browser-dependent durability/retention. Other tabs must refetch; there is no automatic cross-tab UI synchronization or cross-device persistence. Mock ownership filtering is not server-side authorization. A real integration must supply authentication, authorization, runtime contract validation and transactional persistence.
