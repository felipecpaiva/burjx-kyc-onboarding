# CLAUDE.md — BurjX KYC Onboarding

Guidance for Claude Code working in this repo.

## What this is

Frontend-only **Expo / React Native / TypeScript** multi-step KYC onboarding state machine for a crypto exchange (BurjX Senior Mobile Engineer take-home, Option 4). The full assignment spec is in `burjx-senior-mobile-assessment-04-kyc-onboarding-state-machine.pdf`.

## Hard constraints (frontend-only)

- **No backend, server, database, HTTP/websocket, Firebase/Supabase, real exchange/KYC API, blockchain SDK, or secret keys.**
- All service behavior is implemented as **local async TypeScript** in `src/services/`.

## Architecture rules

- The **reducer + explicit transition table** (`src/state/`) is the single source of truth, including `currentStep`. The UI is a **projection** of machine state — never let a navigation library own step/state.
- Keep pure-logic modules (`reducer`, `transitions`, `conflictResolution`, `validation`, `fakeKycService`, `redaction`) **independent of React Native** so they are unit-testable with zero rendering.
- **Never log KYC PII** (`documentNumber`, `dateOfBirth`, `legalName`, full `KycApplication`). Route any debug logging through `src/utils/redaction.ts`.
- Conflict rule: local draft can only win while the fake service status is still `draft`; once `submitted`/`approved`/`rejected`, the service is authoritative. `requires_more_info` routes to the first step owning `requiredFields[0]`.
- Polling must be **bounded** (max-N / timeout), **stop on terminal state**, and **clean up on unmount**.

## Commands

- Run app: `npm start` (then i / a / w)
- **Tests (one command): `npm test`**
- Typecheck: `npm run typecheck`

## Commit rules (workspace policy)

- **No AI co-author tags** — no `Co-Authored-By`, `Generated-By`, or any AI attribution in commits/PRs/comments.
- Never mention which AI model/agent produced code.
- Conventional-commit style; messages focus on the "why".
