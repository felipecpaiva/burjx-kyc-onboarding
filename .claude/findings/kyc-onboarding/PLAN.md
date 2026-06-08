# BurjX KYC Onboarding State Machine — Deepened Implementation Plan (T2–T9)

| Round | Sections changed | Change summary |
|-------|------------------|----------------|
| 1 | (all) | Initial deepened design from approved master plan + Plan-agent spec + red-team pass |
| 2 | Open questions, E1 | User decisions: rejected=terminal (default kept); enforce DOB age ≥ 18 (override) |

> **Authoritative artifact** for `/ticket-flow` execution. Supersedes the master-plan mirror previously seeded here. The approved master plan (context, decomposition rationale, recording points) remains at `~/.claude/plans/we-got-a-email-mossy-whale.md`. Phase 0 (scaffold + agentic config) is **done**; this plan specifies T2–T9 at implementation grain.

## Context

Frontend-only Expo / RN / TS multi-step KYC onboarding state machine. Scaffold green (Expo SDK 56, React 19.2, RN 0.85, AsyncStorage 2.2.0, RNTL 13.3.3, jest-expo). The build was decomposed into units T2–T9; this document deepens each to remove implementation ambiguity, and resolves 6 red-team findings on the core conflict/transition logic.

## Complexity: 7/10

| Axis | Score | Note |
|------|-------|------|
| cross_cutting | 2 | state + storage + async/service-sim + UI |
| lifecycle | 2 | app reload/resume, mount/unmount poll cleanup |
| platform | 1 | RN/Expo, frontend-only, only native dep is AsyncStorage |
| prior_incident | 0 | greenfield |
| test_surface | 2 | 8 required test groups |

Score ≥ 7 → red-team pass run (results in "Red-team resolutions" below).

## Architecture (settled — do not relitigate)

- `useReducer` + explicit transition table (NOT XState). The machine owns `currentStep`; UI is a projection.
- Pure-logic modules (`types`, `transitions`, `reducer`, `conflictResolution`, `validation`, `fakeKycService`, `draftStorage`, `redaction`) independent of RN → unit-testable with zero rendering.
- AsyncStorage for the draft + a `redact()` helper gating all logging of PII.
- Bounded polling.
- **Single source of truth for fields:** `REQUIRED_FIELD_TO_STEP` (T2). Per-step validation (T9) and `requires_more_info` routing (T4) both derive from it — no duplicated field lists.

---

## Red-team resolutions (MUST be implemented as specified)

The original design had 6 holes. The fixes below are folded into the per-unit specs that follow.

| # | Hole | Requirement violated | Fix (authoritative) |
|---|------|----------------------|---------------------|
| 1 | `clearDraft()` on server-authoritative boot destroys unsynced local edits | "Do not silently lose unsynced local changes" | **Archive, never delete.** On boot when server wins AND server is authoritative, move the local draft to an archive key `burjx.kyc.draft.archived.v1` (do not `removeItem`). Surface a non-destructive notice. Server still wins for active machine state. |
| 2 | `requires_more_info` merge keeps stale server fields over newer local edits | "Do not silently lose unsynced local changes" | In the more_info prefill, for **editable** fields (personalInfo/address/document) prefer the **local** value when `localUpdatedAt > server.updatedAt`; only status/decision metadata (`status`, `requiredFields`, `rejectionReason`) is server-authoritative. |
| 3 | Routing to `requiredFields[0]` can skip earlier missing steps | "Validate required fields per step" + resubmit completeness | Route to the **earliest** wizard step among ALL `requiredFields` (min by `WIZARD_ORDER` index). Gate Submit (from a more_info correction) on **every** `requiredFields` entry being valid, not just the routed one. |
| 4 | (a) `draft→draft` contradicts `canTransition` identity rule; (b) boot applies server status not table-legal | "Allowed state transitions" / resume / case (b) | **Hydration is not a transition.** Add a `HYDRATE` reducer action that sets state from reconcile output WITHOUT consulting `canTransition`. `assertTransition` guards only genuine status *changes* during the session (submit/poll). A draft re-save keeps status `draft` and does NOT pass through `assertTransition`. |
| 5 | Timestamp compare drops legitimately-newer local; ties → server | case (a) "local newer wins" + don't-lose | Normalize BOTH timestamps via `Date.parse` (both are ISO-8601). For `draft`-vs-`draft`: local wins when `localT >= serverT` (**tie favors local** — protects in-progress edits). If either timestamp is unparseable, treat as a **conflict → keep local** (don't silently discard). |
| 6 | Poll error path unbounded; in-flight resolve after unmount reschedules | "Bound polling; cleanup" | Count **all** attempts (success AND error) against `maxAttempts`. Use a `cancelledRef` set in the effect cleanup; check it before every `onResult`/`onError`/reschedule so a poll resolving after unmount is a no-op. Stop unconditionally on terminal/more_info. |

---

## T2 — `src/types/kyc.ts`

Provided contracts verbatim (`KycStatus`, `KycStep`, `KycRequiredField`, `DocumentType`, `KycApplication`) plus:

```ts
export const REQUIRED_FIELD_TO_STEP: Record<KycRequiredField, KycStep> = {
  'personalInfo.legalName':   'personal_info',
  'personalInfo.dateOfBirth': 'personal_info',
  'personalInfo.nationality': 'personal_info',
  'address.country':          'address',
  'address.city':             'address',
  'address.line1':            'address',
  'document.type':            'document',
  'document.documentNumber':  'document',
};
export const WIZARD_ORDER = ['personal_info','address','document','review','status'] as const;
export const EDITABLE_STEPS = ['personal_info','address','document'] as const;

// inverse map, derived (used by T9 validation)
export const STEP_REQUIRED_FIELDS: Record<KycStep, KycRequiredField[]>; // reduce over REQUIRED_FIELD_TO_STEP

export interface LocalDraft { application: KycApplication; localUpdatedAt: string; } // ISO

export const SERVER_AUTHORITATIVE_STATUSES: KycStatus[] = ['submitted','requires_more_info','approved','rejected'];
export const TERMINAL_STATUSES = ['approved','rejected'] as const;
export const isTerminalStatus = (s: KycStatus): boolean => (TERMINAL_STATUSES as readonly string[]).includes(s);
export const isServerAuthoritative = (s: KycStatus): boolean => SERVER_AUTHORITATIVE_STATUSES.includes(s);

// earliest wizard step among a set of required fields (Hole 3)
export function earliestStepFor(fields: KycRequiredField[]): KycStep {
  const steps = fields.map(f => REQUIRED_FIELD_TO_STEP[f]);
  return WIZARD_ORDER.find(s => steps.includes(s)) ?? 'personal_info';
}
```

## T3 — `src/services/fakeKycService.ts`

Deterministic, test-controllable. Outcome decided at **submit** time from `document.documentNumber` sentinel; poll advances a counter toward it.

- Module state: `{ current: KycApplication|null, submitResults: Map<id,KycApplication>, pollCount: number, pendingTerminal: KycApplication|null }`.
- `delay(ms=150)` helper.
- `POLLS_UNTIL_TERMINAL = 3`.
- `__resetKyc(seed?)` — single test-control surface; resets all module state.
- Sentinels (documentNumber): `'NETFAIL'` → submit **rejects** `Error('NETWORK_ERROR')` (NOT cached, so retry works); prefix `'REJECT'` → poll eventually `rejected` + `rejectionReason`; prefix `'MOREINFO'` → poll eventually `requires_more_info` with `requiredFields: ['document.documentNumber']`; else → `approved`.
- `fetchKycApplication()` → returns `current` or a default `not_started` app.
- `saveKycDraft(patch)` → if `isServerAuthoritative(current.status)` return current unchanged (server wins); else merge patch, force `status:'draft'`, stamp `updatedAt`.
- `submitKycApplication(id)` → idempotent by `id` (cached submitted result); throw on `NETFAIL` BEFORE caching; set `pendingTerminal`, `status:'submitted'`, `currentStep:'status'`.
- `pollKycStatus()` → if already terminal/more_info return current; else increment `pollCount`; at `>= POLLS_UNTIL_TERMINAL` return `pendingTerminal`.

## T4 — state machine

### `src/state/transitions.ts`
```ts
export const ALLOWED_TRANSITIONS: Record<KycStatus, KycStatus[]> = {
  not_started:        ['draft'],
  draft:              ['submitted'],                         // status CHANGE only (re-save stays draft, not a transition)
  submitted:          ['approved','rejected','requires_more_info'],
  requires_more_info: ['draft','submitted'],
  approved:           [],
  rejected:           [],
};
// Identity (from===to) is NOT a transition — re-saving a draft does not call this. (Hole 4a)
export function canTransition(from: KycStatus, to: KycStatus): boolean {
  return from !== to && ALLOWED_TRANSITIONS[from].includes(to);
}
export function assertTransition(from: KycStatus, to: KycStatus): void {
  if (from !== to && !ALLOWED_TRANSITIONS[from].includes(to))
    throw new Error(`Illegal KYC transition ${from} → ${to}`);
}
```
**Hydration is exempt** (Hole 4b): boot/reconcile applies server truth via the `HYDRATE` action, which does NOT call `assertTransition`. `assertTransition` guards only in-session status changes (SUBMIT_SUCCESS, POLL_TICK).

### `src/state/reducer.ts`
- `MachineState { machineStatus: 'idle'|'loading'|'saving'|'submitting'|'polling'|'error'; application: KycApplication|null; currentStep: KycStep; validationErrors; error: {message; retryable}|null; pollAttempts; pollBoundHit; archivedNoticeShown }`.
- Actions: `BOOT_START`, `HYDRATE{application,currentStep,winner,reason}` (exempt from transition guard), `EDIT_FIELD`, `SET_STEP`, `VALIDATE_STEP`, `NEXT_STEP`, `PREV_STEP`, `SAVE_START/SUCCESS/ERROR`, `SUBMIT_START/SUCCESS/ERROR{retryable}`, `POLL_START/TICK/BOUND_HIT/ERROR`, `RETRY`, `RESET`.
- `SUBMIT_SUCCESS` and `POLL_TICK` call `assertTransition(prev.status, next.status)`; on illegal keep prev + set defensive `error`.
- `POLL_TICK` with `requires_more_info` sets `currentStep = earliestStepFor(requiredFields)` (Hole 3).
- `currentStep` changes ONLY via reducer; `application.currentStep` is seed-only.

### `src/state/conflictResolution.ts` (pure) — with Holes 1,2,5
```ts
export interface Reconciled { winner:'local'|'server'; application:KycApplication; nextStep:KycStep; reason:string; archiveLocal:boolean; }

export function reconcile(local: LocalDraft|null, server: KycApplication): Reconciled {
  if (isServerAuthoritative(server.status)) {
    if (server.status === 'requires_more_info') {
      const fields = server.requiredFields ?? [];
      const nextStep = earliestStepFor(fields);                       // Hole 3
      const application = local ? prefill(server, local) : server;    // Hole 2: per-field newest-wins for editable fields
      return { winner:'server', application, nextStep, reason:'requires_more_info routing', archiveLocal:false };
    }
    // submitted / approved / rejected → server authoritative; preserve local by archiving (Hole 1)
    return { winner:'server', application:server, nextStep:'status',
             reason:`server ${server.status} authoritative`, archiveLocal: !!local };
  }
  // server is not_started | draft
  if (!local) return { winner:'server', application:server, nextStep: server.currentStep ?? 'personal_info', reason:'no local draft', archiveLocal:false };
  const localT = Date.parse(local.localUpdatedAt), serverT = Date.parse(server.updatedAt);
  const unparseable = !Number.isFinite(localT) || !Number.isFinite(serverT);
  if (unparseable || localT >= serverT) {                              // Hole 5: tie & unparseable favor local
    return { winner:'local', application:local.application, nextStep: local.application.currentStep ?? 'personal_info',
             reason: unparseable ? 'unparseable timestamps -> keep local (dont lose)' : 'local >= server draft', archiveLocal:false };
  }
  return { winner:'server', application:server, nextStep: server.currentStep ?? 'personal_info', reason:'server strictly newer', archiveLocal:false };
}
```
`prefill(server, local)`: returns server with editable sub-objects (personalInfo/address/document) overlaid from local **only when** `Date.parse(local.localUpdatedAt) > Date.parse(server.updatedAt)`; never alters `status`/`requiredFields`/`rejectionReason`.

## T5 — `src/services/draftStorage.ts` + `src/utils/redaction.ts`

- Keys: `burjx.kyc.draft.v1` (active), `burjx.kyc.draft.archived.v1` (Hole 1 archive).
- `saveDraft(app)` → write `{application, localUpdatedAt: now}`; on `setItem` reject throw `DraftSaveError` (caller shows non-fatal banner, keeps in-memory state).
- `loadDraft()` → parse + shape-validate; corrupt/throw → `null` (never crash).
- `archiveDraft()` → copy active → archive key, then remove active. Used when `reconcile().archiveLocal === true`.
- `clearDraft()` → remove active (used only after the user starts a genuinely new application, never to discard unsynced edits on boot).
- **Resume flow:** `BOOT_START` → `Promise.all([loadDraft(), fetchKycApplication()])` → `reconcile` → if `archiveLocal` then `archiveDraft()` (+ set notice) → `HYDRATE{application, currentStep:nextStep}`.
- `redact(app)` → log-safe object masking `legalName`, `dateOfBirth`, `documentNumber`, `address.line1` with `'***'`; keeps `status/currentStep/id/updatedAt/has*`. Nothing logs raw PII; grep gate in verification.

## T6 — UI projection (`App.tsx` + `src/screens/`)

`App.tsx` holds `useReducer`, runs boot effect (T5 resume), renders by `(machineStatus, application.status, currentStep)`:

| Condition | Render |
|-----------|--------|
| `machineStatus==='loading'` | `<LoadingView/>` |
| `application.status==='approved'` | `<StatusScreen variant="approved"/>` |
| `application.status==='rejected'` | `<StatusScreen variant="rejected" reason/>` |
| `application.status==='requires_more_info'` | routed editable screen + more-info banner listing missing fields |
| `application.status==='submitted'` | `<StatusScreen variant="pending"/>` (poll hook) |
| `error` present | inline banner + Retry (`RETRY`) |
| else (`draft`/`not_started`) | `currentStep` screen + (if archived notice) a non-destructive banner |

Screens: PersonalInfo, Address, Document (typed picker), Review (real values shown to user; redaction is logs-only; Submit → `SUBMIT_START`), Status (variants). "Next" gated by `validateStep`; on pass → `saveKycDraft` → `SAVE_SUCCESS` → `saveDraft` → `NEXT_STEP`. Submit from more_info gated on ALL `requiredFields` valid (Hole 3). Async states disable inputs + inline spinner; only boot blocks full screen.

## T7 — `src/hooks/usePollKycStatus.ts` (Hole 6)

`usePollKycStatus(active, onResult, onBoundHit, onError, {maxAttempts=5, intervalMs=2000})`:
- recursive `setTimeout` (no overlap); `attemptsRef` increments on **every** settle incl. errors.
- `cancelledRef` set true in cleanup; checked before every `onResult`/`onError`/reschedule.
- stop on terminal/more_info; at `attempts >= maxAttempts` call `onBoundHit` once.
- both bounds injectable so fake-timer tests run instantly. Retry affordance re-arms `active`.

---

## E1–E8 test plan (pure-logic front-loaded; only E8 needs RNTL)

- **E1 `validation/stepValidation.test.ts`** — valid/empty each field; DOB empty/`'not-a-date'`/future/**under-18 (error)**/**valid 18+ (ok)**; whitespace documentNumber; missing document type.
- **E2 `state/transitions.test.ts`** — table membership for every legal edge; `assertTransition` throws on `approved->*`, `rejected->*`, `not_started->submitted`, `submitted->draft`, `draft->approved`; legal: `submitted->{approved,rejected,requires_more_info}`, `requires_more_info->{draft,submitted}`; **HYDRATE applies `draft->approved` without throwing** (Hole 4b).
- **E3 `services/draftStorage.test.ts`** (mock AsyncStorage) — save/load round-trip; clear→null; corrupt JSON→null; getItem reject→null; setItem reject→throws `DraftSaveError`; **archiveDraft moves active→archive, active gone, archive present** (Hole 1).
- **E4 `state/conflictResolution.test.ts`** — local newer + server draft → local; local older → server; **tie + draft → local** (Hole 5); **unparseable → local + archiveLocal false** (Hole 5); local + server submitted → server, nextStep status, **archiveLocal true** (Hole 1); approved/rejected → server.
- **E5 `conflictResolution.test.ts` + `reducer.test.ts`** — more_info `['document.documentNumber']`→`document`; `['address.city']`→`address`; **`['document.documentNumber','personalInfo.legalName']`→`personal_info` (earliest, Hole 3)**; `[]`→`personal_info`; **prefill keeps newer local editable field over stale server (Hole 2)**; reducer POLL_TICK more_info sets routed step.
- **E6 `reducer.test.ts`** (drives fake service) — approved path (docNumber `'PASS123'`, submit, poll×K → approved, transition applied); rejected path (`'REJECT1'` → rejected + reason); StatusScreen variant mapper.
- **E7 `services/fakeKycService.test.ts`** — `'NETFAIL'` submit rejects `NETWORK_ERROR`, not cached; retry with `'PASS'` resolves; idempotent double-submit returns cached; poll before submit → default (no crash).
- **E8 `hooks/usePollKycStatus.test.ts`** (RNTL + fake timers) — advance K×interval → onResult approved, no further timers (stop-on-terminal); never-settling path → onBoundHit once at maxAttempts, no further polls; **error path counts toward bound** (Hole 6a); **unmount mid-poll → no onResult/onError after (cancelledRef, Hole 6b)**.

Add jest coverage thresholds as a quantitative gate.

## Edge cases (handled)

clock skew (ADR-004 + Hole 5 tie/unparseable→local); partial draft (per-step validation gates advance); reload during submit/poll (boot reconcile lands correct screen, idempotency guards double-submit); requiredFields empty + more_info (→ personal_info); idempotency key collision (single user, none); AsyncStorage throws (load→null, save→DraftSaveError non-fatal); corrupt/old-schema draft (versioned key + shape validate → null); illegal server transition (assertTransition defensive); poll error (bounded + cancelledRef).

## Open questions / assumptions (defaults chosen — confirm or override)

1. **`rejected` terminal vs restartable** — default **terminal** (`[]`). KYC rejections are typically final. If product wants resubmission, add `rejected -> draft`.
2. **Resubmit from `requires_more_info`** — default **allow both** `['draft','submitted']` (edit→save→draft, or correct-in-place→resubmit).
3. **Age ≥ 18 check on DOB** — **DECIDED: enforce 18+** (user override, 2026-06-08). `isPlausibleDOB` requires non-empty, parseable, not-future, AND computed age ≥ 18 (floor of years between DOB and today). Under-18 → validation error.
4. **Unsynced edits when server already advanced** — resolved as **archive, not delete** (Hole 1); user is notified, edits preserved under archive key.

## Verification

`npm test` (E1–E8 green) · `npx expo start` walk wizard · reload mid-draft resumes + preserves unsynced · trigger more_info/approved/rejected/NETFAIL→retry · poll stops on terminal & unmount · grep no PII in console.log · fresh clone `npm install && npm test` clean.

## Resume point

Next: `/ticket-flow` builds T2→T9 in order against this spec (each unit ships with its E-tests). T2/T3/T4 are the critical path; T4 carries all 6 red-team fixes. After T9, run `/eval-tickets` (retro grading), `/code-review`, `/security-review`, then finalize NOTES.md AI accept/reject log.
