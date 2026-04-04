# Implementation Tasks: Topic 12 - Web Portal Rebuild

**Change ID:** `topic12-web-portal-rebuild`

---

## Phase 1: Foundation

- [ ] 1.1 Expand portal route helpers and browser-safe session helpers
- [ ] 1.2 Add targeted route/session tests and verify red-green cycle
- [ ] 1.3 Make control-plane runtime bootstrap web-safe

**Quality Gate:**
- [ ] Targeted helper tests pass
- [ ] TypeScript for touched foundation files passes

---

## Phase 2: Public Website

- [ ] 2.1 Replace home page with the new landing experience
- [ ] 2.2 Replace pricing surface and connect CTAs to auth/checkout
- [ ] 2.3 Add help and legal pages
- [ ] 2.4 Add translation strings for the new public website

**Quality Gate:**
- [ ] Public routes render without runtime errors
- [ ] Responsive checks for primary breakpoints pass

---

## Phase 3: Auth, Checkout, and Billing

- [ ] 3.1 Add new auth hub and OAuth callback browser flow
- [ ] 3.2 Add new checkout flow backed by Stripe checkout creation
- [ ] 3.3 Add account/billing management backed by control billing state
- [ ] 3.4 Preserve desktop context handoff to browser routes

**Quality Gate:**
- [ ] Auth-to-checkout happy path is manually verified
- [ ] Billing/account pages render with real control-plane data

---

## Phase 4: Super Admin and Desktop Handoff

- [ ] 4.1 Add super admin command center shell and sections
- [ ] 4.2 Update desktop web portal buttons to point at the new routes
- [ ] 4.3 Retire legacy billing-first routing from the active UX
- [ ] 4.4 Sync docs/spec/plan/bead state

**Quality Gate:**
- [ ] Desktop opens new portal URLs
- [ ] Super admin surface renders in browser mode
- [ ] Targeted verification commands succeed

---

## Completion Checklist

- [ ] All phases complete
- [ ] Route/session helper tests pass
- [ ] Targeted type/build verification passes
- [ ] Documentation synced
- [ ] Ready for `/openspec-archive`
