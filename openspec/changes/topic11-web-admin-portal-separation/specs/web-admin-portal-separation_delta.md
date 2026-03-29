# Delta: Web Admin Portal Separation

**Change ID:** `topic11-web-admin-portal-separation`  
**Affects:** Desktop app navigation, governance/admin access surface

## ADDED

### Requirement: Web-Hosted Governance Surface
Super Admin and Workspace Owner governance operations MUST be hosted on web routes.

#### Scenario: Open governance from desktop
- GIVEN a user with governance access in desktop app
- WHEN selecting admin/governance action
- THEN desktop launches web admin portal route instead of rendering in-app admin panel

### Requirement: Domain-Aware Portal Resolution
Desktop MUST resolve web portal base URL based on selfhost/production configuration.

#### Scenario: Selfhost portal target
- GIVEN sync server configured at selfhost domain
- WHEN opening admin portal
- THEN desktop resolves and opens selfhost web domain route

#### Scenario: Production portal target
- GIVEN production runtime with production portal URL configured
- WHEN opening admin portal
- THEN desktop resolves and opens production web domain route

## MODIFIED

### Requirement: Desktop Navigation Scope
Desktop navigation SHOULD focus on runtime workspace operations and exclude governance panel routing.

#### Scenario: Sidebar navigation
- GIVEN desktop sidebar is visible
- WHEN user navigates sections
- THEN runtime sections are shown and governance routes are opened through web portal actions
