# PROGRESS — resume state

Living checklist for resuming this build in a later session.

## ▶ RESUME HERE (after `/clear`)

**Authoritative implementation spec:** [`.claude/findings/kyc-onboarding/PLAN.md`](../.claude/findings/kyc-onboarding/PLAN.md) — read it first. It contains the deepened T2–T9 design, the 6 red-team fixes (folded in), the E1–E8 test plan, and the locked decisions.

**Next command:**
```
/ticket-flow build T2–T9 for the BurjX KYC onboarding state machine, in order, against the spec at .claude/findings/kyc-onboarding/PLAN.md. Each unit ships with its E-tests; all green via `npm test`.
```

- ticket-flow config already present (`.claude/skills/ticket-flow/project.config.md`, prefix `KYC`, `npm test`, QA gate on, no Copilot) → **no first-run bootstrap**.
- After T2→T9: run `/eval-tickets`, `/code-review`, `/security-review`, then finalize `NOTES.md` AI accept/reject log.

**Locked decisions (do not re-ask):** `rejected` = terminal; DOB validation enforces **age ≥ 18**. State mgmt = `useReducer` + transition table (not XState). Conflict: local wins only while service status is `draft`; server authoritative once submitted; unsynced edits are **archived, never deleted**.

---

## Done — Phase 0 (kickstart + agentic tooling)

- [x] Expo SDK 56 + React 19 + RN 0.85 blank-typescript scaffold at repo root
- [x] Test harness: jest-expo + RNTL 13 + `@react-native/jest-preset`; `npm test` green
- [x] `.npmrc` (`legacy-peer-deps=true`) — fresh-clone `npm install && npm test` verified
- [x] Folder structure: `src/{types,state,services,validation,hooks,screens,components,utils}`, `docs/adr/`
- [x] Per-project `CLAUDE.md`, `.claude/skills/ticket-flow/project.config.md`, `.claude/skills/deep-plan/project.config.md`
- [x] `.claude/findings/kyc-onboarding/PLAN.md` (team-visible plan), `docs/adr/README.md` (ADR-001..006)
- [x] Public repo created + pushed: https://github.com/felipecpaiva/burjx-kyc-onboarding
- [x] `NOTES.md` covering the deliverable checklist

## Done — `/deep-plan` (complexity 7/10, 2 rounds, commit 1b4e073)

- [x] Deepened T2–T9 spec at `.claude/findings/kyc-onboarding/PLAN.md` (pointer `~/.claude/plans/kyc-onboarding.md`)
- [x] Red-team pass: **6 holes** in conflict/transition core found + resolved (archive-not-delete, more_info per-field merge, earliest-step routing, HYDRATE exempt from guard, tie→local, bounded poll + cancelledRef)
- [x] Mempalace drawer `project_kyc_onboarding_planning_round_2026_06_08` (wing `burjx`); history log `.claude/history/2026-06-08.md`
- [x] Decisions locked: rejected=terminal, DOB 18+

## Done — feature units (built via `/ticket-flow`, branch `feat/kyc-state-machine-t2-t9`)

- [x] **T2** Types/contracts — `src/types/kyc.ts` (`Kyc*` verbatim + `REQUIRED_FIELD_TO_STEP`, `STEP_REQUIRED_FIELDS`, `earliestStepFor`, `LocalDraft`, status guards)
- [x] **T3** Fake KYC service — `src/services/fakeKycService.ts` (4 fns; `delay`; sentinels NETFAIL/REJECT*/MOREINFO*/else; idempotency map; `POLLS_UNTIL_TERMINAL=3`; `__resetKyc`) — E7
- [x] **T4** State machine — `src/state/{reducer.ts,transitions.ts,conflictResolution.ts}` (transition table + HYDRATE exempt + `reconcile`; all 6 holes) — E2/E4/E5/E6
- [x] **T5** Persistence + resume — `src/services/draftStorage.ts` (active + archive keys, `DraftSaveError`) + `src/utils/redaction.ts` — E3 + redaction test
- [x] **T6** UI — 5 step screens + per-step validation + all async states (`App.tsx`, `src/screens/`, `src/components/`) + jest coverage gate (≥80%)
- [x] **T7** Bounded polling hook — `src/hooks/usePollKycStatus.ts` (maxAttempts + cancelledRef, error-bound) — E8
- [x] **T8** Required tests E1–E8 — **98 tests green** via `npm test`
- [x] **T9** Validation `src/validation/stepValidation.ts` (18+ DOB) — E1; `NOTES.md` AI accept/reject log filled

## Deliverables checklist (submission)

- [x] Public GitHub repo link
- [x] Tests runnable with one command (`npm test`) — 98 tests green
- [x] README/NOTES with all required sections — AI-usage log filled, Hole-3 divergence documented
- [ ] Reply email with repo link before deadline (Mon 8 Jun 2026, 11:59 PM GST)
- ~~Screen recording~~ — Felipe decided not to record (2026-06-08)

## Build environment gotchas (so a fresh machine resumes cleanly)

- `npm install` needs `.npmrc` `legacy-peer-deps=true` (RNTL 13 ↔ react 19.2.3 peer conflict).
- jest-expo 56 needs `@react-native/jest-preset` peer dep installed.
- Do not add `@testing-library/react-native/extend-expect` to `setupFilesAfterEnv` — RNTL 13 matchers are built-in; that path no longer exists.
- `create-expo-app` refuses a non-empty dir and prompts to skip git init when inside an existing repo.
