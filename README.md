# Extropy Expense Tracker

Personal expense tracker take-home built as a pnpm monorepo.

## Architecture

- `packages/core`: shared Zod-backed domain contracts and pure functions for expenses, categories, filtering, and reports.
- `apps/api`: TypeScript Lambda/API Gateway service with JWT auth, category, and expense routes backed by DynamoDB.
- `apps/web`: React 18 + Vite dashboard with accessible forms and Playwright-covered user flows.
- `infra`: AWS CDK v2 stack for HTTP API Gateway, Node.js 20 Lambda, DynamoDB, S3, and CloudFront.
- `plans`: KERNEL-style implementation plans and execution notes.

## Prerequisites

- Node.js 20+
- pnpm 10+
- AWS CLI configured for deployment
- AWS CDK bootstrap completed for the target account/region

## Setup

```bash
pnpm install
cp .env.example .env
pnpm run build
pnpm run dev
```

## Environment

Place `.env` at the repository root for local development.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Local runtime mode. |
| `JWT_SECRET` | Secret used by the API to sign JWTs. Use a long random value outside local tests. |
| `DYNAMODB_TABLE_NAME` | DynamoDB table name used by the API repository layer. |
| `VITE_API_BASE_URL` | Frontend API base URL. Defaults to `/api` when unset. |

## Commands

```bash
pnpm test          # Unit/API/web tests
pnpm run test:e2e # Playwright desktop + mobile flows
pnpm run smoke:live # Deployed API smoke test
pnpm run typecheck
pnpm run lint
pnpm run build
```

## Deploy

AWS login, CLI profile setup, bootstrap, deploy, and frontend upload instructions live in [docs/aws-operations.md](docs/aws-operations.md).

The CDK stack is scaffolded in `infra`:

```bash
export AWS_REGION=us-east-2
export AWS_DEFAULT_REGION=us-east-2
export JWT_SECRET="<long-random-secret>"

pnpm --filter @expense-tracker/infra build
pnpm --filter @expense-tracker/infra exec cdk synth --app "pnpm --filter @expense-tracker/infra exec tsx src/index.ts"
pnpm --filter @expense-tracker/infra exec cdk deploy ExpenseTrackerStack --require-approval never --app "pnpm --filter @expense-tracker/infra exec tsx src/index.ts"
```

After deployment, upload `apps/web/dist` to the emitted S3 bucket and set `VITE_API_BASE_URL` to the emitted API URL for production builds.

## Tested Flows

- Sign up
- Log in
- Add expense
- Edit expense
- Filter by category
- Filter by date range
- Add custom category
- Monthly total recalculation
- Category breakdown report
- Delete expense

## Submission URLs

- GitHub Repository URL: https://github.com/euripedescabral/extropy-expense-tracker
- Live Application URL: https://d6bx9i66sv1zv.cloudfront.net
- API URL: https://vr8i94iayl.execute-api.us-east-2.amazonaws.com

## Demo Assets

- Demo recording: [docs/assets/demo-flow.webm](docs/assets/demo-flow.webm)
- UI flow recording, signup/add/filter: [docs/assets/ui-flow-signup-add-filter.webm](docs/assets/ui-flow-signup-add-filter.webm)
- UI flow recording, category/delete: [docs/assets/ui-flow-category-delete.webm](docs/assets/ui-flow-category-delete.webm)
- UI flow recording, edit/date filter: [docs/assets/ui-flow-edit-date-filter.webm](docs/assets/ui-flow-edit-date-filter.webm)
- UI flow recording, loading states: [docs/assets/ui-flow-loading-states.webm](docs/assets/ui-flow-loading-states.webm)
- Desktop dashboard: [docs/assets/demo-dashboard-desktop.png](docs/assets/demo-dashboard-desktop.png)
- Food filter: [docs/assets/demo-filter-food.png](docs/assets/demo-filter-food.png)
- Dashboard after add: [docs/assets/demo-dashboard-after-add.png](docs/assets/demo-dashboard-after-add.png)
- Mobile dashboard: [docs/assets/demo-dashboard-mobile.png](docs/assets/demo-dashboard-mobile.png)
- Refreshed UI desktop dashboard: [docs/assets/vault-theme-dashboard-desktop.png](docs/assets/vault-theme-dashboard-desktop.png)
- Refreshed UI mobile dashboard: [docs/assets/vault-theme-dashboard-mobile.png](docs/assets/vault-theme-dashboard-mobile.png)
- Full audit notes: [docs/audit-report.md](docs/audit-report.md)

The reusable demo login is documented in [docs/aws-operations.md](docs/aws-operations.md#reusable-smoke-login).

## Troubleshooting

- If Playwright fails to start browsers, run `pnpm --filter @expense-tracker/web exec playwright install`.
- If the frontend cannot reach the API locally, verify `VITE_API_BASE_URL` or leave it unset for `/api`.
- If CDK deploy fails on a new AWS account, run `cdk bootstrap` first.
