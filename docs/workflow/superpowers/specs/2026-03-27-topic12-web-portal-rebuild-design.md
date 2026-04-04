# Topic 12 Design: Web Portal Rebuild

Date: 2026-03-27
Owner: codex
Status: in_progress
OpenSpec Change: `openspec/changes/topic12-web-portal-rebuild`

## Objective
Replace the current BugLogin web portal with a single-domain website and browser-safe portal product that owns marketing, pricing, auth, checkout, account billing, and super admin.

## Locked Decisions
1. Visual direction: Dual-tone single product.
2. IA inspiration: very close to Notion in rhythm and conversion structure, but branded as BugLogin.
3. Desktop remains the primary post-login user app.
4. Workspace owner management stays inside the app and is not moved to the website.
5. Web owns pricing, checkout, account billing, and super admin.
6. Stripe is the only public payment provider for this rebuild.
7. Route tree is replaced without preserving public legacy redirects.
8. Website defaults to Vietnamese and ships with full English parity.

## Information Architecture
- Public:
  - `/`
  - `/pricing`
  - `/auth`
  - `/help`
  - `/legal/terms`
  - `/legal/privacy`
  - `/legal/refund`
- Commerce:
  - `/checkout`
  - `/account/billing`
- Admin:
  - `/admin/command-center`
  - `/admin/workspaces`
  - `/admin/revenue`
  - `/admin/audit`
  - `/admin/system`

## Product Split
- Website:
  - Marketing narrative, trust, pricing, public FAQ/legal
  - Browser-native auth hub
  - Stripe checkout orchestration
  - Account billing management
  - Super admin operations
- Desktop:
  - Browser runtime and operator workflows
  - Workspace owner management
  - Opens website routes with workspace/user context

## Technical Direction
- Keep current control-plane billing and admin APIs.
- Expand `web-billing-portal` route mapping into a generalized portal path map.
- Add a browser-safe session layer for website auth and account pages.
- Patch control-plane runtime resolution so browser routes can use env-configured control endpoints without Tauri.
- Replace the current portal UI with new public and private shells using shared tokens.

## Acceptance Targets
- Website renders the new route tree under the current Next app.
- Desktop pricing/billing/admin actions open the new website routes.
- Browser auth, checkout, and account billing work without Tauri-only assumptions.
- Super admin routes render with real control-plane data.
