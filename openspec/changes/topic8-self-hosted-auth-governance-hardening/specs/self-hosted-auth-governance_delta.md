# Delta: Self-hosted Auth and Governance Hardening

**Change ID:** `topic8-self-hosted-auth-governance-hardening`  
**Affects:** Auth Dialog, Cloud Auth Hook, Control-plane Hook, Admin Workspace

## ADDED

### Requirement: Self-hosted Email Sign-in Path
The app MUST provide a working sign-in path in this fork without requiring cloud OTP backend endpoints.

#### Scenario: Email sign-in
- GIVEN cloud OTP commands are disabled
- WHEN user signs in with email in Auth Dialog
- THEN a local authenticated session is established and restored on next startup

### Requirement: Workspace-user Membership Guard
Workspace-user sign-in MUST require existing membership context (or invite-token flow) before granting active session.

#### Scenario: Non-invited workspace-user login
- GIVEN user selects workspace-user scope
- WHEN no workspace membership is discovered and no invite-token-assisted flow is used
- THEN sign-in is rejected with clear guidance

### Requirement: Explicit Scope Selection
Auth UI MUST make access scope explicit for operators (workspace user vs platform admin).

#### Scenario: Platform admin scope
- GIVEN trusted internal operator needs platform governance access
- WHEN platform admin scope is selected at sign-in
- THEN session includes platform admin role semantics for control-plane operations

## MODIFIED

### Requirement: Control-plane Header Safety
Control-plane request headers MUST NOT implicitly elevate unauthenticated users to platform admin.

#### Scenario: Anonymous request context
- GIVEN no authenticated user session exists
- WHEN control-plane request headers are built
- THEN no `x-platform-role=platform_admin` auto-injection occurs

### Requirement: Admin Surface Access Posture
Admin workspace access SHOULD require authenticated session visibility in navigation.

#### Scenario: Logged-out user
- GIVEN user is not signed in
- WHEN accessing admin surface
- THEN app shows clear sign-in guidance and action entrypoint instead of privileged content

### Requirement: Governance Input Validation
Invite, share, and coupon operations MUST validate critical input constraints before dispatching requests.

#### Scenario: Invalid governance inputs
- GIVEN malformed email or invalid coupon payload
- WHEN operator submits the form
- THEN client blocks submission and shows actionable, localized validation feedback
