# Proposal: Topic 12 - Web Portal Rebuild

**Change ID:** `topic12-web-portal-rebuild`
**Created:** 2026-03-27
**Status:** Draft

## Problem Statement
BugLogin currently has fragmented web surfaces built around billing and bridge flows. The existing portal does not represent the product well, mixes desktop-oriented assumptions into browser UX, and does not provide a coherent public website, account area, or web-first super admin surface.

## Proposed Solution
- Replace the current public web portal UX with a single-domain website and portal product.
- Keep existing auth, billing, and control-plane authority contracts where they already exist.
- Introduce a new web-safe session layer for browser flows while preserving desktop deep-link context handoff.
- Move pricing, checkout, account billing, and super admin into the website with a fresh Notion-inspired but BugLogin-branded design system.

## Scope

### In Scope
- New home page, pricing page, auth hub, checkout page, billing management page
- New super admin web shell and command center
- Public help and legal pages
- Desktop route handoff updates to open the new portal paths
- Web-safe control-plane runtime fallback and portal session handling

### Out of Scope
- Workspace owner management migration to web
- Full control-plane/backend rearchitecture
- New payment providers beyond Stripe
- Legacy route redirect preservation

## Impact Analysis

| Component | Change Required | Details |
|-----------|-----------------|---------|
| Database | No | Reuse current control-plane and auth data sources |
| API | Yes | Add web-facing OTP support only if required by current browser auth flow |
| State | Yes | New browser-safe portal session layer |
| UI | Yes | Replace all current portal surface UI/UX with a new route tree and shells |

## Architecture Considerations
- The website remains `single-domain`.
- Public marketing and logged-in product surfaces share one brand system but use two density modes.
- Desktop remains the main post-login user app; the website owns pricing, checkout, billing, and super admin.
- Existing `web-billing` helpers stay as the compatibility boundary for desktop portal URLs, but route mapping expands beyond billing-only pages.

## Success Criteria
- [ ] Root website, pricing, auth, checkout, account billing, help, and legal routes render under the new portal system
- [ ] Desktop opens the new portal paths instead of the legacy billing routes
- [ ] Super admin can access command-center, workspace, revenue, audit, and system views on the website
- [ ] Portal remains usable in pure browser mode without Tauri runtime assumptions

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Desktop-first hooks break on web | High | High | Add browser-safe runtime fallbacks and separate portal session layer |
| Copy and route churn causes regressions | Medium | High | Keep legacy compatibility helpers while replacing public route tree |
| Billing/account UX outruns current API shape | Medium | Medium | Render only API-backed states and label provider-managed gaps clearly |
