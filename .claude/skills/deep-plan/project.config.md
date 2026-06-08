---
# /deep-plan project configuration — burjx-kyc-onboarding
# Shared keys mirror .claude/skills/ticket-flow/project.config.md

# ─── Plan artifact paths ───────────────────────────────────────────────
plan_artifact_root: .claude/findings
claude_plans_dir: ~/.claude/plans
overwrite_existing_plan: false

# ─── Iteration ─────────────────────────────────────────────────────────
max_iteration_rounds: 10
require_changelog_row_per_edit: true
require_chat_diff_per_edit: true

# ─── Mempalace integration ─────────────────────────────────────────────
mempalace_wing: burjx
mempalace_search_on_phase_1: true
mempalace_search_on_phase_3: true
mempalace_write_on_phase_4: true
mempalace_write_on_completion: true
mempalace_drawer_prefix: project_

# ─── Failure handling ──────────────────────────────────────────────────
non_blocking_phase_failures: true
failure_log_root: .claude/findings/deep-plan/_failures

# ─── Cross-skill discovery ─────────────────────────────────────────────
discoverable_by: [ticket-flow, deep-plan, audit-and-fix]
handoff_complexity_threshold: 7

# ─── Shared with ticket-flow ───────────────────────────────────────────
playbooks_dir: ~/workspace/.claude/skills/ticket-flow/playbooks
complexity_artifact_threshold: 5
redteam_planner: true
history_log: true
history_root: .claude/history

# ─── Auto-detect Phase 0 ───────────────────────────────────────────────
auto_detect: false
heuristic_threshold: 2
suggestion_style: text
---

## Notes

- Greenfield frontend-only Expo/RN/TS KYC state machine. The approved master plan lives at
  `~/.claude/plans/we-got-a-email-mossy-whale.md`; team-visible artifact target is
  `.claude/findings/kyc-onboarding/PLAN.md`.
- Decomposition (T2–T9) is already defined in the master plan; deep-plan runs deepen per-unit
  design where complexity ≥ threshold before handing to /ticket-flow.
