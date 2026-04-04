# Topic 6 Desktop UI Action Hierarchy and Surface Contract Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development if subagents are available, otherwise use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize BugLogin's desktop UI so routine surfaces follow a resizable-app action hierarchy: title-left, primary-right, secondary actions below or overflowed, table bulk actions isolated, and dialogs anchored predictably.

**Architecture:** Keep `WorkspacePageShell` as the shared page scaffold, but give it a dedicated secondary `toolbar` slot so page-specific utilities no longer crowd the primary action row. Split the profiles workspace chrome into a primary action cluster and a subordinate toolbar, re-anchor the shared table action bar to the page edge, and sweep page-mode dialogs so tabs and secondary controls use the right surface instead of a mixed toolbar. Add lightweight guard scripts that fail when the old center-cluster or mixed-toolbar patterns come back.

**Tech Stack:** React, Next.js, Tailwind, Radix UI dialog/tabs/popover, motion, Node guard scripts, Tauri frontend shell.

---

### Task 1: Lock the contract with failing guard tests

**Files:**
- Create: `scripts/test-workspace-page-shell-toolbar.mjs`
- Create: `scripts/test-profiles-workspace-chrome.mjs`
- Create: `scripts/test-data-table-action-bar-layout.mjs`
- Modify: `scripts/test-app-shell-layout.mjs`
- Modify: `scripts/test-workspace-page-shell-layout.mjs`

- [ ] **Step 1: Write the failing tests**

```js
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

// Example expectations:
// - WorkspacePageShell exposes a toolbar slot for subordinate controls.
// - Profiles workspace chrome splits primary actions from search/filter utilities.
// - DataTableActionBar anchors to an edge, not centered on the viewport.
```

- [ ] **Step 2: Run the new guards and confirm they fail for the current code**

Run:
```bash
node scripts/test-workspace-page-shell-toolbar.mjs
node scripts/test-profiles-workspace-chrome.mjs
node scripts/test-data-table-action-bar-layout.mjs
```

Expected: each script fails for a concrete current anti-pattern, not because of syntax errors.

- [ ] **Step 3: Update the existing shell guards**

Update the existing shell guards so they check the new contract without re-allowing the old center/mixed-toolbar patterns.

- [ ] **Step 4: Re-run the guards**

Run:
```bash
node scripts/test-app-shell-layout.mjs
node scripts/test-workspace-page-shell-layout.mjs
```

Expected: the shell checks still pass once the new contract is implemented.

---

### Task 2: Extend the shared workspace shell for primary + secondary surfaces

**Files:**
- Modify: `src/components/workspace-page-shell.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/components/profiles-workspace-chrome.tsx`

- [ ] **Step 1: Write the failing test for the shell toolbar slot**

Use `scripts/test-workspace-page-shell-toolbar.mjs` to assert that `WorkspacePageShell` accepts and renders a secondary toolbar slot below the title row.

- [ ] **Step 2: Implement the minimal shell change**

Add a `toolbar?: ReactNode` prop to `WorkspacePageShell` and render it between the header row and the scroll body.

- [ ] **Step 3: Split the profiles workspace chrome**

Create `ProfilesWorkspaceHeaderActions` for the primary CTA + overflow menu, and `ProfilesWorkspaceToolbar` for search, saved views, pinned/archive toggles, and other non-primary controls.

- [ ] **Step 4: Wire the profiles page to the new slots**

Update `src/app/page.tsx` so the profiles workspace uses `actions` for primary actions and `toolbar` for subordinate controls.

- [ ] **Step 5: Run the shell and profiles guards**

Run:
```bash
node scripts/test-workspace-page-shell-toolbar.mjs
node scripts/test-profiles-workspace-chrome.mjs
node scripts/test-workspace-page-shell-layout.mjs
```

Expected: the workspace shell and profiles chrome pass together.

---

### Task 3: Re-anchor the shared table bulk action bar

**Files:**
- Modify: `src/components/data-table-action-bar.tsx`
- Modify: `src/components/profile-data-table.tsx`
- Modify: `scripts/test-data-table-action-bar-layout.mjs`

- [ ] **Step 1: Write the failing test for edge anchoring**

Assert that `DataTableActionBar` no longer uses centered positioning such as `mx-auto` / `justify-center` / `inset-x-0`, and instead anchors to the lower edge of the workspace.

- [ ] **Step 2: Implement the smallest layout fix**

Move the bulk action bar to a corner-anchored desktop pattern, keeping it isolated from the page header and preserving its selection-state behavior.

- [ ] **Step 3: Preserve table interaction behavior**

Keep the selection count, clear-selection shortcut, and action buttons intact while adjusting only the layout contract.

- [ ] **Step 4: Re-run the table guard**

Run:
```bash
node scripts/test-data-table-action-bar-layout.mjs
```

Expected: the table bar passes only after it stops behaving like a centered floating cluster.

---

### Task 4: Sweep page-mode dialogs and utility surfaces

**Files:**
- Modify: `src/components/settings-dialog.tsx`
- Modify: `src/components/proxy-management-dialog.tsx`
- Modify: `src/components/integrations-dialog.tsx`
- Modify: `src/components/create-profile-dialog.tsx`
- Modify: `src/components/profile-info-dialog.tsx`
- Modify: `src/components/group-management-dialog.tsx`
- Modify: `src/components/group-assignment-dialog.tsx`
- Modify: `src/components/extension-management-dialog.tsx`
- Modify: `src/components/extension-group-assignment-dialog.tsx`
- Modify: `src/components/cookie-management-dialog.tsx`
- Modify: `src/components/cookie-copy-dialog.tsx`
- Modify: `src/components/proxy-form-dialog.tsx`
- Modify: `src/components/proxy-import-dialog.tsx`
- Modify: `src/components/proxy-export-dialog.tsx`
- Modify: `src/components/profile-sync-dialog.tsx`
- Modify: `src/components/sync-config-dialog.tsx`
- Modify: `src/components/sync-all-dialog.tsx`
- Modify: `src/components/delete-confirmation-dialog.tsx`
- Modify: `src/components/delete-group-dialog.tsx`
- Modify: `src/components/edit-group-dialog.tsx`
- Modify: `src/components/clone-profile-dialog.tsx`
- Modify: `src/components/permission-dialog.tsx`
- Modify: `src/components/window-resize-warning-dialog.tsx`
- Modify: `src/components/launch-on-login-dialog.tsx`

- [ ] **Step 1: Reuse the shell toolbar for page-mode tabs**

Move page-mode tabs and other secondary controls out of the primary action slot and into the new toolbar slot where appropriate.

- [ ] **Step 2: Keep confirm/cancel actions in dialog footers**

Audit dialog footers so the footer remains the stable action anchor for modal workflows.

- [ ] **Step 3: Remove any remaining center-cluster layouts from routine actions**

Keep centered layouts only for loading, empty, onboarding, or warning states, not normal action surfaces.

- [ ] **Step 4: Re-run the existing dialog guards**

Run:
```bash
node scripts/test-create-profile-dialog-layout.mjs
node scripts/test-badge-layout.mjs
node scripts/test-scroll-layout.mjs
```

Expected: the long-form dialogs stay readable and their action hierarchy remains stable.

---

### Task 5: Verification, docs, and contract sync

**Files:**
- Modify: `docs/workflow/beads/2026-03-19-topic6-desktop-ui-contract-sweep.md`
- Modify: `docs/workflow/superpowers/plans/2026-03-19-topic6-desktop-ui-contract-sweep.md`
- Modify: `docs/workflow/superpowers/specs/2026-03-19-topic6-desktop-ui-contract-sweep.md`
- Modify: `openspec/changes/topic6-desktop-ui-contract-sweep/proposal.md`
- Modify: `openspec/changes/topic6-desktop-ui-contract-sweep/tasks.md`
- Modify: `openspec/changes/topic6-desktop-ui-contract-sweep/specs/desktop-ui-contract-sweep_delta.md`

- [ ] **Step 1: Run the full set of focused guards**

Run:
```bash
node scripts/test-app-shell-layout.mjs
node scripts/test-app-sidebar-layout.mjs
node scripts/test-workspace-page-shell-layout.mjs
node scripts/test-workspace-page-shell-toolbar.mjs
node scripts/test-profiles-workspace-chrome.mjs
node scripts/test-data-table-action-bar-layout.mjs
node scripts/test-create-profile-dialog-layout.mjs
node scripts/test-badge-layout.mjs
node scripts/test-scroll-layout.mjs
git diff --check
```

- [ ] **Step 2: Update bead status and notes**

Record the final surfaces touched and the desktop-action contract that became canonical.

- [ ] **Step 3: Archive or hand off**

Once the code is stable, archive or hand off the OpenSpec change using the repo's normal workflow.

- [ ] **Step 4: Commit**

Create a focused commit with the shell/action hierarchy sweep and the guard updates.
