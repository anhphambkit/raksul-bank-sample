# Work sample acceptance evidence

Reviewed against the original four Core requirements and five deliverables on 2026-09-07. PASS means implemented and verified within the documented mock scope; it does not imply a production banking backend. Every Core and deliverable item passed before adding the optional architecture proposal or transaction detail view.

## Final checklist — 2026-09-07

The original assignment defines acceptance. Suggested seed counts, filter dimensions, recipient-entry UI and ADR topics are implementation guidance, not additional mandatory requirements. The implementation uses 100 seed transactions and saved/new recipients; an internal recipient models another person's account and receives the matching credit.

### Core — product and data

- [x] Accounts: all three owned accounts show identity/type, masked number, USD balance and active/frozen usability; hidden recipient accounts stay outside the customer projection.
- [x] Activity: 100 deterministic transactions across six months, varied amounts, counterparties, debit/credit directions and statuses.
- [x] Locate activity: text/account/direction/type/status/date filters, Apply/Clear, no-results recovery, pagination and URL restoration without mutating source data.
- [x] Own transfer: select source/destination, amount and reference; validate, review, confirm and receive a committed receipt.
- [x] Another-person transfer: saved internal recipient gets a hidden credit and linked activity; saved external recipient produces a source debit and recipient snapshot, with external settlement outside the mock.
- [x] Validation: missing or unowned source, unavailable recipient, frozen accounts, same account, nonpositive/fractional/unsafe amount, insufficient funds, incompatible currency and destination overflow are rejected.
- [x] Consistency: debit/credit/activity/receipt commit together; failed validation or an aborted write leaves the previous snapshot intact.
- [x] Feedback: pending/disabled confirmation, validation messages, definite rejection, success and uncertain technical outcome with explicit same-key retry.
- [x] UI consistency: successful transfer cancels stale requests and invalidates banking queries; balances/activity persist across navigation, reload and reset.
- [x] Data boundary: typed API → MSW → use cases/domain → repository; no component-owned banking fixtures or direct balance/storage mutations.
- [x] Model: ownership, account/transaction/transfer relationships, recipient snapshots and statuses are explicit; money uses safe integer cents.

### Required deliverables

- [x] Working local application, pinned runtime/lockfile and install/run/build instructions; seed and mock mechanism are versioned.
- [x] README explains what was built, deliberate omissions, model/relationships, assumptions, transfer semantics and persistence limits.
- [x] Exactly three ADRs, each with Context, Alternatives, Decision and Consequences, consistent with the implementation.

### Senior quality checks

- [x] Feature/domain/data separation, strict typed contracts, structured errors and lint-enforced dependency direction.
- [x] Loading/error/retry/empty states, currency/date formatting, explicit status labels and basic keyboard/form accessibility.
- [x] Responsive browser checks at 1440/768/390px, including masking, overflow, transfer review and detail-drawer focus.
- [x] Duplicate confirmation/replay cannot double-debit; competing writes check current funds; rollback is covered.
- [x] Nuxt demo shell waits for browser storage readiness; backend SSR uses request-local queries, error serialization and cache hydration without duplicate accounts fetching in the tested flow.
- [x] No console debug logs, TODO/FIXME markers or explicit `any` types found in the inspected runtime/test source; automated lint and browser checks pass.

### Nice-to-Have — completed

- [x] Add/save recipients through HTTP with validation and atomic deduplication; selected immediately and persisted for transfers.
- [x] Save and restore draft/review/immutable retry key after close/reload, with explicit same-key replay and storage-failure protection.
- [x] Same-origin demo tabs refresh automatically after committed changes/reset; reset clears recovery context.
- [x] Persistent light/dark mode with responsive theme styling and hydration-safe toggle.
- [x] Storybook catalog: 11 component states, checked in both light/dark themes.
- [x] Visual regression: 12 reviewed macOS Chromium baselines across light/dark and desktop/mobile.

- [x] High-value domain/service tests: own/internal/external balances and activity, invalid requests, rollback, idempotency and concurrent spending.
- [x] Transaction filtering/API/component tests and a native-browser transfer → receipt → balance/activity → reload/reset scenario.
- [x] Individual transaction drawer, including keyboard focus and preserved filter/page state.
- [x] Production architecture proposal covering client, Banking API, identity, database and communication flow; infrastructure remains proposal-only.

### Not implemented / intentionally deferred

- [ ] Optional features: authentication and spending insights.
- [ ] Broader verification: Firefox/WebKit and real mobile devices; current browser evidence is Chromium with resized viewports.
- [ ] Cross-device synchronization: explicitly deferred by the user; no shared backend was added.
- [ ] Real backend/authentication/authorization, FX, fees, settlement and production payment processing; excluded from this mock work sample.

No outstanding Core or required-deliverable defect was identified in this review. The unchecked items above are optional scope or documented demo limitations, not unfinished required functionality.

## Core and required deliverables

| Requirement                                            | Result | Repository evidence                                                                                                                                                                                                                                            | Remaining issue                                                                                           |
| ------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Accounts: identify each owned account                  | PASS   | `src/features/accounts/components/AccountCard.vue` shows name, type and masked number; `src/use-cases/accounts/selectCustomerAccounts.ts` excludes hidden recipient accounts.                                                                                  | None within demo scope.                                                                                   |
| Accounts: value and usability                          | PASS   | `AccountCard.vue`, `AccountSummary.vue`, `AccountStatusBadge.vue`; frozen balance is explicit, and frozen sources/destinations are unavailable in transfer controls. `src/tests/ui/accounts.test.ts` and browser QA cover these states.                        | None within demo scope.                                                                                   |
| Transactions: review activity among many               | PASS   | `src/data/seed/createSeedState.ts` supplies 100 deterministic entries over six months. `TransactionTable.vue` and `TransactionPagination.vue` render API pages.                                                                                                | None within demo scope.                                                                                   |
| Transactions: locate a transaction with filters        | PASS   | `transactionQuerySchema.ts`, `listTransactions.ts`, `useTransactionRoute.ts`, `TransactionFilters.vue`; HTTP/UI tests cover combined filters, UTC dates, pagination, invalid links, empty results and Back/Forward.                                            | None within demo scope.                                                                                   |
| Transfers: move money between own accounts             | PASS   | `src/use-cases/transfers/executeTransfer.ts` debits/credits both accounts and creates two linked entries; `executeTransfer.test.ts` and `scripts/e2e/demo.spec.mjs` verify exact persisted cents.                                                              | None within demo scope.                                                                                   |
| Transfers: send to another person                      | PASS   | Saved internal and external beneficiary paths in `executeTransfer.ts`, `TransferDetailsForm.vue`; `executeTransfer.test.ts`, `transferApi.test.ts` and `transferFlow.test.ts` cover recipient identity, scoped activity and source/destination changes.        | External balances and real settlement are deliberately outside the system.                                |
| Transfers: validate requests                           | PASS   | `validateTransfer.ts`, `transferRequestSchema.ts`, `transferDraft.ts`; tests reject invalid amounts, insufficient funds, frozen accounts, same account, unavailable recipients and currency/ownership mismatches.                                              | None within demo scope.                                                                                   |
| Transfers: correct balances and resulting activity     | PASS   | `executeTransfer.test.ts` verifies full snapshots, linked debit/credit entries, external source-only debit, conflict/replay, competing spends, overflow rejection and aborted writes.                                                                          | None within demo scope.                                                                                   |
| Transfers: clear outcome feedback                      | PASS   | Details → Review → Complete in `src/pages/transfer.vue`; `TransferReceipt.vue` displays receipt identity/time. `transferFailure.ts` distinguishes definite rejection from uncertain responses; `transferFlow.test.ts` covers explicit retry with the same key. | Recovery survives close/reload in browser storage; storage clearing/eviction remains a limitation.        |
| Data: deliberate mock boundary and banking model       | PASS   | Domain entities in `src/domain`, public contracts in `src/contracts`, use cases and repository port, thin MSW handlers, validated IndexedDB adapter. ESLint enforces import boundaries.                                                                        | Mock ownership projection is not server-side authorization.                                               |
| Data: included realistic seed                          | PASS   | `src/data/seed/createSeedState.ts`: one fictional customer, three owned accounts, two hidden recipients, six beneficiaries, varied activity and six completed seed transfers. Repository tests check deterministic balances/activity.                          | None within demo scope.                                                                                   |
| Data: consistency after transfer                       | PASS   | Atomic read/validate/write repository transactions; rollback/concurrent-connection tests in `src/tests/data`; browser transfer/reload/reset checks use native IndexedDB.                                                                                       | Browser retention and cross-device state remain outside the demo; same-origin tab refresh is implemented. |
| Deliverable: working code covering all four Core items | PASS   | Nuxt production build, Vitest tests, SSR integration script and Chromium suites.                                                                                                                                                                               | No real backend is required by the prompt.                                                                |
| Deliverable: local run instructions                    | PASS   | README Getting Started, `.nvmrc`, `package-lock.json`, `.env.example`, `package.json`; default demo needs no credentials or external database.                                                                                                                 | Chromium installation is needed only for browser tests.                                                   |
| Deliverable: mock data in the repository               | PASS   | Deterministic seed factory and MSW handlers are versioned under `src/data`.                                                                                                                                                                                    | None.                                                                                                     |
| Deliverable: README built/left-out scope               | PASS   | README What I Built, Deliberately Left Out, Assumptions and Known Limitations.                                                                                                                                                                                 | None.                                                                                                     |
| Deliverable: README data model                         | PASS   | README entity/relationship table, Mermaid ER diagram, transfer behavior matrix and persistence semantics.                                                                                                                                                      | None.                                                                                                     |
| Deliverable: 2–3 structured ADRs                       | PASS   | Exactly three Markdown records under `docs/adr`, each with Context → Alternatives → Decision → Consequences. Local links and heading structure verified.                                                                                                       | None.                                                                                                     |

## Enhancement verification — 2026-09-07

The requested follow-up is documented in [enhancements](enhancements.md). Cross-device synchronization was subsequently deferred by the user. This extends the completed Core; it does not replace the original acceptance evidence below.

- 238 unit/component tests across 17 files passed, including recipient creation and durable recovery guards.
- Strict typecheck, lint, formatting, Git whitespace check, production build and SSR smoke passed.
- All 15 Chromium E2E tests passed, including recipient creation, close/reopen recovery and two-tab synchronization.
- All four visual comparison tests passed against 12 committed baseline images.
- Storybook production build and two browser tests passed (all 11 stories in each theme).
- Visual baselines cover Accounts, Transactions and Transfer at 1440/390px in light/dark mode.
- The earlier 230-test/11-browser-test counts below describe the original Core gate.

## Quality checks

Checklist reconciliation rerun on 2026-09-07: 230 unit/component tests, lint, formatting, strict typecheck, production build, SSR smoke and all 11 Chromium tests passed. The first SSR attempt was blocked by sandbox localhost permissions (`listen EPERM`); it passed outside the sandbox, followed by Chromium using the installed `.tools/playwright` browser. Clean installation and manual screenshot inspection below refer to the earlier Day 3 verification; neither was repeated for this documentation-only reconciliation.

- 230 unit/component tests passed across 15 files.
- Clean `npm ci --no-audit --no-fund` completed from the committed lockfile and generated Nuxt types.
- `npm run lint`, `npm run format:check`, strict Nuxt typecheck, Git whitespace check and the production build passed.
- `PLAYWRIGHT_BROWSERS_PATH=.tools/playwright npm run test:all` passed after the clean install; this runs unit tests, typecheck/build, SSR and Chromium checks in sequence.
- Production SSR checks passed: data rendering, query/error hydration, request isolation, auth-context forwarding, query/POST forwarding, private caching, error statuses and demo/backend modes.
- Eleven Chromium tests passed, including demo persistence/reset, backend cache/error hydration and Core QA at 1440/768/390px. QA checks keyboard navigation, masking, frozen controls, filtered-empty recovery, horizontal overflow, associated validation errors and focus after an invalid submission.
- Inspected screenshots of account/overview/transaction layouts and transfer review. Successful QA paths report no console errors; all browser tests reject uncaught errors or hydration mismatches.

The validation-focus regression is covered in both `transferDetails.test.ts` and browser QA. Review performs local validation with automatic loading disabled so an invalid field can receive focus; the separate Confirm mutation retains its repeated-submit guard.

## Optional work

| Nice-to-Have                | Result                     | Evidence                                                                                                                                                                                                                                                                                                         |
| --------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Focused testing             | PASS                       | `src/tests/data/executeTransfer.test.ts` covers all seven priority invariants; unit/component, SSR and native Chromium suites passed.                                                                                                                                                                            |
| System architecture         | PASS                       | `docs/architecture.md` covers the Vue client, Banking API, authentication service, database schema and communication flow, with proposal-only components clearly identified.                                                                                                                                     |
| Individual transaction view | PASS                       | `TransactionDetail.vue`, `TransactionTable.vue`, two focused unit tests and three browser viewport tests. Both Transactions and Recent activity expose the drawer. Masking, signed amounts, UTC time, related IDs, focus containment/return, preserved filters and absence of new banking requests are verified. |
| Authentication              | Not implemented (optional) | Explicitly excluded in README; identity/session design is a proposal only.                                                                                                                                                                                                                                       |

Optional features support but do not replace the Core requirements. Authentication and spending insights are not implemented and are not required for acceptance. Browser coverage is Chromium-only; viewport checks are not a claim of real iOS/Android device testing. See [testing strategy](testing.md) for test boundaries and reproduction commands.
