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

## Commit Style

Use conventional commits: `feat(scope): subject`, `test(scope): subject`, `docs(scope): subject`.
