---
name: expense-tracker-foundation-tdd
status: completed
created: 2026-06-14
source: new
---

# Expense Tracker Foundation TDD

## Layer 1 — Core Configuration

**Context:** This project is a take-home full-stack application using pnpm, React/Vite, AWS Lambda/API Gateway, DynamoDB, and CDK. The user explicitly requested TDD and plan coverage before implementation. The first deliverable is a red test suite that defines the application contracts.

**Objective:** Create the monorepo scaffold and red tests for the core domain, API boundaries, frontend view models, and E2E user flows.

**Constraints**

| Constraint | Decision |
|---|---|
| Stack | pnpm workspace, React 18, TypeScript, Vite, Lambda/API Gateway, DynamoDB, CDK |
| TDD | Tests first, implementation after red phase |
| Shared contracts | Zod schemas and derived types live in `packages/core` |
| Scope | Option 1: Personal Expense Tracker |
| Timebox | MVP-scale implementation suitable for 20-30 hours |

**Success Criteria**

- `pnpm test` runs unit/API/web tests.
- `pnpm run test:e2e` runs Playwright flow tests.
- Tests cover signup, login, expense CRUD, category creation, category/date filters, monthly totals, category breakdown, env failure behavior.
- All tests initially fail only because implementation is intentionally missing.

**What NOT to Change**

- Do not implement production behavior before the red tests exist.
- Do not add external paid services beyond AWS free-tier-compatible infrastructure and DynamoDB.
- Do not store secrets in the repo.

## Layer 1.5 — Security + Privacy Posture

| Area | Status | Evidence / Required Test |
|---|---:|---|
| Authentication | ✅ | JWT auth service tests cover signup/login token behavior. |
| Authorization | ✅ | API handler tests require bearer token before expense writes. |
| Input validation | ✅ | Zod/domain tests reject invalid amount/date/category/description. |
| Password handling | ✅ | Tests require hashed storage and no plaintext persistence. |
| User data isolation | ✅ | Repository calls include authenticated `userId`; E2E verifies private views. |
| Secrets | ✅ | `.env.example` only; env tests require helpful missing-secret errors. |
| Logging | ➖ | No production logging implemented in red phase. |
| Dependency risk | ✅ | Official docs checked for pnpm, AWS CDK, Vitest, Playwright. |
| Deployment controls | ➖ | Covered by deploy/docs plan. |

## Layer 2 — Methodology Banks

- Brain: `learnings/monorepo-shared-types.md` drives shared Zod-first contracts.
- Brain: `references/revendaflash-testing-strategy.md` drives colocated unit tests plus separate E2E runner.
- Brain: `learnings/kernel-plan-scaling-and-structure.md` drives phase sizing and dispatch table.
- Official docs checked 2026-06-14:
  - pnpm workspace requires `pnpm-workspace.yaml`.
  - Vitest integrates with Vite and works for backend tests too.
  - AWS CDK v2 supports Lambda, API Gateway, and DynamoDB infrastructure in TypeScript.
  - Playwright supports `webServer`, API contexts, and request mocking for E2E tests.

## Layer 3 — Command System

| Phase | Files | Change | Gate |
|---|---|---|---|
| 1 — scaffold | `package.json`, `pnpm-workspace.yaml`, workspace package files | Create pnpm monorepo skeleton | `pnpm install` |
| 2 — core red tests | `packages/core/src/**/*.test.ts` | Domain tests for expense/report/category rules | `pnpm --filter @expense-tracker/core test` |
| 3 — API red tests | `apps/api/src/**/*.test.ts` | Auth and handler tests | `pnpm --filter @expense-tracker/api test` |
| 4 — web red tests | `apps/web/src/**/*.test.ts` | Report view model tests | `pnpm --filter @expense-tracker/web test` |
| 5 — E2E red tests | `apps/web/e2e/**/*.spec.ts`, `apps/web/playwright.config.ts` | User journey tests | `pnpm --filter @expense-tracker/web test:e2e` |

## Layer 3.1 — Dispatch Table

| Phase | Mode | Files touched | Gate |
|---|---|---|---|
| 1 | Serial | root config, workspace package files | `pnpm install` |
| 2 | Parallel eligible | `packages/core/**` | `pnpm --filter @expense-tracker/core test` |
| 3 | Parallel eligible after 1 | `apps/api/**` | `pnpm --filter @expense-tracker/api test` |
| 4 | Parallel eligible after 1 | `apps/web/src/**` | `pnpm --filter @expense-tracker/web test` |
| 5 | Serial after 4 | `apps/web/e2e/**`, `apps/web/playwright.config.ts` | `pnpm --filter @expense-tracker/web test:e2e` |

## Layer 3.2 — UI Flow Matrix

| Flow | Screen(s) | Assertions |
|---|---|---|
| Sign up | Auth form → dashboard | Account created, dashboard visible, default categories loaded |
| Log in | Auth form → dashboard | Existing user session accepted and dashboard loaded |
| Add expense | Dashboard expense form | New expense row visible, monthly total updates |
| Edit expense | Expense row action → expense form | Updated row visible and monthly total recalculates |
| Filter expenses | Expense list filters | Category/date filters narrow rows |
| Add category | Category modal/form | Custom category appears in category selector |
| Reports | Dashboard report panel | Category breakdown and totals reflect expenses |
| Delete expense | Expense row action | Row removed and totals recalculate |

## Layer 5 — Meta

**Decisions**

- Use DynamoDB for free-tier-friendly serverless persistence.
- Use Playwright with mocked API routes during early red phase, then keep a path open for real API E2E once local API server exists.

**Blast Radius:** New project only.

**Learnings Log**

- Playwright route mocks must not overlap Vite source-module paths; frontend API calls use `/api/*` so `**/api/expenses**` does not intercept `/src/expenses/reports.ts`.
- Accessible label substring overlap (`Category`, `New category`, `Filter category`) is useful for users but unstable for E2E selectors; stable `data-testid` hooks cover repeated controls.

**Session Continuity**

1. Run `git status --short`.
2. Run `pnpm install` if `node_modules` is absent.
3. Run `pnpm test` and confirm red/green status.
4. Resume at the first missing implementation named by a failing test.
