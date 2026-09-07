# 001 — Feature-oriented Vue architecture and state management

## Context

Accounts, transaction search and transfers share banking rules but have different interaction state. Nuxt 4 must render a safe shell for browser-local demo data and customer-specific HTML when a backend is configured. These modes should use the same feature components.

## Alternatives

- Technical folders only (`components`, `services`, `utils`) are simple initially, but scatter a transfer change across unrelated files.
- Feature-only folders keep UI changes together but duplicate money rules and couple persistence to pages.
- Full Clean Architecture with a service/interface for every operation adds indirection without a second production adapter to justify it.
- Putting API data in Pinia would require custom loading, deduplication, invalidation and SSR hydration alongside Vue Query. It would create competing sources of truth.

## Decision

Use feature-oriented Vue components/composables plus shared `domain`, `use-cases`, `data`, `contracts` and `shared` boundaries. Nuxt pages/layouts/plugins compose them; Nitro owns backend forwarding. Domain code is framework-independent, use cases depend on a repository port, and contracts import domain/contract types only. ESLint checks these boundaries.

TanStack Vue Query owns remote account/activity/beneficiary state. Create its client and API context inside each Nuxt application/request, prefetch backend queries during SSR and hydrate the result. Vue Router owns applied transaction filters and pagination; local refs/reactive objects own edits, drawer/menu state and transfer drafts. UForm/Zod validates forms. Nuxt UI and Tailwind supply presentation primitives. No global UI requirement currently needs Pinia.

## Consequences

Transfer rules can be tested without Vue; browser and SSR paths share typed contracts and feature UI. The boundaries add a few explicit imports but avoid generic service wrappers. SSR requires a payload codec for `ApiError`, readiness-aware queries and a request-local cache. Demo data cannot be rendered during SSR. Transfer drafts remain memory-only, and every successful mutation must invalidate related queries. Authentication would also require clearing caches on identity changes; it is not implemented.
