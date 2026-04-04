# Proposal: Topic 1 - Rebrand Cleanup and Core UX Hardening

**Change ID:** `topic1-rebrand-and-ux-hardening`
**Created:** 2026-03-18
**Status:** Implemented (Ready for Archive)

---

## Problem Statement
BugLogin currently retains legacy brand and logic artifacts from the original codebase (notably legacy `*-sync` and old label naming plus commercial trial flow), and has UX gaps in high-frequency operations (proxy quick add and anti-detect profile defaults).

This causes:
- brand inconsistency across UI/docs/scripts/packages
- confusion in product direction (trial/license vs token-based future model)
- avoidable friction in profile creation and proxy onboarding

## Proposed Solution
Deliver a phased cleanup and UX hardening plan:
- Full legacy-brand inventory and migration to BugLogin naming
- Deactivate commercial trial UX and keep app in token-ready neutral mode
- Add smart proxy quick-add with multi-protocol benchmark and auto-selection
- Add anti-detect defaults for Camoufox profile creation (screen/search behavior)
- Include a focused UX debt list and remediation tasks

## Scope

### In Scope
- Codebase-wide legacy naming cleanup plan (`legacy-*` and old labels)
- Trial/license UX removal and neutral token entry posture
- Proxy quick-add intelligence and selection behavior
- Camoufox profile default behavior specification
- UX debt audit and prioritized remediation list

### Out of Scope (for this topic implementation phase)
- Live `kmediaz.com` token integration and enforcement
- Billing/commercial entitlement backend implementation
- Major architecture rewrite outside listed phases

## Impact Analysis

| Component | Change Required | Details |
|-----------|-----------------|---------|
| Frontend UI | Yes | Trial banner removal, proxy flow UX, profile defaults UX |
| Tauri Backend | Yes | Token-ready state gates, proxy benchmark orchestration, profile defaults |
| Sync Service | Yes | Rename strategy + compatibility notes for `buglogin-sync` assets |
| Docs & Scripts | Yes | Rename and migration docs |
| CI/CD | Yes | Workflow/script references that still use legacy naming |

## Success Criteria

- [ ] Legacy brand residue inventory is complete and migration-safe.
- [ ] Trial banner/expired-trial friction is removed from user flow.
- [ ] App remains fully usable without token enforcement (token-ready only).
- [ ] Quick add proxy supports parse + 4-protocol benchmark + auto-pick best.
- [ ] Camoufox defaults reduce first-run misconfiguration (screen/search behavior).
- [ ] Top UX debt items are captured with severity and implementation order.

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking sync compatibility during rename | Medium | High | Introduce compatibility aliases + staged migration |
| Protocol benchmark latency harms UX | Medium | Medium | Use bounded timeout, progressive feedback, cancel support |
| Defaults differ across OS/hardware | Medium | Medium | Persist deterministic profile defaults and fallback strategy |
| Scope creep from "clean tận gốc" | High | Medium | Use inventory + phased execution with explicit freeze per phase |

## Decision Lock (Confirmed)

1. Canonical sync naming: `buglogin-sync`.
2. Compatibility strategy: keep codebase migration-ready and alias-safe so infra/VPS can be plugged in later without refactor blocking.
3. Proxy benchmark policy: use best-practice implementation (bounded multi-protocol probe, deterministic best pick).
4. Camoufox resolution strategy: use profile-based defaults with cross-machine fallback (Option B).
