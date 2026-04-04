# Laravel Control API Parity Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Laravel backend that is API-compatible with BugLogin web/desktop control contracts so existing frontend works without breaking changes.

**Architecture:** Implement a `v1/control` API surface in Laravel with strict contract parity (headers, routes, request/response schema, and error messages). Start with auth + workspace + billing endpoints used by web pricing/checkout/account flows, then expand to admin/automation endpoints.

**Tech Stack:** Laravel 11+, PHP 8.3+, PostgreSQL, Redis queue (optional), Stripe SDK, JWT verification (or token middleware), PHPUnit/Pest.

---

### Task 1: Contract Freeze (Source of Truth)

**Files:**
- Create: `docs/api/control-api-contract-v1.md`
- Create: `docs/api/control-api-error-codes.md`
- Reference: `src/components/web-billing/control-api.ts`
- Reference: `src/hooks/use-cloud-auth.ts`
- Reference: `buglogin-sync/src/control/control.controller.ts`

- [ ] **Step 1: Extract route list and methods**
- [ ] **Step 2: Extract required request headers** (`Authorization`, `x-user-id`, `x-user-email`, `x-platform-role`)
- [ ] **Step 3: Capture required response fields and enums**
- [ ] **Step 4: Capture required error messages (exact string parity where FE depends on text)**
- [ ] **Step 5: Freeze contract docs before coding Laravel handlers**

### Task 2: Laravel Project Skeleton (Control Module)

**Files:**
- Create: `routes/control.php`
- Modify: `routes/api.php`
- Create: `app/Http/Controllers/Control/`
- Create: `app/Http/Middleware/ControlAuthMiddleware.php`
- Create: `app/Support/Control/RequestActor.php`

- [ ] **Step 1: Register `/v1/control/*` route group**
- [ ] **Step 2: Add middleware to resolve actor from headers/token**
- [ ] **Step 3: Normalize actor object (`userId`, `email`, `platformRole`)**
- [ ] **Step 4: Return standardized auth errors (`401/403`)**

### Task 3: Data Model & Migrations (Billing/Workspace Core)

**Files:**
- Create: `database/migrations/*_create_workspaces_table.php`
- Create: `database/migrations/*_create_memberships_table.php`
- Create: `database/migrations/*_create_workspace_subscriptions_table.php`
- Create: `database/migrations/*_create_billing_invoices_table.php`
- Create: `database/migrations/*_create_stripe_checkout_sessions_table.php`
- Create: `app/Models/*`

- [ ] **Step 1: Create enums compatible with FE (`starter|growth|scale|custom`, `monthly|yearly`, status/source enums)**
- [ ] **Step 2: Add workspace + membership relations**
- [ ] **Step 3: Add subscription fields used by FE** (`planId`, `planLabel`, `profileLimit`, `billingCycle`, `status`, `expiresAt`, `cancelAtPeriodEnd`, `cancelAt`)
- [ ] **Step 4: Add invoice + stripe checkout tables**
- [ ] **Step 5: Seed minimal plan catalog matching BugLogin values**

### Task 4: MVP Endpoints for Web Billing (Must-have)

**Files:**
- Create: `app/Http/Controllers/Control/WorkspaceController.php`
- Create: `app/Http/Controllers/Control/BillingController.php`
- Create: `app/Services/Control/WorkspaceService.php`
- Create: `app/Services/Control/BillingService.php`
- Create: `app/Http/Resources/Control/*`

- [ ] **Step 1: Implement `GET /v1/control/workspaces`**
- [ ] **Step 2: Implement `GET /v1/control/workspaces/{workspaceId}/billing/state`**
- [ ] **Step 3: Implement `POST /v1/control/workspaces/{workspaceId}/billing/stripe-checkout`**
- [ ] **Step 4: Implement `POST /v1/control/workspaces/{workspaceId}/billing/subscription/cancel`**
- [ ] **Step 5: Implement `POST /v1/control/workspaces/{workspaceId}/billing/subscription/reactivate`**
- [ ] **Step 6: Ensure response schema exactly matches current FE types**

### Task 5: Business Rules Parity (Critical)

**Files:**
- Modify: `app/Services/Control/BillingService.php`
- Create: `app/Support/Control/PlanRank.php`
- Create: `tests/Feature/Control/BillingRulesTest.php`

- [ ] **Step 1: Implement plan ranking** (`starter=1`, `growth=2`, `scale=3`, `custom=4`)
- [ ] **Step 2: Enforce downgrade rule and return exact error key** (`downgrade_not_allowed_for_multi_workspace` where applicable)
- [ ] **Step 3: Keep plan price/profile/storage limits consistent with existing BugLogin backend behavior**
- [ ] **Step 4: Add tests for upgrade, downgrade, cancel, reactivate**

### Task 6: Public Auth + Session Bootstrap APIs

**Files:**
- Create: `app/Http/Controllers/Control/AuthController.php`
- Create: `app/Services/Control/AuthService.php`
- Create: `tests/Feature/Control/AuthApiTest.php`

- [ ] **Step 1: Implement `GET /v1/control/auth/me`**
- [ ] **Step 2: Implement invite accept flow endpoint used by FE (`/v1/control/auth/invite/accept`)**
- [ ] **Step 3: Ensure payload supports portal session bootstrap fields**

### Task 7: Stripe Integration Hardening

**Files:**
- Create: `app/Services/Billing/StripeCheckoutService.php`
- Create: `config/services.php` (stripe keys)
- Create: `tests/Feature/Control/StripeCheckoutTest.php`

- [ ] **Step 1: Build checkout session creation with metadata needed to reconcile workspace/plan**
- [ ] **Step 2: Persist local `stripe_checkout_sessions` record before redirect**
- [ ] **Step 3: Implement confirm endpoint parity if frontend flow needs it**
- [ ] **Step 4: Add idempotency protection**

### Task 8: Error Contract & Response Envelope Consistency

**Files:**
- Create: `app/Exceptions/ControlApiException.php`
- Modify: `app/Exceptions/Handler.php`
- Create: `tests/Feature/Control/ErrorContractTest.php`

- [ ] **Step 1: Standardize API error response shape**
- [ ] **Step 2: Preserve FE-dependent error message text**
- [ ] **Step 3: Verify HTTP status codes per scenario**

### Task 9: Compatibility Test Harness (Against Current FE)

**Files:**
- Create: `tests/Contract/ControlApiContractTest.php`
- Create: `docs/api/postman/buglogin-control-v1.postman_collection.json`

- [ ] **Step 1: Build contract tests for MVP endpoints with real JSON snapshots**
- [ ] **Step 2: Validate enum values and nullable behavior**
- [ ] **Step 3: Add regression tests for billing downgrade and cancellation flows**

### Task 10: Rollout Strategy (No-Down-Time)

**Files:**
- Create: `docs/api/laravel-cutover-runbook.md`
- Create: `docs/api/observability-checklist.md`

- [ ] **Step 1: Add staging environment with mirrored FE traffic (or replay tests)**
- [ ] **Step 2: Run side-by-side response diff between old backend and Laravel**
- [ ] **Step 3: Cut over by env var (`CONTROL_BASE_URL`)**
- [ ] **Step 4: Monitor error-rate, checkout success-rate, and billing API latency**
- [ ] **Step 5: Keep rollback switch ready for immediate fallback**

---

## Priority Order (Recommended)

1. Task 1 → 4 (MVP parity for pricing/checkout/account billing)
2. Task 5 (business rules parity)
3. Task 6 + 7 (auth bootstrap + stripe hardening)
4. Task 8 + 9 (contract and regression quality gate)
5. Task 10 (production cutover)

## Definition of Done (MVP)

- FE pages `/pricing`, `/checkout`, `/account/billing` work against Laravel with no FE code changes.
- No schema mismatch in `WebBillingWorkspaceListItem`, `ControlWorkspaceBillingState`, `ControlStripeCheckoutCreateResponse`.
- Downgrade behavior matches agreed business rule and returns expected error key.
- Contract tests pass in CI.
