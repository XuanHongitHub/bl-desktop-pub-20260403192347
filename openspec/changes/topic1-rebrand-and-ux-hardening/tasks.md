# Implementation Tasks: Topic 1 - Rebrand Cleanup and Core UX Hardening

**Change ID:** `topic1-rebrand-and-ux-hardening`

---

## Phase 1: Legacy Brand Inventory and Rename Plan

- [x] 1.1 Build inventory of all legacy naming (old labels, old assets, old package names) ✓ 2026-03-18
- [x] 1.2 Classify references: runtime-critical vs docs/tests/assets ✓ 2026-03-18
- [x] 1.3 Define rename map and compatibility alias strategy (`legacy-sync` -> `buglogin-sync`, migration-ready) ✓ 2026-03-18
- [x] 1.4 Prepare rollout order (backend, scripts, frontend, docs, CI) ✓ 2026-03-18

**Quality Gate:**
- [x] Inventory complete and reviewed ✓ 2026-03-18
- [x] No blind rename risk remains ✓ 2026-03-18

---

## Phase 2: Trial Logic Neutralization (Token-Ready)

- [x] 2.1 Remove/hide trial modal/banner and related copy from UI ✓ 2026-03-18
- [x] 2.2 Neutralize user-facing commercial gating while preserving app usability ✓ 2026-03-18
- [x] 2.3 Keep backend in token-ready mode (notes/interfaces only, no enforcement) ✓ 2026-03-18
- [x] 2.4 Add migration notes for future `kmediaz.com` token integration ✓ 2026-03-18

**Quality Gate:**
- [x] No trial interruption in UI ✓ 2026-03-18
- [x] App still runs normally without token enforcement ✓ 2026-03-18

---

## Phase 3: Smart Quick Add Proxy

- [x] 3.1 Extend proxy parse flow for robust single-line and batch input ✓ 2026-03-18
- [x] 3.2 Run bounded protocol benchmark for HTTP/HTTPS/SOCKS4/SOCKS5 when applicable ✓ 2026-03-18
- [x] 3.3 Auto-select best protocol by deterministic best-practice heuristics (lowest stable latency with clear tie-breakers) ✓ 2026-03-18
- [x] 3.4 Apply same quick-add behavior in Proxy Management and New Profile ✓ 2026-03-18
- [x] 3.5 Add clear loading/progress/error states and non-blocking UX ✓ 2026-03-18

**Quality Gate:**
- [x] Quick add works in both entry points ✓ 2026-03-18
- [x] Benchmark is bounded and stable ✓ 2026-03-18
- [x] Best protocol auto-selection is deterministic ✓ 2026-03-18

---

## Phase 4: Camoufox Profile Defaults Hardening

- [x] 4.1 Add auto resolution defaults aligned with local display constraints ✓ 2026-03-18
- [x] 4.2 Define persisted profile defaults (Option B: profile-based defaults + cross-machine fallback) ✓ 2026-03-18
- [x] 4.3 Fix query-to-search behavior to use default search engine (Google) ✓ 2026-03-18
- [x] 4.4 Validate fallback behavior when machine/display differs ✓ 2026-03-18

**Quality Gate:**
- [x] New profiles have sane defaults without manual tweaks ✓ 2026-03-18
- [x] Search input no longer turns plain keyword into invalid URL navigation ✓ 2026-03-18

---

## Phase 5: UX Debt Audit and Prioritized Fixes

- [x] 5.1 Produce Top UX gaps list with severity and user impact ✓ 2026-03-18
- [x] 5.2 Attach remediation proposal and phase assignment ✓ 2026-03-18
- [x] 5.3 Define acceptance checks for each selected fix ✓ 2026-03-18

**Quality Gate:**
- [x] Priority list agreed ✓ 2026-03-18
- [x] Fixes mapped into executable backlog ✓ 2026-03-18

---

## Completion Checklist

- [x] All phases complete ✓ 2026-03-18
- [x] Specs updated and synced ✓ 2026-03-18
- [x] Ready for implementation execution ✓ 2026-03-18
