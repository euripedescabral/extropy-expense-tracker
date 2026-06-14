---
name: expense-tracker-implementation
status: in-progress
created: 2026-06-14
source: new
---

# Expense Tracker Implementation

## Layer 1 — Core Configuration

**Context:** The red tests define the desired application behavior. Implementation should stay minimal and align with the shared contract tests instead of expanding scope.

**Objective:** Implement the full-stack expense tracker until unit, API, web, and E2E tests pass.

**Constraints**

| Constraint | Decision |
|---|---|
| Domain logic | Pure functions in `packages/core` |
| API | Thin Lambda handlers with injected repositories/services |
| Web | React 18 + Vite + TypeScript, server state through React Query |
| UI | Modern utility styling, dense dashboard-first app |
| Persistence | DynamoDB repository implementation |

**Success Criteria**

- `pnpm test` passes.
- `pnpm run test:e2e` passes.
- App supports signup/login, expense CRUD, custom categories, category/date filters, and basic reporting.

**What NOT to Change**

- Do not introduce a class-heavy architecture.
- Do not add OAuth, multi-currency, budgets, or CSV export in MVP implementation.
- Do not bypass shared schemas.

## Layer 1.5 — Security + Privacy Posture

| Area | Status | Implementation Requirement |
|---|---:|---|
| JWT auth | ✅ | Sign tokens with required `JWT_SECRET`; verify bearer tokens in protected handlers. |
| Passwords | ✅ | Hash with bcryptjs; never serialize hash to clients. |
| Object authorization | ✅ | All expense/category repository operations scope by `userId`. |
| Input validation | ✅ | Parse all API bodies with shared schemas. |
| CORS | ✅ | CDK/API responses allow documented frontend origin. |
| Error handling | ✅ | Return helpful client-safe errors, no stack traces. |
| Secrets | ✅ | Required env parser; examples only. |

## Layer 2 — Methodology Banks

- Domain-first: implement pure functions before handlers.
- Handler pattern: `{ dependencies } => async handler(event)`.
- Repository pattern: simple function collections, no base classes.
- Frontend pattern: API client + React Query hooks + focused components.

## Layer 3 — Command System

| Phase | Files | Change | Gate |
|---|---|---|---|
| 1 — core | `packages/core/src/**` | Implement schemas, category service, report functions | `pnpm --filter @expense-tracker/core test` |
| 2 — API services | `apps/api/src/**` | Implement env, auth service, handlers, repositories | `pnpm --filter @expense-tracker/api test` |
| 3 — web app | `apps/web/src/**` | Implement dashboard, auth, forms, reports | `pnpm --filter @expense-tracker/web test` |
| 4 — E2E green | `apps/web/e2e/**` | Align selectors and flows | `pnpm --filter @expense-tracker/web test:e2e` |
| 5 — all gates | all workspaces | Fix type/lint/build | `pnpm test && pnpm run typecheck && pnpm run lint && pnpm run build` |

## Layer 3.1 — Dispatch Table

| Phase | Mode | Files touched | Gate |
|---|---|---|---|
| 1 | Serial | `packages/core/**` | `pnpm --filter @expense-tracker/core test` |
| 2 | Serial after 1 | `apps/api/**` | `pnpm --filter @expense-tracker/api test` |
| 3 | Serial after 1 | `apps/web/src/**` | `pnpm --filter @expense-tracker/web test` |
| 4 | Serial after 3 | `apps/web/e2e/**` | `pnpm --filter @expense-tracker/web test:e2e` |
| 5 | Serial | all | full gate suite |

## Layer 3.2 — UI Flow Matrix

| Flow | Components | State |
|---|---|---|
| Auth | `AuthPage`, `authApi`, auth store | unauthenticated → authenticated |
| Expense CRUD | `ExpenseForm`, `ExpenseList` | create/update/delete/query invalidation |
| Categories | `CategoryForm`, category selector | custom category added and selectable |
| Filters | filter toolbar | local category/date filter state narrows visible rows and reports |
| Reports | report panel | monthly total + breakdown |

## Layer 5 — Meta

**Decisions:** Keep the MVP dashboard-first, no marketing landing page.

**Blast Radius:** New app only.

**Session Continuity:** Start with `pnpm test`, implement failing modules in dependency order: core → API → web → E2E.
