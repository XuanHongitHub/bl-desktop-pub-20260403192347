# Profiles Page Performance Checklist (2026-03-31)

## Objective
- Remove interaction lag on Profiles page, starting with checkbox selection and bulk operations.
- Keep UX responsive while preserving permission/runtime safety.

## Baseline bottlenecks observed
- Selection state duplicated between external `selectedProfiles` and internal TanStack `rowSelection`.
- Frequent `profiles.find(...)` lookups in hot paths.
- Selection updates forcing expensive synchronous updates.
- Table meta churn on every small selection change.

## Implemented in this session
- [x] Removed internal table `rowSelection` mirror state in `profile-data-table.tsx`.
- [x] Switched checkbox/icon selection updates to functional state updates.
- [x] Added `startTransition` for selection commits to reduce main-thread blocking.
- [x] Added `profilesById` map for O(1) lookups in handlers/effects.
- [x] Replaced broad `selectedProfiles` meta payload with `selectedProfilesCount` where possible.
- [x] Reused memoized `selectableProfileIds` for `select all`.
- [x] Guarded cross-OS checks with client-only runtime to avoid hydration mismatch.

## Frontend checklist
- [ ] Add profiler marks around selection handlers (`checkbox`, `select all`, `bulk open`).
- [ ] Memoize heavy row-level controls into isolated components (actions/status/proxy cell).
- [ ] Move traffic/sync volatile streams to external store selectors for visible rows only.
- [ ] Gate polling frequency by visibility/focus and active-running count.
- [ ] Avoid full-table invalidation when only one profile row changes.

## Backend checklist
- [ ] Add/verify bulk commands for launch/stop/group/proxy/vpn assignment.
- [ ] Return per-profile delta payloads from bulk commands (avoid full refetch).
- [ ] Audit N+1 behavior in profile list enrichment (proxy/vpn/sync/runtime fields).
- [ ] Add lightweight timing logs for core commands:
  - `list_browser_profiles_light`
  - `check_browser_statuses_batch`
  - `update_profile_proxy` / `update_profile_vpn`
  - bulk profile mutations

## UI/UX responsiveness checklist
- [ ] Show deterministic progress for bulk operations (`X/Y processed`).
- [ ] Keep bulk action bar interactive while backend work continues.
- [ ] Prefer optimistic UI for assignment/tagging with clear rollback on failure.
- [ ] Ensure disabled states are immediate for running/launching/stopping rows.

## Validation plan
- [ ] Test datasets: 50 / 500 / 2000 profiles.
- [ ] Measure:
  - click-to-checkbox-visual update latency (p50/p95)
  - select-all latency
  - bulk action dispatch latency
  - frame drops while polling traffic
- [ ] Capture flamecharts before/after for selection path.

