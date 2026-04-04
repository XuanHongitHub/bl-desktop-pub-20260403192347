# Unified Data Flow + Performance Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate request storms and UI lag by unifying data ownership, reducing duplicate fetches/polling, and simplifying BugIdea Automation workflow behavior.

**Architecture:** Move from "many independent hooks pulling same resources" to a single owner per resource with section-aware loading and explicit refresh policies. Separate immutable server state, derived UI state, and transient workflow state. Restrict polling to active runs only and use incremental updates where possible.

**Tech Stack:** Next.js (App Router client components), React hooks/state, Tauri invoke/event bridge, control-plane REST layer.

---

### Task 1: Baseline Observability and Budgets

**Files:**
- Modify: `src/hooks/use-control-plane.ts`
- Modify: `src/app/page.tsx`
- Create: `src/lib/perf/request-tracker.ts`
- Create: `src/lib/perf/render-tracker.ts`

- [ ] **Step 1: Add request instrumentation wrapper for `fetch` + `invoke` call sites**
- [ ] **Step 2: Add lightweight render counter utility for high-churn components**
- [ ] **Step 3: Add runtime debug toggle (`NEXT_PUBLIC_PERF_DEBUG=1`) to avoid shipping noisy logs**
- [ ] **Step 4: Capture baseline metrics in dev session**
- [ ] **Step 5: Document budgets**

**Acceptance criteria:**
- Idle on `bugidea-automation`: <= 20 requests/minute.
- No active automation run: <= 5 requests/minute from automation tab itself.
- Active automation run: <= 30 requests/minute and bounded to automation endpoints.
- First meaningful render in automation tab <= 1200ms (dev target), <= 600ms (prod target).

---

### Task 2: Define Single Owner Per Resource

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/hooks/use-profile-events.ts`
- Modify: `src/hooks/use-proxy-events.ts`
- Modify: `src/hooks/use-vpn-events.ts`
- Create: `src/hooks/use-workspace-entities.ts`

- [ ] **Step 1: Introduce a single shared `use-workspace-entities` hook**
- [ ] **Step 2: Move `profiles/groups/proxies/vpns` loading and event subscriptions into shared hook**
- [ ] **Step 3: Remove duplicate owner logic from `page.tsx` direct hook usage**
- [ ] **Step 4: Expose read-only selectors and explicit refresh commands**
- [ ] **Step 5: Ensure same entity is fetched by only one owner path**

**Acceptance criteria:**
- `list_browser_profiles` appears from one owner flow only.
- `get_stored_proxies` appears from one owner flow only.
- No duplicate startup fetch for same entity on first mount.

---

### Task 3: Section-Aware Loading (Stop Global Always-On Fetch)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/platform-admin-workspace.tsx`
- Modify: `src/hooks/use-control-plane.ts`

- [ ] **Step 1: Replace `shouldLoadWorkspaceEntityData = true` with section-aware gating**
- [ ] **Step 2: Disable non-required data domains when current section is `bugidea-automation`**
- [ ] **Step 3: Keep only minimum required background listeners for current section**
- [ ] **Step 4: Verify section switch does not remount heavy layers unnecessarily**

**Acceptance criteria:**
- Switching to automation does not keep profile/proxy/vpn heavy reload loops active unless needed.
- Section transitions do not trigger full cascaded refresh of unrelated domains.

---

### Task 4: Consolidate Control-Plane Bootstrap Waterfalls

**Files:**
- Modify: `src/hooks/use-control-plane.ts`
- Modify: `src/components/platform-admin-workspace.tsx`

- [ ] **Step 1: Split bootstrap into `core`, `workspace`, and `automation` lanes**
- [ ] **Step 2: Add request dedupe keys per lane**
- [ ] **Step 3: Replace unconditional parallel refreshes with dependency-aware sequencing**
- [ ] **Step 4: Introduce stale-while-revalidate behavior for admin data**

**Acceptance criteria:**
- Initial admin automation load has deterministic request graph.
- No repeated `refresh*` calls for unchanged inputs.
- Loading state is lane-specific, not global-thrashing.

---

### Task 5: Refactor Admin TikTok Automation State Model

**Files:**
- Modify: `src/components/admin/admin-tiktok-cookies-tab.tsx`
- Create: `src/components/admin/hooks/use-admin-tiktok-workflow-state.ts`
- Create: `src/components/admin/hooks/use-admin-tiktok-workflow-actions.ts`

- [ ] **Step 1: Separate state buckets**
- [ ] **Step 2: Move workflow persistence to user-driven transitions only**
- [ ] **Step 3: Block autosave for hydration-derived field updates**
- [ ] **Step 4: Normalize labels and remote status mapping in one utility module**
- [ ] **Step 5: Reduce action model to explicit primary flow**

**Acceptance criteria:**
- Hydration effects do not trigger save storms.
- Workflow queue state remains stable across refresh.
- No accidental duplicate cookie records due to label mismatch.

---

### Task 6: Polling Policy + Incremental Updates

**Files:**
- Modify: `src/components/admin/admin-tiktok-cookies-tab.tsx`
- Modify: `src/hooks/use-control-plane.ts`
- Create: `src/lib/polling/polling-policy.ts`

- [ ] **Step 1: Centralize polling policy constants and backoff rules**
- [ ] **Step 2: Poll only when run status is `queued|running` and tab is visible**
- [ ] **Step 3: Apply delta updates from event payload instead of full list refresh**
- [ ] **Step 4: Pause polling on blur/background and resume safely**

**Acceptance criteria:**
- No polling when no active run.
- Active polling updates local store incrementally.
- `refreshTiktokAutomationAccounts` and `refreshTiktokAutomationRuns` are not called every tick.

---

### Task 7: UI Simplification + Data Presentation Hygiene

**Files:**
- Modify: `src/components/admin/admin-tiktok-cookies-tab.tsx`
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/vi.json`

- [ ] **Step 1: Keep two workflows as first-class tabs (`Auto Login/Signup`, `Auto Update Cookies`)**
- [ ] **Step 2: Compress oversized control header into compact action bar**
- [ ] **Step 3: Keep two primary per-row actions (`Open`, `Sync`) and move destructive actions to overflow**
- [ ] **Step 4: Prevent noisy metadata from contaminating primary table cells**
- [ ] **Step 5: Add filter model with remote status + local progress distinction**

**Acceptance criteria:**
- Primary automation page has clear action semantics.
- Table cells display concise data previews only.
- Filtering is deterministic and maps to true source-of-truth states.

---

### Task 8: Rendering Performance Hardening

**Files:**
- Modify: `src/components/admin/admin-tiktok-cookies-tab.tsx`
- Create: `src/components/admin/workflow/workflow-queue-table.tsx`
- Create: `src/components/admin/workflow/workflow-row.tsx`

- [ ] **Step 1: Extract queue table into focused components with stable props**
- [ ] **Step 2: Remove broad state dependencies from top-level component**
- [ ] **Step 3: Apply row-level memoization only where signal shows rerender pressure**
- [ ] **Step 4: Consider virtualization threshold (`>150` rows)**

**Acceptance criteria:**
- Typing in filters does not rerender full panel tree.
- Row updates affect only changed rows.
- 50-row workload stays responsive in dev.

---

### Task 9: Verification Matrix

**Files:**
- Create: `docs/superpowers/plans/verification/2026-03-25-unified-data-flow-checklist.md`

- [ ] **Step 1: Build request-volume checklist per section**
- [ ] **Step 2: Build workflow correctness checklist (no duplicate labels, proper status sync)**
- [ ] **Step 3: Build regression checklist for profile/proxy/vpn pages**
- [ ] **Step 4: Record before/after metrics snapshots**

**Suggested verification commands (run in Windows runtime):**
- `pnpm tauri dev`
- `pnpm lint -- src/hooks/use-control-plane.ts src/app/page.tsx src/components/admin/admin-tiktok-cookies-tab.tsx`
- `pnpm test -- --runInBand` (only targeted tests if available)

---

## Rollout Strategy

1. Phase A (safe): Task 1-4, no major UI changes, validate traffic drop first.
2. Phase B (behavior): Task 5-6, lock sync correctness and polling.
3. Phase C (UX/perf): Task 7-8, simplify UI and harden rendering.
4. Phase D (guardrails): Task 9 and CI checks.

## Risk Register

- Risk: Hidden dependencies on old duplicated fetch patterns.
- Mitigation: Keep compatibility adapters for one release cycle.

- Risk: Over-aggressive gating breaks background updates.
- Mitigation: Add explicit section enter hooks to trigger required refresh.

- Risk: Polling regression for active automation runs.
- Mitigation: Add status-based integration tests and manual run checklist.

## Done Definition

- Request volume meets budget in dev and production-like runs.
- Automation sync remains correct with no duplicate cookie labels.
- UI interactions remain responsive at 50-200 records.
- Data-flow ownership is documented and enforceable in code review.
