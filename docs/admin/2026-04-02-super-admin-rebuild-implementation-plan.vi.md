# Super Admin Rebuild Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Super Admin panel into a production-safe control plane, starting with shell foundations plus canonical Users and Workspaces flows, then expanding through billing, governance, and operations in deployable releases.

**Architecture:** Ship the redesign as a sequence of independent releases, each with its own FE surface, canonical API contracts, data handling rules, and deploy verification. Release 1 establishes the shell and the two highest-value domains, `Users` and `Workspaces`, because every later phase depends on correct identity and tenant operations. Subsequent releases replace false or derived data with domain-specific sources of truth and progressively turn placeholder menus into real operating tools.

**Tech Stack:** Next.js app router, React client components, shadcn/ui primitives, NestJS `buglogin-sync` control API, PostgreSQL-backed control state, PM2 production deploy, Cloudflare proxy.

---

## 1. Scope rule

- This plan deploys only:
  - website frontend
  - control API backend
- This plan explicitly does not include:
  - desktop app release
  - browser runtime release artifacts
  - updater release publishing

- Do not attempt all 8 phases in one production deployment.
- Execute as 5 releases:
  - Release 1: Phase 1 + critical parts of Phase 2 and Phase 3
  - Release 2: remainder of Phase 2 and Phase 4
  - Release 3: Phase 5
  - Release 4: Phase 6 + Phase 7
  - Release 5: Phase 8 + hardening
- Each release must be deployable and useful on its own.

## 2. File structure map

**Docs**
- Create: `docs/admin/2026-04-02-super-admin-rebuild-implementation-plan.vi.md`
- Reference: `docs/admin/super-admin-menu-functional-spec.vi.md`

**Shared FE shell**
- Modify: `src/components/portal/portal-sidebar-shell.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Create: `src/components/portal/admin/admin-shell-page-header.tsx`
- Create: `src/components/portal/admin/admin-filter-toolbar.tsx`
- Create: `src/components/portal/admin/admin-list-detail-layout.tsx`
- Create: `src/components/portal/admin/admin-state-banner.tsx`
- Create: `src/components/portal/admin/admin-saved-view-bar.tsx`

**Users FE**
- Modify: `src/components/portal/admin/admin-users-page.tsx`
- Create: `src/components/portal/admin/admin-user-detail-drawer.tsx`
- Create: `src/components/portal/admin/admin-user-create-dialog.tsx`
- Create: `src/components/portal/admin/admin-user-role-badge.tsx`

**Workspaces FE**
- Modify: `src/app/(web-shell)/(portal)/admin/workspaces/page.tsx`
- Create: `src/components/portal/admin/admin-workspace-detail-drawer.tsx`
- Create: `src/components/portal/admin/admin-workspace-owner-transfer-dialog.tsx`
- Create: `src/components/portal/admin/admin-workspace-custom-plan-dialog.tsx`
- Create: `src/components/portal/admin/admin-workspace-limit-editor.tsx`

**Memberships FE**
- Modify: `src/app/(web-shell)/(portal)/admin/memberships/page.tsx`
- Create: `src/components/portal/admin/admin-membership-detail-drawer.tsx`

**Billing FE**
- Modify: `src/app/(web-shell)/(portal)/admin/revenue/page.tsx`
- Modify: `src/app/(web-shell)/(portal)/admin/subscriptions/page.tsx`
- Replace placeholder: `src/app/(web-shell)/(portal)/admin/invoices/page.tsx`
- Modify: `src/components/portal/commerce/commerce-admin-pages.tsx`

**Governance and operations FE**
- Replace placeholder: `src/app/(web-shell)/(portal)/admin/feature-flags/page.tsx`
- Replace placeholder: `src/app/(web-shell)/(portal)/admin/support-console/page.tsx`
- Replace placeholder: `src/app/(web-shell)/(portal)/admin/jobs-queues/page.tsx`
- Replace placeholder: `src/app/(web-shell)/(portal)/admin/impersonation-center/page.tsx`
- Replace placeholder: `src/app/(web-shell)/(portal)/admin/abuse-trust/page.tsx`
- Replace placeholder: `src/app/(web-shell)/(portal)/admin/policy-center/page.tsx`
- Replace placeholder: `src/app/(web-shell)/(portal)/admin/data-governance/page.tsx`
- Modify: `src/app/(web-shell)/(portal)/admin/system/page.tsx`
- Modify: `src/app/(web-shell)/(portal)/admin/system/browser/page.tsx`
- Modify: `src/app/(web-shell)/(portal)/admin/audit/page.tsx`

**Control API route layer**
- Modify: `src/lib/control-api-routes.ts`
- Modify: `src/components/web-billing/control-api.ts`

**Portal data hooks**
- Modify: `src/hooks/use-portal-billing-data.ts`
- Create: `src/hooks/use-admin-list-state.ts`
- Create: `src/hooks/use-admin-detail-state.ts`

**Backend controller/service/types**
- Modify: `buglogin-sync/src/control/control.controller.ts`
- Modify: `buglogin-sync/src/control/control.service.ts`
- Modify: `buglogin-sync/src/control/control.types.ts`

**Backend tests**
- Create or modify focused specs under `buglogin-sync/src/control/*.spec.ts`

## 3. Release plan

### Release 1: Shell + Users + Workspaces

**Outcome**
- Super Admin shell is corrected.
- Users page becomes canonical and platform-wide.
- Workspaces page becomes operational and detail-first.

**Includes**
- Phase 1
- Core of Phase 2
- Core of Phase 3

### Release 2: Memberships + owner transfer + access flows

**Outcome**
- Relationship layer between users and workspaces becomes safe and visible.

**Includes**
- Remaining Phase 2
- Phase 4

### Release 3: Revenue and billing correctness

**Outcome**
- Revenue, subscriptions, invoices, and coupons all use domain-correct data.

**Includes**
- Phase 5

### Release 4: Commerce advanced + governance

**Outcome**
- Plans, campaigns, license keys, price preview, audit, policy, governance, flags become real products rather than placeholders.

**Includes**
- Phase 6
- Phase 7

### Release 5: Operations + support + hardening

**Outcome**
- Service health, jobs, browser update config, support console, impersonation, incidents are production-usable.

**Includes**
- Phase 8

## 4. Release 1 detailed tasks

### Task 1: Correct admin navigation and route semantics

**Files:**
- Modify: `src/components/portal/portal-sidebar-shell.tsx`
- Modify: `src/components/app-sidebar.tsx`
- Test: lightweight route mapping verification via targeted build or typecheck

- [ ] **Step 1: Audit current admin route map and list mismatches**

Check and document:
- routes that map to wrong active sections
- menu items that point to placeholder or redirect pages
- routes that are hidden but still reachable

- [ ] **Step 2: Rewrite section-to-route mapping**

Requirements:
- `/admin/revenue` must map to revenue, not subscriptions
- every visible menu item must map to its own domain route
- remove fake aliases from active state

- [ ] **Step 3: Update sidebar grouping to match the new spec**

Requirements:
- group names follow the spec
- visible submenu set reflects implemented functionality only
- hide placeholders until a release makes them real

- [ ] **Step 4: Verify route transitions manually with a focused local run**

Run only the minimum needed page-level verification.

- [ ] **Step 5: Commit**

Commit: `feat(admin): normalize shell navigation and route semantics`

### Task 2: Add shared Super Admin page primitives

**Files:**
- Create: `src/components/portal/admin/admin-shell-page-header.tsx`
- Create: `src/components/portal/admin/admin-filter-toolbar.tsx`
- Create: `src/components/portal/admin/admin-list-detail-layout.tsx`
- Create: `src/components/portal/admin/admin-state-banner.tsx`
- Create: `src/components/portal/admin/admin-saved-view-bar.tsx`
- Test: render sanity via targeted FE check if needed

- [ ] **Step 1: Create a compact page header primitive**

Requirements:
- title
- description
- summary chips
- primary and secondary actions
- small-density spacing

- [ ] **Step 2: Create a reusable filter toolbar**

Requirements:
- search slot
- filter slots
- sort slot
- refresh slot
- support narrow and wide layouts

- [ ] **Step 3: Create a list-detail layout**

Requirements:
- left list region
- right detail drawer or panel
- handles empty detail state
- scroll areas remain bounded

- [ ] **Step 4: Create a shared state banner**

Requirements:
- loading
- refreshing
- empty
- error
- permission
- stale

- [ ] **Step 5: Commit**

Commit: `feat(admin): add shared shell primitives for compact list-detail pages`

### Task 3: Introduce canonical user APIs in backend

**Files:**
- Modify: `buglogin-sync/src/control/control.controller.ts`
- Modify: `buglogin-sync/src/control/control.service.ts`
- Modify: `buglogin-sync/src/control/control.types.ts`
- Test: `buglogin-sync/src/control/*.spec.ts`

- [ ] **Step 1: Define user list and detail response shapes**

Include:
- user id
- email
- display name
- platform role
- linked providers
- account state
- workspace count
- last active

- [ ] **Step 2: Add `GET /admin/users`**

Requirements:
- platform-wide source of truth
- search
- pagination
- sorting
- no dependency on workspace health fan-out

- [ ] **Step 3: Add `GET /admin/users/:id`**

Requirements:
- identity summary
- memberships summary
- provider states
- recent audit summary

- [ ] **Step 4: Add targeted backend tests**

Cover:
- user with zero workspaces still appears
- search by email works
- pagination metadata is correct

- [ ] **Step 5: Commit**

Commit: `feat(control): add canonical platform user listing and detail endpoints`

### Task 4: Replace Users page with list-detail UX

**Files:**
- Modify: `src/components/portal/admin/admin-users-page.tsx`
- Create: `src/components/portal/admin/admin-user-detail-drawer.tsx`
- Create: `src/components/portal/admin/admin-user-create-dialog.tsx`
- Create: `src/components/portal/admin/admin-user-role-badge.tsx`
- Modify: `src/components/web-billing/control-api.ts`
- Modify: `src/lib/control-api-routes.ts`

- [ ] **Step 1: Replace fan-out loading with canonical `/admin/users` call**

Requirements:
- remove dependency on workspace health
- server-side search/filter/sort/pagination params

- [ ] **Step 2: Build compact user table**

Columns:
- user
- platform role
- providers
- workspace count
- last active
- status

- [ ] **Step 3: Add right-side detail drawer**

Tabs:
- identity
- memberships
- auth methods
- audit summary

- [ ] **Step 4: Move create user into a dialog**

Requirements:
- success appends or refetches canonical list
- created user visible even without workspace membership

- [ ] **Step 5: Commit**

Commit: `feat(admin): rebuild users page around canonical identity data`

### Task 5: Introduce canonical workspace detail APIs for custom ops

**Files:**
- Modify: `buglogin-sync/src/control/control.controller.ts`
- Modify: `buglogin-sync/src/control/control.service.ts`
- Modify: `buglogin-sync/src/control/control.types.ts`
- Test: `buglogin-sync/src/control/*.spec.ts`

- [ ] **Step 1: Add workspace detail response**

Include:
- owner summary
- standard or custom plan mode
- custom limits
- expiry
- entitlement
- suspension
- usage snapshot
- recent audit summary

- [ ] **Step 2: Add write endpoints for workspace operations**

Add:
- owner transfer
- custom limits update
- expiry update
- entitlement update
- suspension update

- [ ] **Step 3: Require reasons for sensitive writes**

For:
- owner transfer
- suspension
- entitlement changes
- custom plan or limit overrides

- [ ] **Step 4: Add targeted backend tests**

Cover:
- owner transfer updates data consistently
- custom profile/member limits persist
- expiry changes are returned immediately

- [ ] **Step 5: Commit**

Commit: `feat(control): add canonical workspace detail and custom ops endpoints`

### Task 6: Rebuild Workspaces page for high-scale operations

**Files:**
- Modify: `src/app/(web-shell)/(portal)/admin/workspaces/page.tsx`
- Create: `src/components/portal/admin/admin-workspace-detail-drawer.tsx`
- Create: `src/components/portal/admin/admin-workspace-owner-transfer-dialog.tsx`
- Create: `src/components/portal/admin/admin-workspace-custom-plan-dialog.tsx`
- Create: `src/components/portal/admin/admin-workspace-limit-editor.tsx`
- Modify: `src/components/web-billing/control-api.ts`
- Modify: `src/lib/control-api-routes.ts`

- [ ] **Step 1: Convert workspace page to list-detail layout**

Requirements:
- compact row density
- server-driven filtering
- saved views for common operations

- [ ] **Step 2: Replace “manage subscription” modal with structured detail drawer**

Sections:
- overview
- owner
- plan and limits
- billing
- usage
- audit

- [ ] **Step 3: Add custom plan editing**

Fields:
- plan mode
- profile limit
- member limit
- expiry
- optional display label
- reason

- [ ] **Step 4: Add owner transfer flow**

Requirements:
- search user
- confirm with reason
- update list and drawer immediately

- [ ] **Step 5: Commit**

Commit: `feat(admin): rebuild workspaces page for custom ops and scale`

### Task 7: Add focused verification for Release 1

**Files:**
- Test: targeted FE and backend tests only
- Verify deploy script and PM2 health after push

- [ ] **Step 1: Run targeted backend tests for new user and workspace endpoints**

Run the narrowest control-plane tests that cover:
- canonical users list
- workspace detail and owner transfer
- custom limits persistence

- [ ] **Step 2: Run targeted FE verification**

Minimum checks:
- build impacted admin pages
- ensure route map compiles

- [ ] **Step 3: Manual smoke checklist**

Verify:
- users list loads
- create user appears without F5
- workspace owner transfer updates UI
- custom profile/member limits and expiry persist and re-render

- [ ] **Step 4: Commit**

Commit: `test(admin): verify release 1 users and workspaces flows`

### Task 8: Push and deploy Release 1

**Files:**
- Modify only if deployment fixes are necessary

- [ ] **Step 1: Prepare final release branch state**

Run:
- `git status --short`
- confirm only intended files are part of the release

- [ ] **Step 2: Push to GitHub**

Commit history should be release-shaped and readable.

- [ ] **Step 3: Deploy on VPS**

Run the existing VPS deploy flow after pull.

- [ ] **Step 4: Production verification**

Verify:
- admin routes load
- API endpoints return 200
- PM2 stays online
- no 401 or 502 regressions introduced

- [ ] **Step 5: Commit deployment notes**

Optional release note doc if production required follow-up exists.

## 5. Release 2 detailed tasks

### Task 1: Canonical memberships, invites, and access graph APIs

**Files:**
- Modify: `buglogin-sync/src/control/control.controller.ts`
- Modify: `buglogin-sync/src/control/control.service.ts`
- Modify: `buglogin-sync/src/control/control.types.ts`

- [ ] Add `GET /admin/memberships`
- [ ] Add `GET /admin/invites`
- [ ] Add `GET /admin/share-grants`
- [ ] Add mutation endpoints for role changes and revocations
- [ ] Add backend tests
- [ ] Commit: `feat(control): add canonical access graph endpoints`

### Task 2: Rebuild Memberships page and owner transfer follow-through UX

**Files:**
- Modify: `src/app/(web-shell)/(portal)/admin/memberships/page.tsx`
- Create: `src/components/portal/admin/admin-membership-detail-drawer.tsx`

- [ ] Replace client fan-out logic with canonical memberships list
- [ ] Add access-state filters and action bar
- [ ] Add detail drawer with owner transfer, revoke, role history
- [ ] Commit: `feat(admin): rebuild memberships page around access graph`

### Task 3: Verify, push, deploy Release 2

- [ ] Run focused verification
- [ ] Push
- [ ] Deploy
- [ ] Smoke test owner and membership flows

## 6. Release 3 detailed tasks

### Task 1: Add platform-level revenue and subscription APIs

**Files:**
- Modify: `buglogin-sync/src/control/control.controller.ts`
- Modify: `buglogin-sync/src/control/control.service.ts`
- Modify: `buglogin-sync/src/control/control.types.ts`

- [ ] Add `GET /admin/subscriptions`
- [ ] Add `GET /admin/invoices`
- [ ] Add `GET /admin/revenue`
- [ ] Add relevant mutations for cancel/reactivate/sync
- [ ] Add backend tests
- [ ] Commit: `feat(control): add platform revenue and billing endpoints`

### Task 2: Replace false revenue and audit-derived billing views

**Files:**
- Modify: `src/app/(web-shell)/(portal)/admin/revenue/page.tsx`
- Modify: `src/app/(web-shell)/(portal)/admin/subscriptions/page.tsx`
- Replace: `src/app/(web-shell)/(portal)/admin/invoices/page.tsx`

- [ ] Make revenue page use platform aggregate API
- [ ] Make subscriptions page use canonical subscriptions list
- [ ] Implement invoices page for real payment operations
- [ ] Commit: `feat(admin): rebuild revenue subscriptions and invoices pages`

### Task 3: Fix coupon persistence correctness

**Files:**
- Modify: `src/components/web-billing/control-api.ts`
- Modify: `buglogin-sync/src/control/control.types.ts`
- Modify: `buglogin-sync/src/control/control.service.ts`
- Modify: `src/components/portal/commerce/commerce-admin-pages.tsx`

- [ ] Persist `maxPerUser`
- [ ] Persist `maxPerWorkspace`
- [ ] Return them in list/detail payloads
- [ ] Update FE list and create forms
- [ ] Commit: `fix(commerce): persist and render coupon scope limits correctly`

### Task 4: Verify, push, deploy Release 3

- [ ] Run focused tests
- [ ] Push
- [ ] Deploy
- [ ] Smoke test revenue, subscriptions, invoices, coupons

## 7. Release 4 detailed tasks

### Task 1: Make commerce submenu real

**Files:**
- Modify: `src/app/(web-shell)/(portal)/admin/commerce/plans/page.tsx`
- Modify: `src/app/(web-shell)/(portal)/admin/commerce/campaigns/page.tsx`
- Modify: `src/app/(web-shell)/(portal)/admin/commerce/licenses/page.tsx`
- Modify: `src/app/(web-shell)/(portal)/admin/commerce/preview/page.tsx`
- Modify: `src/components/portal/commerce/commerce-admin-pages.tsx`

- [ ] Remove redirects
- [ ] Expose plans, campaigns, licenses, preview as real pages or real dialog entrypoints
- [ ] Add detail drawers and publish timeline where needed
- [ ] Commit: `feat(admin): replace commerce redirects with real tools`

### Task 2: Governance and audit correctness

**Files:**
- Modify: `src/app/(web-shell)/(portal)/admin/audit/page.tsx`
- Replace placeholders in governance routes
- Modify backend for audit, policy, governance, flags domains

- [ ] Make audit page use `/admin/audit-logs`
- [ ] Add placeholder replacements for policy, data governance, feature flags, abuse & trust
- [ ] Commit: `feat(admin): add governance and audit production pages`

### Task 3: Verify, push, deploy Release 4

- [ ] Focused verification
- [ ] Push
- [ ] Deploy
- [ ] Smoke test commerce and governance routes

## 8. Release 5 detailed tasks

### Task 1: Real system health, jobs, browser update config

**Files:**
- Modify: `src/app/(web-shell)/(portal)/admin/system/page.tsx`
- Modify: `src/app/(web-shell)/(portal)/admin/system/browser/page.tsx`
- Replace placeholder operations routes
- Add backend system and jobs endpoints

- [ ] Replace token-presence “health” heuristics with server health API
- [ ] Replace localStorage browser update config with server-backed web/API config only
- [ ] Implement jobs and queues controls
- [ ] Commit: `feat(admin): add real operations and browser config pages`

### Task 2: Support console, impersonation, incidents

**Files:**
- Replace placeholder support routes
- Add backend support search and impersonation endpoints

- [ ] Build support console search and context panel
- [ ] Build impersonation flow with reason and TTL
- [ ] Complete incident board workflow
- [ ] Commit: `feat(admin): add support tools and incident operations`

### Task 3: Final hardening and rollout checks

- [ ] Run targeted high-risk verification
- [ ] Push
- [ ] Deploy
- [ ] Verify PM2, health, core admin smoke, auth, billing, support flows

## 9. Minimum verification commands by release

- FE compile or build only the impacted app surface.
- Backend tests only for touched control-plane files.
- Production smoke after each release:
  - `/signin`
  - `/admin/dashboard`
  - `/admin/users`
  - `/admin/workspaces`
  - corresponding API health and new endpoints

## 10. Execution note

- The safe path is to implement and deploy Release 1 first.
- Do not start Release 2+ until Release 1 is stable in production.
