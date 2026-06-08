# NOTES — BurjX KYC Onboarding State Machine

> **Status:** Complete. All units **T2–T9 implemented**; 98 tests green via `npm test` (E1–E8 covered), `npm run typecheck` clean, coverage gate ≥80% on pure-logic modules. See [`docs/PROGRESS.md`](docs/PROGRESS.md).

Frontend-only **Expo / React Native / TypeScript** multi-step KYC onboarding flow for a crypto exchange. No backend, no real KYC provider — all service behavior is local async TypeScript.

---

## Setup / Run / Test

```bash
npm install            # relies on .npmrc → legacy-peer-deps=true
npm start              # Expo dev server (press i / a / w)
npm test               # one-command test suite (jest-expo)
npm run typecheck      # tsc --noEmit
```

---

## 1. How the task was understood and decomposed

**Understanding.** The assignment (Option 4) asks for a *sensitive, multi-step, service-backed workflow modeled without a backend*. The real test is not UI — it is the **state model**: how a local draft, a simulated verification service, validation, and persistence reconcile into one predictable machine. The PDF's evaluation focus confirms this: "state machine/reducer design" is criterion #1.

**Decomposition** (build order; each unit is independently testable and shippable):

| # | Unit | Why this seam |
|---|------|---------------|
| T1 | Scaffold + agentic tooling | _done in Phase 0_ — Expo TS, jest-expo, folder structure, public repo |
| T2 | Types/contracts (`src/types/kyc.ts`) | Provided `Kyc*` types verbatim + `RequiredField → Step` map; everything else depends on these |
| T3 | Fake KYC service (`src/services/fakeKycService.ts`) | Deterministic states, latency, idempotency, failures as rejected promises — isolated so it is swappable for a real adapter |
| T4 | State machine (`src/state/`) | Reducer + transition table + conflict resolution — the core |
| T5 | Persistence + resume (`src/services/draftStorage.ts`, `src/utils/redaction.ts`) | AsyncStorage, resume-from-last-step, don't-lose-unsynced, PII redaction |
| T6 | UI — 5 step screens | Thin projection of machine state + per-step validation + async states |
| T7 | Bounded polling hook (`src/hooks/usePollKycStatus.ts`) | Max-N/timeout, stop on terminal, cleanup on unmount |
| T8 | Required tests (E1–E8) | Pure-logic front-loaded |
| T9 | NOTES.md + recording prep | This document |

The decomposition is intentionally **layered (types → service → machine → storage → UI)** so ~80% of required tests need zero React Native rendering.

---

## 2. Architecture choices

| Concern | Decision | Why |
|---------|----------|-----|
| State model | `useReducer` + explicit transition table (not XState) | Demonstrates the graded skill directly; zero dependency; trivially unit-testable |
| Source of truth | State machine owns `currentStep`; UI is a projection | Resume + `requires_more_info` routing break if nav state and machine state diverge |
| Separation | Pure-logic TS modules (`reducer`, `transitions`, `conflictResolution`, `validation`, `fakeKycService`, `redaction`) independent of RN | This separation *is* the testability signal |
| Persistence | AsyncStorage for the draft | Fast, testable; production note below |
| Polling | Bounded (max-N / timeout), stop on terminal, cleanup on unmount | "Must not run forever" requirement |

Full rationale + tradeoffs: [`docs/adr/`](docs/adr/) (ADR-001 … ADR-006).

---

## 3. Core app behavior

1. **Wizard:** personal_info → address → document → review → status. Each step validates its required fields before advancing.
2. **Draft recovery:** on launch, the app loads any locally persisted draft and **resumes at the last step** with data intact — unsynced local edits are never silently lost.
3. **Submission:** review → submit hands the application to the fake service, which deterministically returns `submitted` → (`approved` | `rejected` | `requires_more_info`).
4. **Conflict resolution** between local draft and fake-service truth:
   - service `draft` + local `updatedAt` newer → **local wins**, keep editing;
   - service `submitted`/`approved`/`rejected` → **service authoritative**, local edits must not overwrite;
   - service `requires_more_info` → route to the **earliest wizard step among _all_ `requiredFields`** (not just `requiredFields[0]`), prefill known data. See the deliberate divergence note below.

> **Deliberate divergence from the PDF wording (considered improvement, not a misread).** The spec says "route to the **first** relevant required field". Routing literally to `requiredFields[0]` can land the user *after* an earlier step that is also in the missing set — e.g. `['document.documentNumber', 'personalInfo.legalName']` would open the Document step while Personal info is still incomplete, so the user could never reach the earlier missing field by going forward. We route to the **earliest step by wizard order** among all missing fields, and gate resubmission on **every** `requiredFields` entry being valid. This honors the intent ("send the user to fix what's missing") while being correct for multi-field cases. Reverting is a one-line change (`requiredFields[0]`'s owning step) if a reviewer prefers the literal reading.
5. **Polling** the verification status is bounded and stops on a terminal outcome or unmount; a "still pending — retry" affordance appears when the bound is hit.
6. **No KYC PII** (`documentNumber`, `dateOfBirth`, `legalName`) is ever logged — all logging passes through a redaction helper.

---

## Testing strategy — requirement → eval traceability (E1–E8)

| # | Required test group | Test file | Pure logic? |
|---|---------------------|-----------|-------------|
| E1 | Step validation | `stepValidation.test.ts` | ✅ |
| E2 | Allowed state transitions | `transitions.test.ts` | ✅ |
| E3 | Resume from local draft | `draftStorage.test.ts` | ✅ (mock AsyncStorage) |
| E4 | Service vs local draft conflict | `conflictResolution.test.ts` | ✅ |
| E5 | `requires_more_info` routing | `conflictResolution.test.ts` / `reducer.test.ts` | ✅ |
| E6 | Approved & rejected outcomes | `reducer.test.ts` | ✅ |
| E7 | Fake service failure & retry | `fakeKycService.test.ts` | ✅ |
| E8 | Polling cleanup / bounded retry | `usePollKycStatus.test.ts` | RNTL (fake timers) |

One command: `npm test`. Coverage thresholds added in jest config as a quantitative gate.

---

## 4. AI usage summary — where AI was used and how output was verified

AI (Claude Code) was used throughout, with the human owning architecture, security, and final acceptance. The Claude Code tooling stack:

| Plugin / skill | Role |
|----------------|------|
| `/deep-plan` | Structured plan + complexity gating; writes `.claude/findings/kyc-onboarding/PLAN.md` |
| `/ticket-flow` | Executes units T2–T9 with a per-ticket QA gate + history log |
| `/eval-tickets` | Retroactive multi-grader eval of ticket execution quality |
| `/code-review` | Diff review for correctness + simplification before merge |
| `/security-review` | Verifies no PII logging, no secrets, frontend-only held |
| `/verify` | Runs the app, walks the wizard, confirms behavior matches spec |

**Accept/reject log:**

| Decision point | AI suggestion | Verdict | How verified |
|----------------|---------------|---------|--------------|
| `requires_more_info` routing | Original plan/PDF: route to `requiredFields[0]` | **Rejected** — replaced with "earliest step among all required fields" | E5 discriminating test: `['document.documentNumber','personalInfo.legalName']` must route to `personal_info`, not `document`. Documented as a divergence (§3). |
| Boot reconcile destroying local edits | First design called `clearDraft()` when the server became authoritative | **Rejected** — archive, never delete (Hole 1) | E3/E4: `archiveDraft` moves active→archive key; `reconcile` returns `archiveLocal:true` with a local draft present. |
| Draft-vs-draft tie-break | Strict `localT > serverT` (ties → server) | **Rejected** — non-strict `>=` so ties favor local; unparseable timestamps keep local | E4 discriminating tests for tie and `garbage-date`. |
| Hydration through the transition guard | Apply server status via `assertTransition` on boot | **Rejected** — `HYDRATE` is exempt; the guard only protects in-session changes | E2: a `draft→approved` HYDRATE must not throw. |
| Poll bounding | Count only successful polls toward `maxAttempts` | **Rejected** — count **every** settle incl. errors; `cancelledRef` no-ops post-unmount | E8: persistent-error path hits `onBoundHit`; unmount mid-flight fires no callbacks. |
| Poll hook shape | Positional `(active, onResult, …)` signature from the plan | **Accepted with change** — options object + injectable `poll` fn | Lets fake-timer tests inject a synchronous poll and run instantly; keeps the same behavior. |
| State management | `useReducer` + explicit transition table (vs XState) | **Accepted** | Locked decision; matches graded "reducer design" focus; zero deps, all pure-logic unit-tested. |
| Redaction scope | Mask only the four directly-identifying fields | **Accepted** | Redaction test asserts no raw PII value survives `JSON.stringify(redact(app))`; grep confirms the only `console.*` routes through `redact()`. |

**How output is verified, not just accepted:** every pure-logic module ships with unit tests (E1–E8); the security claim ("no PII logging") is checked by `/security-review` + a grep gate; behavior is confirmed by running the app via `/verify`. AI-generated transitions are validated against the explicit transition table, not trusted blindly.

---

## 5. Security & reliability considerations

- **PII handling:** legalName, dateOfBirth, nationality, documentNumber are sensitive. They are never written to logs — a redaction helper strips them before any debug output.
- **Storage:** AsyncStorage is **plaintext on device**. Acceptable for a frontend-only assessment; flagged below as a pre-merge blocker for production.
- **No secrets / no network:** frontend-only by construction — no API keys, no HTTP, no real KYC provider.
- **Reliability:** polling is bounded with cleanup so it cannot leak timers or loop forever; failures surface as rejected promises with explicit retry.

---

## 6. Self-review — what should be challenged before merging

**Challenge #1 — the `requires_more_info` routing deviates from the literal PDF wording.** The spec says "first relevant required field"; we route to the *earliest step among all* missing fields (§3). This is a deliberate correctness improvement for multi-field cases, but a reviewer should confirm the product intent — if the backend guarantees `requiredFields[0]` is always the earliest, the literal reading is equivalent and simpler.

**Challenge #2 — AsyncStorage stores KYC PII in plaintext.** Before this ships to production it must move to **encrypted-at-rest storage** (MMKV-with-encryption / SQLCipher / OS-keystore-backed) — `expo-secure-store` is the wrong tool because its ~2KB/key limit can't hold a full draft.

**Challenge #3 — conflict resolution assumes monotonic `updatedAt` clocks.** A real distributed backend can't guarantee that; it would need a server-issued version/etag for safe optimistic concurrency. The tie/unparseable→local rule is a defensive stand-in, not a substitute.

**Known simulation limit.** The fake service caches submit results by id (idempotency) and treats `requires_more_info` as authoritative, so the in-app *correction → resubmit* loop doesn't re-run verification against edited fields — the routing/gating logic (the graded part) is fully exercised by E5, but a real adapter would re-evaluate corrections server-side.

---

## 7. One product/security/production-service question before shipping

**What is the authoritative source of KYC status and its versioning/concurrency scheme (server-issued etag or optimistic-lock token), and what is the data-retention + encryption policy for abandoned drafts that contain PII?** This determines both the correct conflict-resolution contract and the compliance posture for storing identity data.

---

## Assumptions

- A single in-progress KYC application per user (no multi-application management).
- The fake service simulates one backend; deterministic triggers stand in for real verification logic.
- "Resume" means resume the wizard step + data, not in-flight network operations.

## Tradeoffs

- Hand-built reducer over XState: more boilerplate, but transparent and dependency-free.
- State-driven rendering over a nav library: manual back-handling, but a single source of truth.
- AsyncStorage over encrypted storage: faster to build + test, plaintext risk documented.

## Intentionally left out (timebox)

- Real encrypted storage, document image upload, accessibility polish, i18n, animated transitions, and exhaustive UI snapshot tests. These are noted rather than silently dropped.
