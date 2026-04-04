id: topic6-desktop-ui-contract-sweep
status: in_progress
owner: codex
created_at: 2026-03-19
updated_at: 2026-03-19
scope: Standardize BugLogin's desktop UI action hierarchy so resizable windows follow a clear title/primary/secondary/bulk/dialog contract instead of fixed-window toolbar mixing.
files:
  - openspec/changes/topic6-desktop-ui-contract-sweep/proposal.md
  - openspec/changes/topic6-desktop-ui-contract-sweep/tasks.md
  - openspec/changes/topic6-desktop-ui-contract-sweep/specs/desktop-ui-contract-sweep_delta.md
  - docs/workflow/superpowers/specs/2026-03-19-topic6-desktop-ui-contract-sweep.md
  - docs/workflow/superpowers/plans/2026-03-19-topic6-desktop-ui-contract-sweep.md
  - src/app/page.tsx
  - src/components/app-sidebar.tsx
  - src/components/workspace-page-shell.tsx
  - src/components/profiles-workspace-chrome.tsx
  - src/components/data-table-action-bar.tsx
  - src/components/profile-data-table.tsx
  - src/components/settings-dialog.tsx
  - src/components/proxy-management-dialog.tsx
  - src/components/integrations-dialog.tsx
  - src/components/create-profile-dialog.tsx
  - src/components/profile-info-dialog.tsx
  - src/components/group-management-dialog.tsx
  - src/components/group-assignment-dialog.tsx
  - src/components/extension-management-dialog.tsx
  - src/components/extension-group-assignment-dialog.tsx
  - src/components/cookie-management-dialog.tsx
  - src/components/cookie-copy-dialog.tsx
  - src/components/vpn-form-dialog.tsx
  - src/components/vpn-import-dialog.tsx
  - src/components/proxy-form-dialog.tsx
  - src/components/proxy-import-dialog.tsx
  - src/components/proxy-export-dialog.tsx
  - src/components/profile-sync-dialog.tsx
  - src/components/sync-config-dialog.tsx
  - src/components/sync-all-dialog.tsx
  - src/components/delete-confirmation-dialog.tsx
  - src/components/delete-group-dialog.tsx
  - src/components/edit-group-dialog.tsx
  - src/components/clone-profile-dialog.tsx
  - src/components/permission-dialog.tsx
  - src/components/ui/dialog.tsx
  - src/components/ui/card.tsx
  - src/components/ui/table.tsx
  - src/components/ui/button.tsx
  - src/components/ui/badge.tsx
  - src/components/ui/scroll-area.tsx
  - scripts/test-workspace-page-shell-toolbar.mjs
  - scripts/test-profiles-workspace-chrome.mjs
  - scripts/test-data-table-action-bar-layout.mjs
  - scripts/test-page-mode-toolbar-layout.mjs
notes:
  - Current UI already has a normalized shell and scroll contract; this change extends the same rigor to action hierarchy and layout semantics.
  - The main UX goal is to keep BugLogin legible under resize by separating primary actions from utility actions instead of packing everything into a single mixed row.
  - Future UI work should inherit this contract instead of inventing new per-screen layouts.
  - Profiles workspace chrome now splits primary actions from the subordinate toolbar row, and the old monolithic header file was removed.
  - Proxy and Integrations page-mode views now use the shared toolbar slot for tabs and secondary navigation.
  - The shared data table action bar now anchors to the lower-right edge instead of floating centered across the viewport.
