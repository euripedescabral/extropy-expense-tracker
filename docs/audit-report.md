# Submission Audit Report

Date: 2026-06-14

## Scope

This audit covers the deployed Extropy Expense Tracker submission:

- Frontend: React 18, TypeScript, Vite
- Backend: Node.js 20 Lambda behind API Gateway
- Database: DynamoDB
- Infrastructure: AWS CDK, S3, CloudFront
- Tests: unit, API handler, repository, and Playwright E2E

## Delivery Evidence

- GitHub Repository URL: https://github.com/euripedescabral/extropy-expense-tracker
- Live Application URL: https://d6bx9i66sv1zv.cloudfront.net
- API URL: https://vr8i94iayl.execute-api.us-east-2.amazonaws.com
- Demo recording: [assets/demo-flow.webm](assets/demo-flow.webm)
- Demo screenshots:
  - [assets/demo-dashboard-desktop.png](assets/demo-dashboard-desktop.png)
  - [assets/demo-filter-food.png](assets/demo-filter-food.png)
  - [assets/demo-dashboard-after-add.png](assets/demo-dashboard-after-add.png)
  - [assets/demo-dashboard-mobile.png](assets/demo-dashboard-mobile.png)

## Deployed Demo State

The reusable demo account is documented in [aws-operations.md](aws-operations.md#reusable-smoke-login).

The deployed demo account was populated through the live UI with expenses across Food, Transport, Entertainment, Utilities, Health, and Books. The dashboard shows:

- Monthly total recalculation
- Category breakdown report
- Expense list
- Category filtering
- Mobile responsive rendering
- Add-expense flow against the live API

The recorded final dashboard total is `$543.63`.

## Audit Matrix

| Audit | Status | Notes |
|---|---:|---|
| Project deploy gate | Pass | CDK deploy completed, frontend synced to S3, CloudFront invalidated. |
| API smoke | Pass | Signup, login, categories, create/update/delete expense, and list routes passed against deployed API. |
| UI smoke | Pass | Login and expense creation were exercised through the deployed UI. |
| E2E coverage | Pass | Playwright covers signup, login, add/edit/delete, category filtering, period filtering, custom category, budgets, goals, fixed expenses, CSV export, loading states, money masks, report zero states, responsive layout, and mobile. |
| User scope isolation | Pass | DynamoDB partition keys are user-scoped and route handlers only operate under the authenticated user id. |
| Storage key exposure | Fixed | Repository responses strip internal `pk` and `sk` values before API responses. |
| Lambda configuration | Pass | Lambda uses Node.js 20, required env vars, 512 MB memory, and a 10 second timeout after cold-start smoke testing. |
| Lambda code practices | Pass | AWS SDK clients are initialized at module scope for execution environment reuse. |
| Error exposure | Pass | API returns controlled JSON error responses rather than raw stack traces. |
| Legal/privacy scan | Pass for take-home | Demo app stores email and expense data only; no analytics, cookies, or third-party tracking. A real public product would still need a privacy policy. |
| AI safety scan | N/A | No AI or model-driven behavior exists in this app. |
| Backoffice audit | N/A | No admin/backoffice surface exists. |
| Zustand audit | N/A | Zustand is available as an optional dependency, but this implementation does not use a store. |
| TanStack Query audit | N/A | React Query is available as an optional dependency, but this implementation uses direct fetch calls. |
| React 19 audit | N/A | The requirement is React 18+; the app is on React 18. |
| SEO audit | Low risk | The deliverable is an auth-gated take-home app, not an indexable marketing site. |

## Lambda Best-Practice Alignment

AWS recommends reusing execution environments by initializing SDK clients outside the handler, using environment variables for operational parameters, tuning memory and timeout from real invocations, and applying least-privilege permissions. This implementation follows those points where relevant:

- DynamoDB client and document client are module-level singletons.
- `JWT_SECRET` and `DYNAMODB_TABLE_NAME` are required environment values.
- Lambda memory and timeout were adjusted after deployed smoke testing exposed a bcrypt cold-start timeout at 3 seconds.
- CDK grants the Lambda only the DynamoDB table permissions it needs.

Reference: AWS Lambda best practices, https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html

## Residual Risks

- The take-home app uses short-lived JWT auth without refresh tokens. For a production product, prefer refresh-token rotation and httpOnly secure cookies.
- No rate limiting is configured at API Gateway. For production, add throttling, WAF rules, or usage plans depending on exposure.
- Observability is minimal. For production, add structured logs, alarms for Lambda errors/duration, and CloudWatch dashboards.
- The reusable smoke login is intentionally documented for review; it must not be reused for real user data.
- Report trends intentionally follow the active ledger filters. Empty filtered states should not show trend bars from hidden expenses.

## Final Verification Checklist

Run before submission:

```bash
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run test:e2e
```

Run against deployment:

```bash
pnpm run smoke:live
```
