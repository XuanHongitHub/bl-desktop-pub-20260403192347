# Topic 2 Implementation Backlog (P0/P1)

Date: 2026-03-18
Source of truth:
- `docs/workflow/references/topic2/competitive-gap-matrix.md`
- `docs/workflow/references/topic2/release-gate-qa-matrix.md`
- `openspec/changes/topic2-browser-profile-parity-and-release-readiness/tasks.md`

## 1) P0 Backlog (Release Critical)

### P0-01 Golden Path Compression
- Goal: shorten and clarify "create + proxy + run" flow.
- Scope:
  - `src/components/create-profile-dialog.tsx`
  - `src/app/page.tsx`
  - `src/components/profile-data-table.tsx`
- Acceptance:
  - Meets T2-GATE-03 click/friction threshold.
  - No dead-end state in the golden path.
- Status:
  - In progress (2026-03-19): launch-after-create path added and create failure handling hardened.

### P0-02 Proxy Recovery-First Flow
- Goal: deterministic proxy failure classification and one-path retry.
- Scope:
  - `src/components/proxy-management-dialog.tsx`
  - `src/components/proxy-check-button.tsx`
  - `src/hooks/use-proxy-events.ts`
  - `src/lib/proxy-benchmark.ts`
- Acceptance:
  - Meets T2-GATE-02 reliability threshold.
  - Retry/edit/fallback path available from every failure state.
- Status:
  - Implemented in-app flow (2026-03-19): failure classification + retry/edit guidance integrated.

### P0-03 Async UX Contract Standardization
- Goal: unify loading/disable/success/error behavior in core profile flows.
- Scope:
  - `src/app/page.tsx`
  - `src/hooks/use-profile-events.ts`
  - `src/hooks/use-group-events.ts`
  - `src/hooks/use-proxy-events.ts`
  - `src/lib/toast-utils.ts`
- Acceptance:
  - Meets T2-GATE-04 with 100% scoped flow coverage.
- Status:
  - In progress (2026-03-19): core handlers unified with loading/success/error contract and normalized error extraction.

### P0-04 Role and Permission Matrix Lock
- Goal: explicit role behavior for owner/admin/member/viewer.
- Scope:
  - `src/types.ts`
  - `src/hooks/use-team-locks.ts`
  - `src/hooks/use-cloud-auth.ts`
  - `src/components/permission-dialog.tsx`
- Acceptance:
  - Meets T2-GATE-05 with full matrix pass.
- Status:
  - Implemented baseline (2026-03-19): centralized role-action matrix and viewer read-only enforcement in page/table write flows.

### P0-05 Core Audit Event Contract
- Goal: lock and emit required audit events for profile/proxy/run actions.
- Scope:
  - `src-tauri/src/lib.rs`
  - `src-tauri/src/profile/manager.rs`
  - `src-tauri/src/proxy_manager.rs`
  - `src-tauri/src/events/mod.rs`
- Acceptance:
  - Meets T2-GATE-06.
- Status:
  - Implemented (2026-03-19): audit events emitted for profile/proxy/run operations.

### P0-06 Three-OS Reliability Gate
- Goal: define and enforce repeatable smoke/regression loop for Win/macOS/Linux.
- Scope:
  - `openspec/.../tasks.md` (gate link)
  - `docs/workflow/references/topic2/release-gate-qa-matrix.md`
  - CI/verification scripts as needed in later implementation phase
- Acceptance:
  - Meets T2-GATE-07 and T2-GATE-08.
- Status:
  - Defined (2026-03-19): smoke/regression runbook + gate evidence logger script added. Pending real three-OS execution logs.

## 2) P1 Backlog (Must Better / Phase Follow-up)

1. Saved views and quick presets for list workflows.
2. Expanded bulk actions with safer guardrails.
3. Better error copy and context-aware recovery guidance.
4. Team lock conflict UX hardening and retry ergonomics.

## 3) Execution Order

1. P0-01 + P0-02
2. P0-03
3. P0-04 + P0-05
4. P0-06
5. P1 set
