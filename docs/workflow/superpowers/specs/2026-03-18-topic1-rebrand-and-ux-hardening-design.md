# Topic 1 Design: Rebrand Cleanup and Core UX Hardening

Date: 2026-03-18
Owner: codex
Status: in_progress
OpenSpec Change: `openspec/changes/topic1-rebrand-and-ux-hardening`

## Objective
Clean legacy brand residue and harden high-impact UX flows while keeping app fully usable and token-ready (no enforcement yet).

## Locked Decisions
1. Canonical sync naming is `buglogin-sync`.
2. Keep migration-safe compatibility aliases so infra can be plugged in later without refactor blockers.
3. Quick Add Proxy benchmarks HTTP/HTTPS/SOCKS4/SOCKS5 and deterministically picks best protocol.
4. Camoufox defaults follow profile-based defaults with cross-machine fallback (Option B).

## Scope
- Remove old brand/trial surface from runtime UI.
- Continue deep inventory + phased rename from legacy naming to BugLogin naming.
- Improve proxy quick-add UX reliability and bounded performance.
- Ensure Camoufox defaults are robust for resolution/search behavior.

## Implementation Snapshot
Done:
- Trial/commercial section removed from settings UI.
- Protocol benchmark command added and wired into quick-add/import flows.
- Proxy create/edit flows in Proxy Management and New Profile now reuse the same `ProxyFormDialog` logic.
- Basic Camoufox resolution/search default hardening implemented.
- Sync scripts/docs now prefer `buglogin-sync` with fallback compatibility.
- Token-ready backend command surface added for future app access token enforcement (disabled by default).
- Quick-add parser now supports robust batch parsing in single-line input variants.
- Quick-add/import benchmark flow now exposes progress state with bounded concurrency.
- Camoufox screen constraints are sanitized and persisted with cross-machine-safe fallback ranges.
- UX debt toplist and acceptance checks published for execution.

Pending:
- (none for Topic 1 scope)

## Acceptance Targets
- No visible old-brand/trial friction in main UX.
- App remains usable without token gating.
- Proxy quick-add behaves consistently in both entry points.
- Camoufox profiles start with sane defaults and valid keyword search behavior.
