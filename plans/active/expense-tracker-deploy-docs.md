---
name: expense-tracker-deploy-docs
status: in-progress
created: 2026-06-14
source: new
---

# Expense Tracker Deploy Docs

## Layer 1 — Core Configuration

**Context:** The take-home requires a public GitHub repository URL, live app URL, accessible API endpoints, README, env examples, and AWS deployment. This plan packages the finished implementation for review.

**Objective:** Add CDK infrastructure, env templates, README setup/deploy documentation, and submission-ready metadata.

**Constraints**

| Constraint | Decision |
|---|---|
| Deploy target | AWS free tier compatible |
| IaC | AWS CDK v2 TypeScript |
| Database | DynamoDB |
| Frontend hosting | S3 + CloudFront |
| API | API Gateway + Lambda |

**Success Criteria**

- `pnpm run build` passes.
- `pnpm --filter @expense-tracker/infra build` passes.
- README documents prerequisites, env placement, local run, deploy, troubleshooting, architecture, and URLs.
- `.env.example` covers every required variable with explanations.

**What NOT to Change**

- Do not hardcode deployed URLs before they exist.
- Do not include credentials or account IDs.

## Layer 1.5 — Security + Privacy Posture

| Area | Status | Requirement |
|---|---:|---|
| AWS permissions | ✅ | CDK grants least-privilege table access to Lambda. |
| Secrets | ✅ | JWT secret comes from environment/SSM-compatible config, not source. |
| Public access | ✅ | S3 bucket is private behind CloudFront. |
| CORS | ✅ | API CORS references deployed frontend origin. |
| Cost | ✅ | Use free-tier-compatible resources and document cleanup. |

## Layer 2 — Methodology Banks

- AWS CDK v2 official docs checked 2026-06-14 for Lambda/API Gateway/DynamoDB patterns.
- README should be reviewer-first: clone, install, env, build, dev, test, deploy.

## Layer 3 — Command System

| Phase | Files | Change | Gate |
|---|---|---|---|
| 1 — infra | `infra/src/**`, `infra/bin/**`, `cdk.json` | CDK stack for API, DynamoDB, S3, CloudFront | `pnpm --filter @expense-tracker/infra build` |
| 2 — env docs | `.env.example`, app env examples | Required variable docs | `pnpm run typecheck` |
| 3 — README | `README.md` | Setup, architecture, deploy, troubleshooting | `pnpm run build` |
| 4 — final gates | all | Submit-ready validation | `pnpm test && pnpm run typecheck && pnpm run lint && pnpm run build` |

## Layer 3.1 — Dispatch Table

| Phase | Mode | Files touched | Gate |
|---|---|---|---|
| 1 | Serial | `infra/**`, `cdk.json` | infra build |
| 2 | Serial | env files | typecheck |
| 3 | Serial | `README.md` | build |
| 4 | Serial | all | full gate suite |

## Layer 3.2 — UI Flow Matrix

No new UI behavior; documentation must describe the existing UI flows from the implementation plan.

## Layer 5 — Meta

**Decisions:** Deployed URL placeholders remain explicit until a real deploy is performed.

**Blast Radius:** Infrastructure and docs only.

**Session Continuity:** Run the full gate suite before marking this plan done.
