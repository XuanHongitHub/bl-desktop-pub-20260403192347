id: topic5-ui-shell-normalization
status: done
owner: codex
created_at: 2026-03-19
updated_at: 2026-03-19
scope: Normalize desktop shell and scroll contract so BugLogin behaves like a normal resizable app window.
files:
  - openspec/changes/topic5-ui-shell-normalization/proposal.md
  - openspec/changes/topic5-ui-shell-normalization/tasks.md
  - openspec/changes/topic5-ui-shell-normalization/specs/ui-shell-normalization_delta.md
  - docs/workflow/superpowers/specs/2026-03-19-topic5-ui-shell-normalization.md
  - docs/workflow/superpowers/plans/2026-03-19-topic5-ui-shell-normalization.md
  - src/app/page.tsx
  - src/components/app-sidebar.tsx
  - src/components/ui/scroll-area.tsx
  - src/components/workspace-page-shell.tsx
  - src/components/ui/badge.tsx
  - src/components/ui/dialog.tsx
  - src/components/settings-dialog.tsx
  - src/components/create-profile-dialog.tsx
  - src/styles/globals.css
  - src/i18n/locales/en.json
  - src/i18n/locales/es.json
  - src/i18n/locales/fr.json
  - src/i18n/locales/ja.json
  - src/i18n/locales/pt.json
  - src/i18n/locales/ru.json
  - src/i18n/locales/vi.json
  - src/i18n/locales/zh.json
  - scripts/test-scroll-layout.mjs
  - scripts/test-app-shell-layout.mjs
  - scripts/test-app-sidebar-layout.mjs
  - scripts/test-workspace-page-shell-layout.mjs
  - scripts/test-create-profile-dialog-layout.mjs
  - scripts/test-badge-layout.mjs
notes:
  - Shared scroll contract is now native thin scrollbar + overflow-auto, aligned to the global app scrollbar styling.
  - The refactor keeps the shell flexible enough for long pages/dialogs without reverting to custom overlay scrollbars.
  - Dead layout escape hatches such as the custom ScrollBar export and disableContentScroll shell switch were removed during cleanup.
  - Right-padding compensation on broad scroll bodies was removed so the scrollbar aligns to the actual content edge instead of feeling inset.
  - App shell main now keeps only left/bottom spacing; right padding was removed so the native scrollbar can sit on the content edge.
  - The app shell left gutter was widened a step so the page content breathes more cleanly away from the sidebar without moving the scrollbar inward.
  - Sidebar branding now uses the logo asset only, with collapse/expand controls kept in the header row.
