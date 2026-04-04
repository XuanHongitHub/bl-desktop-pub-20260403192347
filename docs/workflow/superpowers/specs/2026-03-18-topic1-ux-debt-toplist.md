# UX Debt Toplist: Topic 1

Date: 2026-03-18
Owner: codex
Status: prioritized
Parent: `docs/workflow/superpowers/specs/2026-03-18-topic1-rebrand-and-ux-hardening-design.md`

## Prioritized List

1. Hardcoded copy and missing i18n coverage in operational dialogs
- Severity: High
- User Impact: Medium-High
- Scope: `proxy-import-dialog`, network dialogs, misc action labels/messages
- Why: Mixed language UX and inconsistent localization quality.

2. Inconsistent error reporting strategy (`console.error` + direct `toast.error`)
- Severity: High
- User Impact: Medium
- Scope: high-frequency hooks/components where async failures are common
- Why: Uneven recovery UX and noisy diagnostics without structured user guidance.

3. Long-running proxy optimization lacks cancellation affordance
- Severity: Medium
- User Impact: Medium-High for large lists
- Scope: Quick Add benchmark pipeline in Proxy Import and Proxy Form dialogs
- Why: User cannot abort costly runs when pasting very large proxy batches.

4. Ambiguous proxy resolution relies fully on manual choice
- Severity: Medium
- User Impact: Medium
- Scope: ambiguous parser resolution screen
- Why: No auto-suggestion increases friction for repetitive input formats.

5. Token-ready backend has no user-facing setup panel yet
- Severity: Medium
- User Impact: Medium
- Scope: settings/integrations UX
- Why: Backend readiness is invisible; migration path lacks UX entry point.

6. Settings surface density is high and difficult to scan
- Severity: Medium
- User Impact: Medium
- Scope: settings dialog information architecture
- Why: High cognitive load and slower task completion for operational changes.

## Remediation Plan

1. i18n consistency pass
- Replace hardcoded copy with translation keys in highest-traffic dialogs first.
- Add missing keys in all locale files with fallback-safe values.

2. Unified interaction feedback policy
- Route user-facing failures via `showErrorToast`/`showSuccessToast`.
- Keep `console.error` only for developer diagnostics, not as UX mechanism.

3. Proxy benchmark cancellation and batching controls
- Add cancel action for benchmark in progress.
- Expose lightweight “fast import/no benchmark” toggle for large lists.

4. Ambiguous proxy smart default
- Infer likely format from token shape and host heuristics.
- Preselect best guess while keeping manual override.

5. Token setup UX shell
- Add neutral “App Access Token” settings section.
- Show configured/not-configured state; keep enforcement disabled.

6. Settings IA improvement
- Group settings into clearer categories with progressive disclosure.
- Keep advanced sections collapsed by default.

## Acceptance Checks

1. Localization completeness
- New/updated copy keys exist in all supported locale files.
- No newly added hardcoded operational strings remain in changed dialogs.

2. Feedback consistency
- Async failure paths in target components display a user-friendly toast.
- No user flow depends on checking console logs to understand failure.

3. Proxy large-list behavior
- User can cancel benchmark in progress without freezing UI.
- Import still succeeds with benchmark disabled or interrupted.

4. Ambiguous resolver productivity
- At least 80% of common ambiguous lines are preselected correctly in smoke scenarios.
- Manual override remains available for every ambiguous row.

5. Token readiness UX
- User can store/remove app access token from UI.
- App remains fully usable when token is missing and enforcement is off.

6. Settings usability
- Primary tasks (theme/lang/integrations/sync) reachable within two clicks from Settings root.
- Visual grouping remains consistent on desktop and standard laptop viewport sizes.
