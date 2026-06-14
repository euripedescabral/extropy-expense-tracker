# Plans Workflow

Every non-trivial change uses a KERNEL-style plan under `plans/active`.

## Required Layers

1. **Core Configuration**: context, objective, constraints, success criteria, and explicit exclusions.
2. **Security + Privacy Posture**: authentication, authorization, input validation, secrets, data isolation, logging, dependency risk, deployment controls.
3. **Methodology Banks**: project-specific implementation notes and external source references.
4. **Command System**: ordered phases with file scope and runnable gates.
5. **Dispatch Table**: phase, mode, files touched, gate.
6. **UI Flow Matrix**: required for frontend or E2E-facing work.
7. **Meta**: decisions, blast radius, learnings log, and resume steps.

## Lifecycle

- New plans start in `plans/active`.
- Completed plans move to `plans/done`.
- Update `plans/README.md` when adding, splitting, or completing a plan.
- Append `plans/CHANGELOG.md` for each plan lifecycle change.

## Gates

- Red phase: tests added and observed failing for missing behavior.
- Green phase: `pnpm test`.
- Quality phase: `pnpm run typecheck`, `pnpm run lint`, `pnpm run build`.
- E2E phase: `pnpm run test:e2e`.
