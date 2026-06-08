# PROGRESS — resume state

Living checklist for resuming this build in a later session. Master plan: `.claude/findings/kyc-onboarding/PLAN.md`.

## Done — Phase 0 (kickstart + agentic tooling)

- [x] Expo SDK 56 + React 19 + RN 0.85 blank-typescript scaffold at repo root
- [x] Test harness: jest-expo + RNTL 13 + `@react-native/jest-preset`; `npm test` green
- [x] `.npmrc` (`legacy-peer-deps=true`) — fresh-clone `npm install && npm test` verified
- [x] Folder structure: `src/{types,state,services,validation,hooks,screens,components,utils}`, `docs/adr/`
- [x] Per-project `CLAUDE.md`, `.claude/skills/ticket-flow/project.config.md`, `.claude/skills/deep-plan/project.config.md`
- [x] `.claude/findings/kyc-onboarding/PLAN.md` (team-visible plan), `docs/adr/README.md` (ADR-001..006)
- [x] Public repo created + pushed: https://github.com/felipecpaiva/burjx-kyc-onboarding
- [x] `NOTES.md` covering the 5 recording points + deliverable checklist

## Pending — feature units (run via `/ticket-flow`)

- [ ] **T2** Types/contracts — `src/types/kyc.ts` (provided `Kyc*` types verbatim + `RequiredField → Step` map)
- [ ] **T3** Fake KYC service — `src/services/fakeKycService.ts` (`fetchKycApplication`, `saveKycDraft`, `submitKycApplication`, `pollKycStatus`; delay helper; deterministic states; idempotency map; rejected-promise failures)
- [ ] **T4** State machine — `src/state/{reducer.ts,transitions.ts,conflictResolution.ts}` (transition table + 3 conflict cases)
- [ ] **T5** Persistence + resume — `src/services/draftStorage.ts` + `src/utils/redaction.ts`
- [ ] **T6** UI — 5 step screens + per-step validation + all async states
- [ ] **T7** Bounded polling hook — `src/hooks/usePollKycStatus.ts`
- [ ] **T8** Required tests E1–E8 (see NOTES.md traceability matrix); all green via `npm test`
- [ ] **T9** Finalize `NOTES.md` (fill AI accept/reject log) + record session

## Deliverables checklist (submission)

- [x] Public GitHub repo link
- [ ] Tests runnable with one command (`npm test`) — harness ready, real tests in T8
- [ ] README/NOTES with all required sections — NOTES.md drafted, AI-usage log fills during build
- [ ] Screen recording (audio) uploaded to public Drive, link accessible without request
- [ ] Reply email with both links before deadline (Mon 8 Jun 2026, 11:59 PM GST)

## Build environment gotchas (so a fresh machine resumes cleanly)

- `npm install` needs `.npmrc` `legacy-peer-deps=true` (RNTL 13 ↔ react 19.2.3 peer conflict).
- jest-expo 56 needs `@react-native/jest-preset` peer dep installed.
- Do not add `@testing-library/react-native/extend-expect` to `setupFilesAfterEnv` — RNTL 13 matchers are built-in; that path no longer exists.
- `create-expo-app` refuses a non-empty dir and prompts to skip git init when inside an existing repo.
