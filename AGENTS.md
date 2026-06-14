# Extropy Expense Tracker Agent Guide

## Project Shape

- Monorepo managed by `pnpm`.
- `packages/core`: framework-free domain logic and shared Zod schemas.
- `apps/api`: AWS Lambda/API Gateway TypeScript handlers.
- `apps/web`: React + Vite frontend.
- `infra`: AWS CDK deployment.
- `plans`: KERNEL-style planning portfolio.

## Work Rules

- Use TDD for feature work: write or update tests first, run them red, then implement.
- Keep shared request/response schemas in `packages/core` and import them from API and web.
- Do not duplicate DTO types between workspaces.
- Prefer pure functions for validation, filtering, reporting, and view models.
- Keep Lambda handlers thin: parse auth/request, call services, return HTTP responses.
- Never commit secrets. Use `.env.example` files only.

## Required Gates

- `pnpm test`
- `pnpm run typecheck`
- `pnpm run lint`
- `pnpm run build`
- `pnpm run test:e2e` for user-facing flow changes

## AWS Operations

- Follow [docs/aws-operations.md](docs/aws-operations.md) for console login, AWS CLI profile setup, CDK bootstrap/deploy, and frontend upload.
- Never commit AWS credentials, root login details, MFA recovery codes, account IDs, billing data, `.env`, or CLI credential files.
- Before any deploy, run `aws sts get-caller-identity` and confirm the expected account/profile.
- Default deployment profile is `extropy-expense-tracker`; default region is `us-east-1`.

## Commit Style

Use conventional commits: `feat(scope): subject`, `test(scope): subject`, `docs(scope): subject`.
