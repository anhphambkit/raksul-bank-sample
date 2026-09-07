# Testing the banking application

The suites exercise different boundaries. Keep the existing Vitest/MSW Node tests; browser coverage supplements them instead of replacing them. No production banking backend is needed to run these suites.

## Commands

Use Node 24 and npm 11. Install dependencies and Chromium once:

```sh
npm ci
PLAYWRIGHT_BROWSERS_PATH=.tools/playwright npx playwright install chromium --no-shell
```

Run the full suite:

```sh
PLAYWRIGHT_BROWSERS_PATH=.tools/playwright npm run test:all
```

Individual commands:

| Command                                                             | Coverage                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `npm run test -- --run`                                             | Existing Vitest domain, repository, HTTP client and component tests |
| `npm run test:ssr`                                                  | HTTP SSR/proxy checks; requires a current `npm run build` first     |
| `PLAYWRIGHT_BROWSERS_PATH=.tools/playwright npm run test:e2e`       | Build, then Chromium tests in demo and backend-fixture modes        |
| `PLAYWRIGHT_BROWSERS_PATH=.tools/playwright npm run test:e2e:built` | Chromium tests against the existing build                           |

If Chromium is installed at Playwright's default location instead, omit `PLAYWRIGHT_BROWSERS_PATH` consistently for both install and test. Linux CI may need `playwright install --with-deps chromium --no-shell` to install system dependencies.

Playwright starts production Nuxt processes and the HTTP fixture on dynamically allocated localhost ports, then closes them during teardown. Each test gets a new browser context, isolating cookies, Service Workers and IndexedDB. The suite uses Chromium with desktop, 768px tablet and 390px mobile viewports, one worker and no automatic retries. Failure screenshots, traces and the HTML report are ignored by Git in `test-results/` and `playwright-report/`.

## Test boundaries

| Suite                | Request path                                                      | Purpose                                                         |
| -------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| Vitest unit          | Pure function calls                                               | Money, validation and business rules                            |
| Vitest API/component | Node fetch → MSW `setupServer()` → handlers                       | Controlled HTTP and component behavior; existing tests retained |
| Demo browser         | Browser fetch → MSW `setupWorker()` → handlers → native IndexedDB | Real browser startup, interactions and persistence              |
| Backend fixture      | Browser/SSR → real Nuxt/Nitro → local HTTP API fixture            | Server rendering, forwarding and SSR cache hydration            |

`scripts/testing/environment.mjs` contains the HTTP fixture and Nuxt lifecycle helpers shared by `scripts/verify-ssr.mjs` and Playwright. This fixture is a listening HTTP server, unlike MSW's in-process `setupServer()` interceptor. It is test-only and is never imported by runtime code.

## Browser scenarios

`scripts/e2e/demo.spec.mjs` checks:

1. Initial demo HTML contains loading state, then MSW starts and accounts render without hydration mismatch; navigation and title work.
2. Transaction filtering updates results and URL, survives reload, and restores on Back/Forward.
3. Review does not submit; confirmation submits once, debits/credits exact cents, and creates two activity entries. Balances persist after reload. Confirmed reset restores the original accounts and survives another reload.

`scripts/e2e/core-qa.spec.mjs` checks the four pages at 1440/768/390px: keyboard navigation and focus, horizontal overflow, visible account-number masking, frozen source exclusion, filtered-empty recovery, and readable transfer review. Invalid submission must focus the enabled Amount input and associate the error message. Review alone must not change balances. These success paths also reject console errors; screenshots are saved for layout inspection.

`scripts/e2e/backend.spec.mjs` checks:

1. Customer-specific account data is present in the original HTML outside script payloads. Browser hydration and internal navigation reuse the fresh accounts cache without another accounts request. Explicit Refresh then performs a real request through Nitro.
2. SSR API errors survive payload serialization as `ApiError` (verified through the class-dependent message), do not trigger automatic retry on mount, and recover on explicit Retry after the fixture identity is changed.

All browser tests fail on uncaught page errors or logged hydration mismatches. Demo tests use the application's Service Worker, with no Playwright route mocks. The backend-mode test verifies no Service Worker was registered.

`scripts/e2e/transaction-detail.spec.mjs` checks the transaction drawer in both Transactions and Recent activity at 1440/768/390px. It verifies linked transfer identity, masked accounts, keyboard opening, focus containment, Escape/Close and return focus, width containment, preserved URL and no additional banking requests when opening details.

## Cases that browser MSW alone cannot verify

Browser MSW cannot intercept Nuxt's server-to-backend requests. These checks must exercise real Nuxt/Nitro against a backend, which can be the local HTTP fixture; a production backend is unnecessary.

| Case                                    | Assertion                                                                         | Implemented in                    |
| --------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| Data SSR waits for the API              | Account/recent-activity text exists in HTML outside scripts before browser JS     | SSR script + backend browser test |
| Per-request isolation                   | Concurrent Alpha/Beta requests never include the other customer's data            | SSR script                        |
| SSR cookie/authorization forwarding     | Fixture receives the incoming request's cookie and bearer header                  | SSR script + backend browser test |
| Nitro upstream path/query forwarding    | Configured `/bank/v1` prefix and transaction filters/pagination reach the fixture | SSR script                        |
| POST forwarding                         | Method, exact JSON body, idempotency key and auth context reach the backend once  | SSR script                        |
| Backend error forwarding                | Upstream 422 status and error code survive Nitro                                  | SSR script                        |
| SSR error rendering and payload revival | SSR shows error; browser restores `ApiError`, then explicit retry succeeds        | SSR script + backend browser test |
| SSR query-cache hydration               | Fresh SSR accounts are reused after hydration/navigation; Refresh refetches       | Backend browser test              |
| Private response caching                | Nitro applies `private, no-store` despite public cache headers from the fixture   | SSR script                        |
| No mutation during SSR                  | Rendering the transfer form issues no POST                                        | SSR script                        |
| Invalid query during SSR                | Invalid pagination renders feedback without requesting upstream transactions      | SSR script                        |

Related server-only checks also run in the SSR script: missing backend configuration returns 503; demo reset is blocked in backend mode; unknown pages return 404; the private upstream URL is absent from HTML; demo banking endpoints return 503 and the worker asset is served. These need a running Nuxt server but do not all require a responding upstream fixture.

Some corresponding UI behaviors can be tested with browser MSW (for example rendering a 422 error). Such tests do not verify that the real Nitro proxy forwarded the upstream status/body correctly.

## When the real backend is ready

The current fixture uses invented accounts and a test cookie to select scenarios; it is not real authentication or a full banking backend. Mock success proves FE behavior against the fixture, not that the backend conforms to the API contract.

Add a separate Playwright configuration/environment for the real test backend with `NUXT_PUBLIC_ENABLE_MOCKS=false` and `NUXT_API_BASE_URL` pointing to that backend. Supply test authentication and isolated, resettable data. Keep fixture assertions out of that suite; names and the fixture cookie are not real-backend contracts. Cover a small set of critical flows end to end, and retain deterministic fixture tests for failures and SSR boundaries. Do not run the demo reset endpoint against a real backend.
