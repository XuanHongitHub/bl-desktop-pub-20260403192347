# P0-P4 Operational Case Matrix

**Change ID:** topic4-auth-sync-security-readiness  
**Purpose:** Single priority ladder for implementation and incident handling.

## Priority Definitions
- `P0` Critical: must hold to prevent data/session loss or security breach.
- `P1` High: strong reliability and governance controls needed for production stability.
- `P2` Medium: important UX/operational quality, can be delayed if P0/P1 unfinished.
- `P3` Low: optimization and operator convenience.
- `P4` Backlog: optional improvements and experiments.

## Core Matrix

| Priority | Domain | Baseline Case (same level) | Higher Escalation Case | Lower/Deferred Case | Exception Case | Required Handling |
|---|---|---|---|---|---|---|
| P0 | Session continuity | Stop profile then reopen keeps cookies/session/tabs in supported mode | Forced terminate/OS crash during write | Volatile cache loss accepted | Corrupted session snapshot | Never silently lose critical continuity; mark state and provide recovery path |
| P0 | Auth/token | Access token expires and refresh succeeds | Refresh token revoked from KMedia | Dev mode bypass in non-prod | Token decrypt failure locally | Move to deterministic `reauth_required` state; block protected actions, preserve local non-secret workflows |
| P0 | Sync correctness | Normal selective sync commit | Two devices update same profile concurrently | Read-only second device mode | Partial upload/network cut | No hidden overwrite; expose conflict state and deterministic resolution |
| P0 | Secret safety | Secret stored encrypted locally | Host compromise suspicion | Debug build logging enabled | Crash report captured during auth call | No plaintext secret in disk/log/event; immediate revoke + rotate process |
| P1 | Team permissions | Owner/admin/member/viewer policy enforcement | Unauthorized force-takeover attempt | Temporary read-only fallback for member | Stale lock after user disconnect | Enforce backend ACL + lock timeout + audit event for every protected action |
| P1 | Offboarding | Employee removed from team | Employee had active write sessions on many devices | Delayed ownership transfer allowed for non-critical profiles | Last owner leaves unexpectedly | Revoke sessions, release locks, transfer ownership by policy, no orphan profile |
| P1 | Cost controls | Team under normal quota | Sudden large sync spike | Soft warning only under threshold | Runaway egress from wrong include policy | Pre-sync estimate + hard cap + warning + operator alert |
| P2 | UX transparency | Show sync status and last commit point | User closes app with pending write | Passive hint only when all data safe | Local disk nearly full | Must clearly communicate safe-to-close vs pending-risk states |
| P2 | Device visibility | User sees profile in-use by another device | Multi-device race around lock takeover | Hide advanced lock detail for basic mode | Heartbeat delayed by poor network | Display holder identity + timeout + takeover rule text |
| P3 | Operator tooling | Manual audit review | High-volume incident triage | Weekly exported report | Audit index lag | Add dashboards/filters without changing core correctness semantics |
| P4 | Advanced features | Optional profile templates | Cross-vendor migration helper | Keep import disabled in first release | Partial import mismatch | Ship behind feature flag; never weaken P0/P1 controls |

## Non-Negotiable P0 Invariants
1. No silent loss of cookie/session/tab continuity in supported stop/reopen flows.
2. No plaintext secret at rest or in logs/events.
3. No hidden sync overwrite across devices.
4. No ambiguous auth state after expiry/revoke/decrypt failure.

## Escalation Rules
- Any violated P0 invariant immediately becomes release blocker.
- Any repeated P1 failure (same category >= 3 times/week) is promoted to P0 for current sprint.
- P2/P3/P4 work is automatically paused during unresolved P0 incident.

## Acceptance for This Matrix
- Every new feature request in auth/sync/team flow must map to one priority row.
- QA test cases must include at least baseline + exception case for each implemented priority row.
