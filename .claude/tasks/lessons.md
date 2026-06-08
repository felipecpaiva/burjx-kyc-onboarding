# Lessons (failsafe backup — primary store is mempalace wing `burjx`)

## KYC build — T2–T9 complete
- **Date**: 2026-06-08
- **Tags**: dev, kyc
- **Learning**: Full Expo/RN/TS KYC state machine built T2→T9 against the approved PLAN.md (no per-unit re-plan). 102 tests green (10 suites), tsc clean, coverage ≥80% on pure-logic modules. Branch `feat/kyc-state-machine-t2-t9` (unpushed). Deliberate divergence from PDF: route requires_more_info to earliest step among all requiredFields, not requiredFields[0] (documented in NOTES §3/§6).

## Coverage gate excluded the integration layer — all 3 real bugs lived there
- **Date**: 2026-06-08
- **Tags**: testing, mistakes
- **Learning**: The jest coverage gate covered only pure-logic modules; App.tsx/screens were excluded and untested, and all three QA-caught bugs lived in that wiring layer. Add at least one integration test (render App + mock service modules) when the gate excludes the composition root.
- **Bug 1 (resume)**: in-memory service returns fresh-stamped `not_started` default on reload → beat the persisted draft in reconcile's timestamp compare → resume lost the draft. Fix: `not_started` server ⇒ local draft wins.
- **Bug 2 (more_info loop)**: corrections never persisted before resubmit + id-keyed idempotency cache replayed stale submitted → data loss + infinite bounce. Fix: service accepts more_info edits (→draft) + invalidates cache on merge; App persists before resubmit; `seedKyc` for boot memory.
- **Bug 3 (poll error)**: `active` gated on `machineStatus !== 'error'` + `POLL_ERROR` set `'error'` → one transient error tore down the loop (Hole 6a dead in-app though E8 green). Fix: `POLL_ERROR` stays `'polling'`; drop the machineStatus gate.

## tsconfig: jest globals not auto-loaded under expo base
- **Date**: 2026-06-08
- **Tags**: config, testing
- **Learning**: `expo/tsconfig.base` uses `moduleDetection: "force"` with no `types` array → `tsc --noEmit` failed with TS2593 on `describe/it/expect` even though jest ran (babel). Fix: add `"types": ["jest", "node", "react"]` to tsconfig. `jest.advanceTimersByTimeAsync(ms)` flushes microtasks so recursive-setTimeout poll loops are testable; inject the poll fn for instant fake-timer tests.
