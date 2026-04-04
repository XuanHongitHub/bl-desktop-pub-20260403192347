id: topic2-implementation-p0-hardening
status: in_progress
owner: codex
created_at: 2026-03-19
updated_at: 2026-03-19
scope: Execute Topic 2 P0 implementation for golden path, proxy recovery, async UX contract, RBAC guardrails, audit baseline, and release gate runbook.
files:
  - src/app/page.tsx
  - src/components/create-profile-dialog.tsx
  - src/components/camoufox-config-dialog.tsx
  - src/components/cookie-copy-dialog.tsx
  - src/components/workspace-page-shell.tsx
  - src/components/profile-data-table.tsx
  - src/components/proxy-check-button.tsx
  - src/components/proxy-management-dialog.tsx
  - src/components/ui/scroll-area.tsx
  - src/hooks/use-group-events.ts
  - src/hooks/use-profile-events.ts
  - src/hooks/use-proxy-events.ts
  - src/lib/proxy-check-error.ts
  - src/lib/team-permissions.ts
  - src-tauri/src/events/mod.rs
  - src-tauri/src/profile/manager.rs
  - src-tauri/src/proxy_manager.rs
  - src-tauri/src/proxy_server.rs
  - src-tauri/copy-proxy-binary.mjs
  - src-tauri/copy-proxy-binary.sh
  - src-tauri/src/browser_runner.rs
  - docs/workflow/references/topic2/release-gate-qa-matrix.md
  - docs/workflow/references/topic2/cross-platform-smoke-regression-loop.md
  - scripts/topic2-release-gate.mjs
  - scripts/test-scroll-layout.mjs
  - scripts/test-camoufox-open-url.mjs
  - scripts/test-workspace-page-shell-layout.mjs
  - openspec/changes/topic2-browser-profile-parity-and-release-readiness/tasks.md
  - docs/workflow/superpowers/plans/2026-03-18-topic2-browser-profile-parity-and-release-readiness.md
notes:
  - Viewer role is now treated as strict read-only for profile write paths in page-level handlers and table inline editors.
  - Core audit events are emitted from profile/proxy/run operations.
  - Cross-platform smoke + regression loop has explicit runbook and evidence logging script.
  - Proxy auth flow hardened in local proxy: reqwest proxy now binds explicit basic auth from upstream credentials; upstream 407 challenges are absorbed as neutral gateway error instead of leaking browser auth popup on `moz-proxy://127.0.0.1:*`.
  - New Profile proxy UX optimized: users can now select existing stored proxies directly in Create Profile; quick-add supports Enter-to-parse; manual fields auto-disable when an existing proxy is chosen to reduce click load.
  - Sidecar build sync hardened: copy scripts now rebuild `buglogin-proxy` when proxy source files are newer than compiled sidecar, preventing stale sidecar behavior during `tauri dev`.
  - Lifecycle parity now includes soft archive/restore flow in Profiles (single + bulk archive, archived view toggle, restore path from profile info).
  - Proxy flow now auto-applies best detected protocol during Quick Add and auto-runs connectivity check after parse; selecting an existing proxy in Create Profile now auto-checks connection (no manual click).
  - Create Profile modal widened and reorganized with Basic / Proxy / Advanced sections; main BugLogin window now supports resize again instead of fixed-only maximize/minimize behavior.
  - Shared ScrollArea now uses the app's native thin scrollbar contract (`app-scroll-gutter` + overflow-auto) instead of a Radix custom overlay scrollbar, so page shells and dialogs inherit the same edge-aligned thin scroll behavior as the rest of the app.
  - Camoufox existing-instance URL opening now follows the Firefox-like remote path instead of falling back to a relaunch, so browser history/back-forward state is preserved.
  - Create Profile shell now follows the same clipped flex-column dialog pattern as the working config dialogs, with a shrinkable Tabs/ScrollArea body and a separated footer so overlap cannot reappear at max height.
  - Workspace page shell now uses flex-1 instead of h-full so Settings / Proxies / Integrations page-mode views get a real scroll height chain, and the shared native scroll container stays aligned to the page shell edge.
  - Workspace page shell keeps the shared ScrollArea inside the shell without negative right margins, so the native scrollbar stays aligned to the container edge instead of being clipped by the overflow-hidden parent.
  - Create Profile modal width was restored to the wider 5xl contract after follow-up feedback, while keeping the same flex/scroll body and section layout.
  - Badge base styling no longer clips localized text or descenders, which fixes the truncated "Không hoạt động" label in Settings.
  - Scrollbar styling now uses a stronger neutral track/thumb so it is readable on light backgrounds, not just in dark mode.
  - Lifecycle parity (including list-ops pin flow) is shipped; remaining focus is collecting actual three-OS gate artifacts.
