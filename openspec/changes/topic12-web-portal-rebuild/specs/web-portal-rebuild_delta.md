# Delta: Web Portal Rebuild

**Change ID:** `topic12-web-portal-rebuild`
**Affects:** Website route tree, portal session handling, desktop portal handoff

---

## ADDED

### Requirement: Single-Domain Website Product
BugLogin MUST provide a single-domain website that includes public marketing, pricing, auth, checkout, account billing, help, legal, and super admin surfaces.

#### Scenario: Public visitor enters website
- GIVEN a visitor opens the BugLogin website
- WHEN they browse public routes
- THEN they see the new landing, pricing, help, and legal surfaces rather than the legacy billing-first portal

### Requirement: Browser-Safe Portal Session
The portal MUST support browser-native auth and account flows without requiring the Tauri runtime.

#### Scenario: User logs in on the website
- GIVEN a user authenticates on a browser route
- WHEN auth succeeds
- THEN the website stores a browser-safe session and can load billing or admin routes without `invoke`-dependent bootstrap failures

### Requirement: Web-Hosted Super Admin
Platform admin operations MUST be accessible from website routes.

#### Scenario: Super admin opens website
- GIVEN a signed-in platform admin
- WHEN they navigate to admin routes
- THEN they can access command-center, workspace, revenue, audit, and system views

## MODIFIED

### Requirement: Desktop Billing And Admin Portal Links
Desktop billing and admin entry points SHOULD open the new website portal paths rather than the legacy billing routes.

#### Scenario: Desktop user opens pricing or billing
- GIVEN a desktop user clicks pricing, billing, checkout, or super admin entry points
- WHEN BugLogin opens the website
- THEN it resolves the new portal path and passes desktop context to the browser

### Requirement: Legacy Web Portal Scope
Legacy billing-first portal routes SHOULD NOT remain the primary website UX.

#### Scenario: Website route usage
- GIVEN the new web portal is available
- WHEN a user browses the root website experience
- THEN the current billing-first landing and navigation are no longer the primary surface
