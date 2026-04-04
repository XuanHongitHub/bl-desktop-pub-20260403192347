# Topic 2 Release Gate QA Matrix

Date: 2026-03-18
Purpose: objective go/no-go criteria for "can replace now" decision

## 1) Gate Definitions

| Gate ID | Gate | Metric | Threshold | Evidence |
|---|---|---|---|---|
| T2-GATE-01 | Profile lifecycle reliability | Create/clone/delete/start/stop pass rate in core suite | 100% pass on release candidate suite | Automated + manual smoke logs |
| T2-GATE-02 | Proxy workflow reliability | Proxy validate success with valid inputs | >= 99% on standard test set | Proxy validation report |
| T2-GATE-03 | UX golden path friction | Click count for "create + proxy + run" | <= target set per persona | UX test scripts |
| T2-GATE-04 | Async state completeness | Core async flows with loading/disable/success/error coverage | 100% of scoped flows | UI checklist + test evidence |
| T2-GATE-05 | Team access correctness | Unauthorized action prevention | 100% deny/pass correctness in role matrix | Role test matrix |
| T2-GATE-06 | Core auditability | Required events emitted for core actions | 100% required events present | Audit event verification |
| T2-GATE-07 | Cross-platform stability | Blocker crashes in profile core smoke | 0 blocker crash on Win/macOS/Linux | Per-OS smoke artifacts |
| T2-GATE-08 | Regression stability trend | Consecutive full core regression loops | 3 consecutive passes | CI/manual regression logs |

## 2) Core Test Scenario Set

1. Create profile (default config), run, stop, reopen.
2. Create profile with proxy, validate proxy, run, recover from invalid proxy.
3. Clone profile and verify inherited config integrity.
4. Search/filter/group/tag operations on large profile list.
5. Batch actions (assign group/proxy, delete selected where allowed).
6. Role-sensitive actions under owner/admin/member/viewer accounts.
7. Team lock conflict scenario and recovery.
8. Cross-platform open/close cycle with same profile set.

## 3) Persona Coverage

- Solo operator: fast profile throughput and low-friction daily operations.
- Team operator: shared workspace actions without permission confusion.
- Admin/owner: role, lock, and operational visibility reliability.

## 4) Non-Negotiable Fail Conditions

- Any blocker crash in core profile flow on target OS.
- Any unauthorized action succeeds under restricted role.
- Missing loading/error/recovery state in a scoped core async flow.
- Any P0 gap without mapped evidence.

## 5) Execution Pack

- Smoke + regression procedure: `docs/workflow/references/topic2/cross-platform-smoke-regression-loop.md`
- Gate evidence logger + loop tracker: `scripts/topic2-release-gate.mjs`
- Artifact store: `docs/workflow/references/topic2/gates/gate-log.json`
