# Web Portal Rebuild Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current BugLogin web portal with a single-domain website product for marketing, pricing, auth, checkout, account billing, and super admin while keeping desktop as the main operator app.

**Architecture:** Expand the existing portal URL/context helper into a generalized website route contract, add a browser-safe session layer, rebuild public and private website shells, and patch desktop handoff plus control-plane bootstrap for browser execution.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind v4, Shadcn UI, i18next, Lucide, control-plane fetch APIs

---

### Task 1: Route And Session Foundation

**Files:**
- Create: `src/lib/web-billing-portal.test.ts`
- Create: `src/lib/portal-session.ts`
- Create: `src/lib/portal-session.test.ts`
- Modify: `src/lib/web-billing-portal.ts`
- Modify: `src/hooks/use-control-plane.ts`

- [ ] Step 1: Write failing tests for new portal routes and session helpers
- [ ] Step 2: Run targeted node tests and verify the failures are expected
- [ ] Step 3: Implement expanded route mapping and portal session helpers
- [ ] Step 4: Make control-plane runtime bootstrap fall back cleanly in browser mode
- [ ] Step 5: Re-run targeted tests until green

### Task 2: Public Website Shell

**Files:**
- Create: `src/components/portal/portal-chrome.tsx`
- Create: `src/components/portal/portal-home-page.tsx`
- Create: `src/components/portal/portal-pricing-page.tsx`
- Create: `src/components/portal/portal-help-page.tsx`
- Create: `src/components/portal/portal-legal-page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/pricing/page.tsx`
- Create: `src/app/help/page.tsx`
- Create: `src/app/legal/privacy/page.tsx`
- Create: `src/app/legal/refund/page.tsx`
- Create: `src/app/legal/terms/page.tsx`
- Modify: `src/app/plans/page.tsx`

- [ ] Step 1: Build the shared public chrome and landing sections
- [ ] Step 2: Replace the pricing route with the new public pricing experience
- [ ] Step 3: Add help and legal routes
- [ ] Step 4: Verify the public pages render and navigate correctly

### Task 3: Auth, Checkout, And Billing

**Files:**
- Create: `src/components/portal/use-portal-session.ts`
- Create: `src/components/portal/portal-auth-page.tsx`
- Create: `src/components/portal/portal-checkout-page.tsx`
- Create: `src/components/portal/portal-account-billing-page.tsx`
- Modify: `src/app/oauth-callback/page.tsx`
- Create: `src/app/auth/page.tsx`
- Create: `src/app/checkout/page.tsx`
- Create: `src/app/account/page.tsx`
- Create: `src/app/account/billing/page.tsx`
- Modify: `src/app/checkout/success/page.tsx`
- Modify: `src/app/checkout/cancel/page.tsx`

- [ ] Step 1: Build browser-safe auth session hook and auth hub
- [ ] Step 2: Update OAuth callback handling for browser mode
- [ ] Step 3: Build the new checkout route with Stripe session creation
- [ ] Step 4: Build the account billing route using control billing state
- [ ] Step 5: Verify login to checkout to billing flow manually

### Task 4: Super Admin And Desktop Handoff

**Files:**
- Create: `src/components/portal/portal-admin-page.tsx`
- Create: `src/app/admin/command-center/page.tsx`
- Create: `src/app/admin/workspaces/page.tsx`
- Create: `src/app/admin/revenue/page.tsx`
- Create: `src/app/admin/audit/page.tsx`
- Create: `src/app/admin/system/page.tsx`
- Modify: `src/lib/web-billing-desktop.ts`
- Modify: `src/components/workspace-pricing-page.tsx`
- Modify: `src/components/workspace-billing-page.tsx`
- Modify: `src/app/layout.tsx`

- [ ] Step 1: Build the new super admin shell and sections
- [ ] Step 2: Patch desktop route handoff to new website paths
- [ ] Step 3: Expand standalone web route detection in layout
- [ ] Step 4: Verify admin routes and desktop link outputs

### Task 5: Copy And Verification

**Files:**
- Modify: `src/i18n/locales/en.json`
- Modify: `src/i18n/locales/vi.json`
- Modify: `.env.example`
- Create or Modify: `docs/workflow/beads/2026-03-27-topic12-web-portal-rebuild.md`

- [ ] Step 1: Add the new portal translation namespace in both locales
- [ ] Step 2: Document any new public env variables
- [ ] Step 3: Run targeted node tests for helper contracts
- [ ] Step 4: Run targeted TypeScript verification for touched portal files
- [ ] Step 5: Run a targeted Next build or route-level smoke verification if feasible
