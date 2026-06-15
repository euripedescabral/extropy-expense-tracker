# Expense Tracker Reporting Enhancements

## Layer 1 - Core Configuration

Context: the take-home app already supports auth, expenses, categories, basic reporting, deployment docs, and live smoke checks.

Objective: expand the ledger into a stronger demo surface with dashboard summary metrics, a detailed report page, period filtering, category budgets, fixed monthly expenses, monthly financial goals, CSV export, mood indication, and spending trends visualization.

Constraints:
- Keep TDD coverage ahead of implementation.
- Keep domain math in `packages/core`.
- Keep Lambda handlers thin and authenticated.
- Keep UI changes responsive and covered by Playwright desktop/mobile flows.

Success criteria:
- Users can view a dashboard summary and switch to a detailed report view.
- Users can filter by period presets and custom ranges capped at 90 days.
- Users can set a monthly budget per category.
- Users can configure fixed monthly expenses that count toward every monthly goal without cluttering the transaction ledger.
- Users can set a monthly expense limit and desired saving target.
- The report generates a mood indicator from current period spend versus those targets.
- Users can export visible ledger rows to CSV.
- Users can see monthly spending trend bars and budget progress.
- Local and live smoke gates pass.

Explicit exclusions:
- No payment integrations.
- No multi-currency budget conversion.
- No new third-party charting library unless required by the existing bundle.

## Layer 2 - Security + Privacy Posture

Authentication: budget, goal, and fixed-expense routes require the same JWT bearer token as expenses and categories.

Authorization: budget, goal, and fixed-expense records are scoped by authenticated `userId`; DynamoDB keys use the existing per-user partition strategy.

Input validation: budget, goal, fixed-expense, and date range validation is shared through `@expense-tracker/core`.

Secrets: no AWS credentials, JWT values, or account identifiers are committed. Deployment continues through documented CloudShell/CDK steps.

Data isolation: repository mappers strip DynamoDB `pk`/`sk` fields from budget API responses.

Logging: no sensitive request bodies are logged.

Dependency risk: implementation uses existing React, Vite, lucide, Vitest, Playwright, AWS SDK, and CDK dependencies.

Deployment controls: backend routes deploy through CDK; frontend build syncs to the existing S3/CloudFront target; smoke script validates routes after deploy.

## Layer 3 - Methodology Banks

- AWS Lambda best practices checked against official AWS guidance: stateless handlers, input validation, environment reuse for initialized clients, least-privilege persistence access, and transpiled TypeScript via CDK/esbuild.
- Reporting, period, goal, and mood math stays in pure functions so API, UI, and tests share behavior.
- Playwright flow covers the user-facing mutation, visualization, and CSV download.

## Layer 4 - Command System

1. Red tests
   - Files: `packages/core/src/expenses/reports.test.ts`, `apps/api/src/lambda.test.ts`, `apps/api/src/repositories/dynamo.test.ts`, `apps/web/e2e/expense-tracker.spec.ts`
   - Gate: targeted tests fail before implementation.
2. Core and API implementation
   - Files: `packages/core/src/expenses/reports.ts`, `apps/api/src/lambda.ts`, `apps/api/src/repositories/dynamo.ts`
   - Gate: `pnpm test`.
3. UI implementation
   - Files: `apps/web/src/App.tsx`, `apps/web/src/styles.css`
   - Gate: `pnpm run test:e2e`.
4. Smoke and docs
   - Files: `scripts/smoke-live.mjs`, `README.md`, `docs/assets/*`
   - Gate: `pnpm run build`, deployed smoke script.

## Layer 5 - Dispatch Table

| Phase | Mode | Files touched | Gate |
|---|---|---|---|
| Core reporting | Main agent | `packages/core/src/expenses/*` | `pnpm test` |
| API budgets/goals | Main agent | `apps/api/src/lambda*`, `apps/api/src/repositories/dynamo*` | `pnpm test` |
| Web report UI | Main agent | `apps/web/src/App.tsx`, `apps/web/src/styles.css` | `pnpm run test:e2e` |
| Smoke/docs/assets | Main agent | `scripts/smoke-live.mjs`, `README.md`, `docs/assets/*` | `pnpm run build`, `pnpm run smoke:live` |

## Layer 6 - UI Flow Matrix

| Flow | User action | Expected state | Coverage |
|---|---|---|---|
| View switch | Open detailed report | Report page replaces dashboard controls without losing loaded ledger data | Playwright |
| Budget save | Select category, enter monthly budget, save | Budget persists through API and appears in budget summary | Unit + API + Playwright + smoke |
| Goal save | Enter monthly expense limit and saving target | Goal persists through API and mood updates | Unit + API + Playwright + smoke |
| Fixed expense add/delete | Enter recurring rent/subscription and delete it later | Fixed expenses persist through API and count toward mood | Unit + API + Playwright + smoke |
| Period presets | Select last 7, last 14, last 30, current month, or last month | Ledger/report use computed date range | Unit + Playwright |
| Custom dates | Select custom and enter from/to | Ranges over 90 days show validation and are not treated as valid goals | Unit + Playwright |
| Mood indicator | Save goals with current spend | Report shows confident/watchful/stressed mood and buffer | Unit + Playwright |
| CSV export | Click CSV export | Browser downloads `expenses.csv` for visible ledger rows | Core unit + Playwright |
| Spending trends | Add expenses in multiple months | Report shows sorted monthly trend bars | Core unit + Playwright |
| Budget progress | Add June expenses and budget | Report shows remaining/over-budget status | Core unit + Playwright |
| Loading/error states | Load dashboard and save mutations | Skeletons and disabled buttons prevent duplicate actions | Playwright |

## Layer 7 - Meta

Decisions:
- Use CSS bars instead of adding a charting dependency to keep the app small and easy to audit.
- Use `PUT /budgets/:categoryId` so budget setting is idempotent per category.
- Use `PUT /goals` as the user's single monthly goal record.
- Keep fixed expenses separate from transaction entries so recurring commitments are easy to manage and count toward monthly goals without duplicating ledger rows each month.
- Default the ledger to the current month and require Custom range before editing dates directly.
- Export the currently visible ledger because filters are the user's current report context.

Blast radius: shared reporting functions, authenticated Lambda router, DynamoDB repository, main React app, smoke script, README assets.

Resume steps:
- Commit and push the feature branch/main update.
- Deploy CDK stack from CloudShell because local AWS credentials are expired.
- Upload the new production web bundle to S3 and invalidate CloudFront.
- Run `pnpm run smoke:live` and a browser smoke on the live CloudFront URL.
