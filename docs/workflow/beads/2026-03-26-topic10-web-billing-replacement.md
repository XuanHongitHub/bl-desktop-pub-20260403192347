id: topic10-web-billing-replacement
status: in_progress
owner: codex
created_at: 2026-03-26
updated_at: 2026-03-26
scope: Replace desktop in-app billing execution with web-hosted billing portal and retain subscription sync visibility in desktop.
files:
  - openspec/changes/topic10-web-billing-replacement/proposal.md
  - openspec/changes/topic10-web-billing-replacement/tasks.md
  - openspec/changes/topic10-web-billing-replacement/specs/web-billing-replacement_delta.md
  - docs/workflow/superpowers/specs/2026-03-26-topic10-web-billing-replacement-design.md
  - docs/workflow/superpowers/plans/2026-03-26-topic10-web-billing-replacement.md
notes:
  - Web billing surfaces include landing, pricing, plans, and management routes.
  - Desktop will no longer host direct checkout/coupon/license activation as primary UX.
  - Syntax verification for touched TypeScript files passed via TypeScript transpile checks.
  - Targeted TypeScript program check for modified billing/web files returned `root-typecheck-ok`.
  - Full pnpm lint/test remains blocked in current WSL session by runtime guard (Windows node_modules detected).
