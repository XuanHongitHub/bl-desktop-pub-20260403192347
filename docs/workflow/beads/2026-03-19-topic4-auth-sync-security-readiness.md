# Bead: Topic 4 - Auth, Sync, Security, and Release Readiness

- Date: 2026-03-19
- Owner: Codex + User
- Status: active
- OpenSpec Change: openspec/changes/topic4-auth-sync-security-readiness/

## Execution Items
- [x] Establish unified proposal/tasks/spec delta
- [x] Finalize v1 must-have scope and phase boundaries
- [ ] Execute P0 implementation and verification gates
- [ ] Execute P1 governance and cost controls
- [ ] Candidate rollout + rollback rehearsal + signoff

## Notes
This bead unifies previously separate discussions into one release program.
Phase 0 (P0-P4 priority ladder + escalation rules) completed on 2026-03-19:
- p0-p4-case-matrix.md
Phase 1 (P0 Data and Security Contracts) completed on 2026-03-19 with four docs:
- data-classification-matrix.md
- local-encryption-architecture.md
- secret-handling-policy.md
- threat-model-and-trust-boundary.md
Phase 2 (P0 Session/Sync Contracts) documented on 2026-03-19:
- runtime-contract.md
- stop-semantics-and-force-terminate.md
- selective-sync-policy.md
- commit-points-and-close-safe-ux.md
- conflict-and-stale-state-handling.md
Phase 3 (P0 Auth Contracts) documented on 2026-03-19:
- kmedia-token-exchange-contract.md
- device-session-lifecycle.md
- reauth-and-degraded-mode-policy.md
- dev-bypass-mode-contract.md
Phase 4 (P1 Team Governance Contracts) documented on 2026-03-19:
- role-matrix-and-backend-enforcement.md
- share-move-group-transfer-semantics.md
- profile-lock-heartbeat-and-takeover-policy.md
- offboarding-flow-and-ownership-safety.md
- audit-trail-taxonomy-and-coverage.md
Phase 5 (P1 Cost/Scale Contracts) documented on 2026-03-19:
- profile-team-quota-model.md
- pre-sync-size-estimation-and-large-sync-warnings.md
- request-egress-budget-alerts-and-operator-dashboards.md
- lifecycle-cleanup-policy-for-stale-and-volatile-artifacts.md
Phase 6 (P0 Release/Rollout Contracts) documented on 2026-03-19:
- release-gate-checklist.md
- canary-and-feature-flag-rollout.md
- rollback-and-data-compatibility-playbook.md
- cross-platform-smoke-and-regression-matrix.md
Implementation slice (2026-03-19):
- Parked-state event consistency in status ticker and frontend running-state hook
- Park fallback-to-terminate for unsupported/ephemeral stop flows
- Runtime reconciliation marks stale parked process as `Crashed`
