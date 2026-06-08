# BurjX Senior Mobile Engineer Assessment — KYC Onboarding State Machine

## Context

BurjX sent a take-home assessment for the Senior Mobile Engineer role. **Option 4: Multi-Step KYC Onboarding State Machine** — a frontend-only Expo / React Native / TypeScript app simulating a crypto-exchange KYC flow with a local fake service (no backend, no real KYC provider).

**Hard constraints:**
- **Deadline: TODAY — Mon 8 Jun 2026, 11:59 PM GST** (UTC+4).
- **Recorded build: 90 min target, 2 hr max**, audio + screen, uploaded to a public Drive link.
- Submission = public GitHub repo link + Drive recording link, replied by email.

**Intended outcome:** a clean, well-tested, security-aware KYC state machine that demonstrates *senior judgment* — reducer-based state model, separation of concerns, KYC data sensitivity, tested transitions/validation, and clear communication of tradeoffs + AI usage.

**This plan's role:** produce the structured decomposition. Per the user's decision, the flow is **Phase 0 (kickstart + agentic-dev setup) → `/deep-plan` → `/ticket-flow` (runs every work unit)**. Repo is a **public standalone repo** (NOT a workspace submodule).

> ⏱️ The 90min–2hr clock is the *recorded build*, separate from this planning. Keep the build lean enough to fit on camera. The recording must show YOU understanding/decomposing/deciding — narrate accept/reject of AI output as you go.

---

## Phase 0 — Project Kickstart & Agentic-Dev Setup (do FIRST, before /deep-plan)

Goal: stand up the project folder + Expo scaffold + the per-project agentic config so `/deep-plan` and `/ticket-flow` run with **zero first-run bootstrap friction**. BurjX/ becomes its own standalone git repo (separate from the `felipecpaiva/workspace` submodule tree — it currently shows as untracked `??`).

### 0.1 — Expo scaffold (at BurjX/ root, since BurjX/ is the submission repo)

```bash
cd /Users/felipepaiva/workspace/BurjX
npx create-expo-app@latest . --template blank-typescript   # scaffolds into current dir
npm install
# test stack
npx expo install jest-expo jest react-test-renderer
npm install -D @testing-library/react-native @types/jest
# persistence
npx expo install @react-native-async-storage/async-storage
```
Add to `package.json`: `"scripts": { "test": "jest" }` + a `"jest": { "preset": "jest-expo" }` block (or `jest.config.js`).

### 0.2 — Target folder structure (committed to the submission repo)

```
BurjX/
├── .claude/                              # agentic-dev tooling (kept in repo — shows AI-assisted process)
│   ├── skills/ticket-flow/project.config.md
│   ├── skills/deep-plan/project.config.md
│   ├── findings/kyc-onboarding/PLAN.md   # /deep-plan team-visible artifact target
│   └── history/                          # ticket-flow Step 11 history log
├── src/
│   ├── types/kyc.ts                      # provided Kyc* contracts + RequiredField→Step map
│   ├── state/{reducer.ts, transitions.ts, conflictResolution.ts}
│   ├── services/{fakeKycService.ts, draftStorage.ts}
│   ├── validation/stepValidation.ts
│   ├── hooks/usePollKycStatus.ts         # bounded polling
│   ├── screens/{PersonalInfoScreen,AddressScreen,DocumentScreen,ReviewScreen,StatusScreen}.tsx
│   ├── components/                       # shared form inputs, status banners
│   └── utils/redaction.ts                # strip PII before any log
├── __tests__/                            # or colocated *.test.ts (8 required groups)
├── docs/adr/                             # Architecture Decision Records (ADR-001..006)
├── App.tsx                               # state-machine host: renders step by machine state
├── CLAUDE.md                             # per-project agent instructions
├── NOTES.md                              # PDF-mandated deliverable
├── package.json / tsconfig.json / jest config
└── .gitignore
```

### 0.3 — Agentic-dev config files (write during Phase 0)

**`BurjX/CLAUDE.md`** — per-project instructions: stack (Expo/RN/TS), frontend-only constraint (no backend/HTTP/secrets), architecture rules (reducer is source of truth, UI is projection, pure-logic modules separate from UI, redaction before logging), test command `npm test`, commit rules (no AI co-author tags per workspace policy).

**`BurjX/.claude/skills/ticket-flow/project.config.md`** (no Jira — personal assessment; local ticket IDs):
```yaml
---
project_name: burjx-kyc-onboarding
ticket_prefix: KYC
github_repo: felipecpaiva/burjx-kyc-onboarding
default_branch: main
git_remote_protocol: ssh
worktree_root: /tmp
worktree_prefix: burjx-kyc
package_manager: npm
install_cmd: npm install
test_cmd: npm test
lint_cmd: npx eslint .
typecheck_cmd: npx tsc --noEmit
commit_initials: ""
copilot_review: false          # fresh public repo, no Copilot configured — avoid loop friction
history_log: true
history_root: .claude/history
mempalace_wing: burjx
qa_agent: true
qa_max_cycles: 2
qa_model: opus
redteam_planner: true
complexity_artifact_threshold: 5
playbooks_dir: ~/workspace/.claude/skills/ticket-flow/playbooks
---
## Project-specific notes
- Frontend-only Expo/RN/TS. No backend, HTTP, websocket, real KYC/exchange API, secret keys.
- Reducer + explicit transition table is the source of truth; UI is a projection of machine state.
- Pure-logic modules (reducer/validation/conflictResolution/fakeKycService) must be testable with zero RN rendering.
- Never log KYC PII (documentNumber, dateOfBirth, legalName) — route through src/utils/redaction.ts.
- One-command tests: `npm test` (jest-expo).
```

**`BurjX/.claude/skills/deep-plan/project.config.md`** (shared keys inherited from ticket-flow):
```yaml
---
plan_artifact_root: .claude/findings
claude_plans_dir: ~/.claude/plans
overwrite_existing_plan: false
max_iteration_rounds: 10
require_changelog_row_per_edit: true
require_chat_diff_per_edit: true
mempalace_wing: burjx
mempalace_search_on_phase_1: true
mempalace_write_on_phase_4: true
discoverable_by: [ticket-flow, deep-plan]
handoff_complexity_threshold: 7
playbooks_dir: ~/workspace/.claude/skills/ticket-flow/playbooks
complexity_artifact_threshold: 5
redteam_planner: true
history_log: true
history_root: .claude/history
auto_detect: false
---
```

### 0.4 — Git + public repo

```bash
cd /Users/felipepaiva/workspace/BurjX
git init && git add -A && git commit -m "chore: scaffold Expo RN TS KYC project + agentic config"
gh repo create felipecpaiva/burjx-kyc-onboarding --public --source=. --push
```
Verify fresh clone: `git clone … && cd … && npm install && npm test` runs clean.

> After Phase 0, run `/deep-plan` (it consumes the configs above, writes `.claude/findings/kyc-onboarding/PLAN.md`), then `/ticket-flow` executes the units T2–T9 below (T1 scaffold folded into Phase 0).

---

## Architecture Decisions (settled — recommendations, not open questions)

| Concern | Decision | Why |
|---------|----------|-----|
| **State model** | `useReducer` + **explicit transition table** (`Record<KycStatus, KycStatus[]>` + step map). NOT XState. | Eval focus #1 is literally "state machine/**reducer** design"; required test = "allowed state transitions." Hand-built map *demonstrates* the skill, is trivially unit-testable, zero dependency/narration overhead. |
| **Source of truth** | State machine owns `currentStep`. UI is a **projection** — conditionally render the step component. NO nav library as source of truth. | "Resume from last step" and "route requires_more_info to relevant step" both break if nav state and machine state diverge. |
| **Separation** | Pure-logic TS modules independent of UI: `reducer`, `validation`, `conflictResolution`, `fakeKycService`, `redaction`. UI is thin. | This separation IS the testability signal. Target ~80% of required tests needing zero RN rendering. |
| **Navigation** | Single host screen switches step components by machine state. (Expo Router only if scaffolding default; the wizard itself is state-driven.) | Singular source of truth. |
| **Persistence** | `AsyncStorage` for the draft (`KycApplication` + local `updatedAt`). | Standard, fast to wire, testable with a mock. |
| **Security note** | Document that production needs **encrypted-at-rest** storage (MMKV-with-encryption / SQLCipher / OS-keystore-backed), NOT secure-store (its ~2KB/key limit is wrong for a full draft). Ship a **redaction helper** so no `console.log` ever emits `documentNumber`, `dateOfBirth`, `legalName`. | Directly maps to "KYC data sensitivity" eval criterion; cheap to implement. |
| **Testing** | Jest + `jest-expo` preset + React Native Testing Library. One command: `npm test`. | Pure-logic front-loaded; RNTL only for the thin UI/validation-wiring tests. |

### Conflict strategy (the core of the assessment)

Both local draft and fake-service `KycApplication` carry `updatedAt`. On load, reconcile:

1. **Service status `draft` AND local `updatedAt` newer** → **local wins**, continue editing. (User has unsynced local changes the service hasn't seen.)
2. **Service status `submitted` | `approved` | `rejected`** → **service is authoritative**; local edits must NOT overwrite. Lock editing / drop stale local draft, surface terminal status screen.
3. **Service status `requires_more_info`** → service authoritative; **route to the first step owning `requiredFields[0]`** (map `KycRequiredField` → `KycStep`), prefill known data, let user correct.

Rule of thumb encoded in `conflictResolution.ts`: *local can only win while the service still considers it a `draft`.* Once submitted, the server is truth.

### Polling (bounded)

`pollKycStatus()` loop must be **bounded** — max-N attempts OR a max-elapsed timeout, with **cleanup on unmount** and **stop on terminal state** (`approved`/`rejected`). No infinite polling. Surface a "still pending, retry" affordance when bound is hit.

---

## Evaluation Strategy (evals — documented in NOTES.md + repo)

This is a frontend RN app, not an LLM app — so "evals" here means **behavioral acceptance evals** (the test battery) plus a **retroactive process eval** of the ticket-flow execution. Two layers:

### Layer 1 — Acceptance evals: requirement → test traceability matrix

Every one of the PDF's 8 required test groups maps to a concrete eval. Ship this matrix in NOTES.md as the testing-strategy proof:

| # | Required test group | Eval (test file) | Pure logic? |
|---|---------------------|------------------|-------------|
| E1 | Step validation | `stepValidation.test.ts` | ✅ |
| E2 | Allowed state transitions | `transitions.test.ts` | ✅ |
| E3 | Resume from local draft | `draftStorage.test.ts` | ✅ (mock AsyncStorage) |
| E4 | Service vs local draft conflict | `conflictResolution.test.ts` | ✅ |
| E5 | `requires_more_info` routing | `conflictResolution.test.ts` / `reducer.test.ts` | ✅ |
| E6 | Approved & rejected outcomes | `reducer.test.ts` | ✅ |
| E7 | Fake service failure & retry | `fakeKycService.test.ts` | ✅ |
| E8 | Polling cleanup / bounded retry | `usePollKycStatus.test.ts` | RNTL (timers) |

Target: 7/8 need zero RN rendering. One command: `npm test`. Add coverage thresholds in jest config as a quantitative eval gate.

### Layer 2 — Process eval: `/eval-tickets` retroactive grading

After ticket-flow completes T2–T9, run **`/eval-tickets`** to retroactively grade each ticket's execution (multi-grader: deterministic diff metrics + LLM rubric + outcome). Inspired by the Anthropic eval framework (task/trial model, multi-grader, pass@k). Classifies each unit FIXED_PERMANENTLY / FIXED_WITH_ITERATION / FAILED — this becomes a documented quality signal in NOTES.md ("how I verified the AI output"). Note: Jira-outcome grading is N/A (no Jira); deterministic + rubric graders apply.

> Pre-PR QA is also an eval gate: ticket-flow Step 7.5 runs an independent 5-check battery (`qa_agent: true`, `qa_max_cycles: 2`) before each PR.

---

## Architecture Decision Records (ADRs — repo `docs/adr/`, summarized in NOTES.md)

Capture each decision as a short ADR (Context · Decision · Consequences) committed to `docs/adr/`. This is the senior-judgment artifact reviewers grade.

| ADR | Decision | Rationale (1-line) | Key consequence / tradeoff |
|-----|----------|--------------------|----------------------------|
| **ADR-001** | `useReducer` + explicit transition table over XState | Eval focus #1 is "reducer design"; demonstrates the skill, zero dep | Manual transition guards; no visualizer |
| **ADR-002** | State machine owns `currentStep`; UI is a projection | Single source of truth for resume + more_info routing | No nav-library back-stack semantics; handle manually |
| **ADR-003** | AsyncStorage for draft; production needs encrypted-at-rest | Fast, testable; secure-store's ~2KB/key limit is wrong for full draft | PII in plaintext locally — flagged as pre-merge blocker |
| **ADR-004** | Conflict: local wins only while service status is `draft`; server authoritative once submitted | Prevents overwriting terminal server truth; predictable | Assumes monotonic `updatedAt` clocks (real backend needs etag/version) |
| **ADR-005** | Bounded polling (max-N / timeout, stop on terminal, cleanup on unmount) | "Don't run forever" requirement; no leaks | User must manually retry past the bound |
| **ADR-006** | Redaction helper gates all logging of `KycApplication` | "No sensitive-data logging" requirement | Slight ceremony around debug logging |

---

## Tooling & Plugins (guidance + documentation — disclose in NOTES.md AI-usage section)

The assessment explicitly grades *how* AI was used. Document the Claude Code plugin/skill stack and what each contributed:

| Plugin / skill | Role in this build |
|----------------|--------------------|
| **`/deep-plan`** | Structured 16-section plan + complexity gating; writes `.claude/findings/kyc-onboarding/PLAN.md` (team-visible artifact). |
| **`/ticket-flow`** | Executes work units T2–T9 with per-ticket QA gate (Step 7.5) + Receipt + history log. Sonnet execution, Opus QA. |
| **`/eval-tickets`** | Retroactive multi-grader eval of ticket execution quality (Layer 2 above). |
| **`/code-review`** | Diff review for correctness + simplification before PR merge. |
| **`/security-review`** | Security pass — verifies no PII logging, no secrets, frontend-only constraint held. |
| **`/verify`** | Run the app, walk the wizard, confirm behavior matches spec (resume, more_info routing, polling). |
| **mempalace (MCP)** | Search prior patterns on Phase 1; save final architecture decisions on approval (wing `burjx`). |
| **caveman** | Token-compressed responses during the session (off for security warnings / commits / this plan). |

> **AI accept/reject log:** keep a running list during the build (decision → AI suggestion → accepted/rejected → how verified). This directly populates the PDF-mandated AI-usage NOTES.md section and the recording's "where AI was used and how output was verified."

---

## Decomposition → Ticket List (build order; all run through /ticket-flow)

> Phase 0 already wrote the ticket-flow/deep-plan configs, so **no first-run bootstrap** — ticket-flow resumes straight to execution. T1 (scaffold) is done in Phase 0.

| # | Ticket | Deliverable | Key tests |
|---|--------|-------------|-----------|
| **T1** | **Scaffold** *(done in Phase 0)* | Expo TS app + jest-expo + RNTL + folder structure + `npm test` script + git + public repo. | `npm test` runs (smoke). |
| **T2** | **Types/contracts** | `src/types/kyc.ts` — the provided `KycStatus`, `KycStep`, `KycRequiredField`, `KycApplication` verbatim + `RequiredField→Step` map. | type-only. |
| **T3** | **Fake KYC service** | `src/services/fakeKycService.ts` — `fetchKycApplication`, `saveKycDraft`, `submitKycApplication`, `pollKycStatus`. `delay()` helper, deterministic state triggers, in-memory idempotency map, failures as **rejected promises**. | failure + retry; deterministic states; idempotency. |
| **T4** | **State machine** | `src/state/{reducer.ts,transitions.ts}` — reducer + allowed-transition table + the 3 conflict cases (`conflictResolution.ts`). | allowed transitions; conflict (local-newer-vs-draft, server-terminal-wins, more_info routing). |
| **T5** | **Persistence + resume** | `src/services/draftStorage.ts` (AsyncStorage save/load) + resume-from-last-step on reload + don't-lose-unsynced-changes + `redaction.ts`. | resume from local draft; no sensitive-data logging. |
| **T6** | **UI — 5 step screens** | `personal_info`, `address`, `document`, `review`, `status` screens + per-step validation wiring + all async states (loading/saving/submitting/polling/retry/approved/rejected/more_info). | step validation; more_info routes to correct screen. |
| **T7** | **Polling** | Bounded poll hook (max-N/timeout) + cleanup on unmount + stop on terminal. | polling cleanup / bounded retry. |
| **T8** | **Required tests** | The 8 required groups, pure-logic front-loaded (T4/T5/T3 cover most). Fill gaps: approved & rejected outcomes. | all 8 green via `npm test`. |
| **T9** | **NOTES.md + recording prep** | `NOTES.md` per the PDF checklist; pre-staged recording talking points. | — |

---

## NOTES.md checklist (PDF-mandated sections)

Setup · how to run app · how to run tests · architecture choices · testing strategy · **AI usage summary (accepted/rejected, how verified)** · security/reliability considerations · assumptions · tradeoffs · **what was intentionally cut for the timebox**.

> Keep a running accept/reject log during the build — the AI-usage section then writes itself.

## Recording talking points (pre-staged — PDF requires both)

- **"One thing to challenge before merging":** AsyncStorage stores KYC PII in plaintext — production must move to encrypted-at-rest storage before this ships; the conflict resolution also assumes monotonic `updatedAt` clocks which a real distributed backend can't guarantee (needs server-issued version/etag).
- **"One product/security/production question before shipping":** What is the authoritative source for KYC status and its versioning scheme (server etag / optimistic-lock token), and what is the data-retention + encryption policy for abandoned drafts containing PII?

---

## Verification (end-to-end)

1. `npm test` — all 8 required test groups green, one command.
2. `npx expo start` — walk the wizard: personal → address → document → review → submit.
3. Reload app mid-draft → resumes at last step with data intact (resume + don't-lose-unsynced).
4. Trigger deterministic fake-service states: `requires_more_info` (routes to correct step), `approved`, `rejected`, network failure → retry.
5. Polling stops on terminal state and on unmount; bound is hit gracefully.
6. `grep` confirms no `console.log` of `documentNumber`/`dateOfBirth`/`legalName`.
7. Push to **public** standalone GitHub repo; confirm clone + `npm install && npm test` works fresh.
8. Record the build session (audio+screen), upload to public Drive, reply to email with both links.

## Out of scope (frontend-only constraint)

No backend, server, DB, HTTP/websocket, Firebase/Supabase, real exchange/KYC API, blockchain SDK, secret keys, or document-upload service. All service behavior = local async TS.
