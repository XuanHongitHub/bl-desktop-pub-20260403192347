# Delta: SaaS Auth and Pricing Surface

**Change ID:** `topic9-auth-pricing-saas-surface`  
**Affects:** Home page signed-out experience, auth modal, auth helper libs

## ADDED

### Requirement: Signed-out Workspace Entry
Signed-out users MUST see a complete workspace entry surface with both login and pricing context.

#### Scenario: Signed-out app open
- GIVEN no authenticated user session
- WHEN app home is rendered
- THEN main content shows an `Auth + Pricing` workspace page instead of profile operations

### Requirement: Pricing Tier Clarity
The entry surface MUST show plan tiers with clear billing cycle selection and tier highlights.

#### Scenario: Compare plans
- GIVEN user is evaluating subscription options
- WHEN viewing pricing cards
- THEN they can compare starter/growth/scale with monthly/yearly values and pick a plan

## MODIFIED

### Requirement: Shared Auth Preset Contract
Auth role preview accounts SHOULD be centralized and reused across auth surfaces.

#### Scenario: Auth UI consistency
- GIVEN auth modal and workspace auth page both support quick preview logins
- WHEN role preset data changes
- THEN both surfaces remain consistent via a shared preset source

### Requirement: Shared Invite Acceptance Contract
Invite acceptance for control-plane sign-in SHOULD be handled through a shared helper instead of duplicated inline logic.

#### Scenario: Optional invite token
- GIVEN user signs in with invite token present
- WHEN auth flow completes
- THEN invite acceptance uses shared control-plane helper and consistent error handling
