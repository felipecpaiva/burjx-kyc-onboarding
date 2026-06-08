# Architecture Decision Records

Each ADR captures one significant decision: **Context → Decision → Consequences**. These are the senior-judgment artifacts behind the KYC onboarding state machine. Summarized in `NOTES.md`; full records added per decision during the build.

| ADR | Decision | Rationale | Key consequence / tradeoff |
|-----|----------|-----------|----------------------------|
| ADR-001 | `useReducer` + explicit transition table over XState | Eval focus #1 is "reducer design"; demonstrates the skill, zero dependency | Manual transition guards; no state-chart visualizer |
| ADR-002 | State machine owns `currentStep`; UI is a projection | Single source of truth for resume + `requires_more_info` routing | No nav-library back-stack; handled manually |
| ADR-003 | AsyncStorage for draft; production needs encrypted-at-rest | Fast, testable; `expo-secure-store`'s ~2KB/key limit is wrong for a full draft | PII stored in plaintext locally — flagged as a pre-merge blocker |
| ADR-004 | Conflict: local wins only while service status is `draft`; service authoritative once submitted | Prevents overwriting terminal server truth; predictable reconciliation | Assumes monotonic `updatedAt` clocks (a real backend needs etag/version) |
| ADR-005 | Bounded polling (max-N / timeout, stop on terminal, cleanup on unmount) | "Must not run forever" requirement; no leaked timers | User must manually retry past the bound |
| ADR-006 | Redaction helper gates all logging of `KycApplication` | "No sensitive-data logging" requirement | Slight ceremony around debug logging |

## Format

```
# ADR-NNN: <title>
- Status: accepted | superseded
- Context: why this decision was needed
- Decision: what we chose
- Consequences: tradeoffs, follow-ups, what this rules out
```
