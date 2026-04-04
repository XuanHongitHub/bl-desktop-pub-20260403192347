# Selective Sync Policy (Must/Optional/Never)

**Change ID:** topic4-auth-sync-security-readiness  
**Phase:** 2.3 (P0)

## Goal
Keep cloud sync deterministic, lightweight, and cost-controlled while preserving core continuity.

## Policy Tiers
- `Must Sync`: required for identity/session continuity across approved multi-device flows.
- `Optional Sync`: user/team configurable by policy and quota.
- `Never Sync`: volatile/high-cost/high-risk artifacts.

## Container Classification (Baseline)

| Container | Tier | Rationale |
|---|---|---|
| Cookies / session cookies | Must Sync | Core login continuity |
| Selected local storage/indexedDB scopes (allow-list) | Must Sync | App-critical session behavior |
| Profile metadata (tags/group/owner/sync mode) | Must Sync | Governance and visibility |
| Tabs/session restore manifest | Optional Sync | UX continuity, not always mandatory |
| Extensions metadata (not full binaries) | Optional Sync | Reproducibility with bounded size |
| Cache/code cache/temp files | Never Sync | High churn, low continuity value |
| Lock files/crash dumps/runtime PID files | Never Sync | Device-local operational artifacts |

## Sync Trigger Policy
- Do not sync on every keystroke/change.
- Sync at explicit commit points (manual sync, safe stop, scheduled checkpoint).
- Coalesce frequent updates into bounded batches.

## Size and Cost Guardrails
- Apply per-profile soft and hard sync-size thresholds.
- Warn user before optional containers push payload beyond threshold.
- Block never-sync containers regardless of user request unless admin override policy exists.

## Minimum Acceptance
- Effective include/exclude policy is visible per profile.
- No volatile cache/container accidentally included in default sync payload.
- Must-sync set is stable across app versions (or migrated explicitly).
