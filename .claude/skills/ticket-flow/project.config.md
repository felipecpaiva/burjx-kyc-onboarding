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
lint_cmd: npx tsc --noEmit
typecheck_cmd: npx tsc --noEmit
commit_initials: ""
copilot_review: false
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
- Reducer + explicit transition table (`src/state/`) is the source of truth, including `currentStep`; UI is a projection of machine state — never let a nav library own state.
- Pure-logic modules (`reducer`, `transitions`, `conflictResolution`, `validation`, `fakeKycService`, `redaction`) must be testable with zero RN rendering. Target ~80% of tests pure-logic.
- Never log KYC PII (`documentNumber`, `dateOfBirth`, `legalName`, full `KycApplication`) — route through `src/utils/redaction.ts`.
- Conflict rule: local wins only while service status is `draft`; once `submitted`/`approved`/`rejected`, service is authoritative; `requires_more_info` routes to first step owning `requiredFields[0]`.
- Polling must be bounded (max-N/timeout), stop on terminal state, clean up on unmount.
- One-command tests: `npm test` (jest-expo). `npm install` relies on `.npmrc` `legacy-peer-deps=true`.
- No Jira — personal assessment. Ticket IDs are local (KYC-T2 … KYC-T9 per the approved plan).
