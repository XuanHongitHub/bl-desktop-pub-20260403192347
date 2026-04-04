# Topic 2 Competitive Gap Matrix (Execution Ready)

Date: 2026-03-18
Baseline priority: HideMyAcc (primary), GoLogin (secondary)
Scope: Browser Profile domain only
Confidence note: baseline rows use competitive expectations and BugLogin codebase evidence; final competitive scoring can be refined during field validation.

## 1) Current-State Evidence (BugLogin)

- Profile lifecycle and run/stop control: `src/app/page.tsx`, `src/hooks/use-profile-events.ts`, `src/components/profile-data-table.tsx`
- Profile create flow: `src/components/create-profile-dialog.tsx`
- Proxy management/check/import/export: `src/components/proxy-management-dialog.tsx`, `src/components/proxy-check-button.tsx`, `src/hooks/use-proxy-events.ts`
- Group/tag/filter/search operations: `src/app/page.tsx`, `src/components/profiles-workspace-chrome.tsx`, `src/components/profile-data-table.tsx`
- Team and locks signal: `src/hooks/use-team-locks.ts`, `src/types.ts` (`teamRole`, `created_by_*`)
- Error and feedback patterns: mixed usage in `src/app/page.tsx`, `src/hooks/*`, multiple `console.error` traces and toast patterns

## 2) Gap Matrix

| ID | Domain | Competitive baseline expectation | BugLogin current state | Gap | Priority | Bucket | Target phase |
|---|---|---|---|---|---|---|---|
| T2-G01 | Golden path speed | Create + assign proxy + run in short guided flow | Create flow complete but multi-step friction remains | Reduce steps and context switches | P0 | Must better | Phase 2-3 |
| T2-G02 | Proxy recovery | Error classified and recoverable with fast retry | Proxy check exists, but retry/fallback is fragmented | Add recovery-first proxy failure flow | P0 | Must match | Phase 2 |
| T2-G03 | Async consistency | All core async actions expose stable loading/error/success | States exist but inconsistent across flows | Standardize async UX contract | P0 | Must match | Phase 3 |
| T2-G04 | Role clarity | Clear RBAC behavior and understandable denial reasons | Role signals exist but matrix and UI policy are not locked | Define and enforce role matrix | P0 | Must match | Phase 4 |
| T2-G05 | Audit baseline | Core actions traceable for operation review | No locked event list in Topic 2 docs | Define minimum audit event list | P0 | Must match | Phase 4 |
| T2-G06 | Cross-platform release proof | Repeatable smoke/regression gate on Win/macOS/Linux | No locked gate matrix yet | Lock and run OS gate matrix | P0 | Must match | Phase 5 |
| T2-G07 | Saved operator context | Save and recall frequent list views | Search/filter/sort exists, saved views missing | Add saved views and quick presets | P1 | Must better | Phase 3 |
| T2-G08 | Bulk operations | Batch edits are predictable and safe | Batch delete/assign patterns exist, coverage not unified | Expand and standardize bulk actions | P1 | Must better | Phase 2-3 |
| T2-G09 | Failure transparency | Immediate next-step guidance on run/proxy failures | Error toasts exist, guidance quality varies | Add actionable error messaging spec | P1 | Must better | Phase 3 |
| T2-G10 | Team-safe operations | Lock/conflict handling prevents concurrent corruption | Team lock primitives exist, conflict UX needs hardening | Strengthen lock conflict UX and retry | P1 | Must match | Phase 4 |

## 3) P0 Delivery Set (replace-now critical)

- T2-G01, T2-G02, T2-G03, T2-G04, T2-G05, T2-G06

Exit rule:
- Topic 2 cannot claim "replace now" until all P0 rows have gate evidence.

## 4) Must better Set (migration reason)

- T2-G01, T2-G07, T2-G08, T2-G09

Outcome target:
- Faster golden path and lower operational friction than baseline expectation.

## 5) Evidence Pack Required Per Gap

- Before/after flow map (steps, clicks, decision points)
- UI state screenshots or deterministic interaction traces
- QA result tied to release gate ID
- Regression proof for affected flows
