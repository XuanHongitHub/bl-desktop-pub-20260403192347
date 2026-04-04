# Delta: Web Billing Replacement

**Change ID:** `topic10-web-billing-replacement`  
**Affects:** Desktop pricing/billing UX, web billing routes

## ADDED

### Requirement: Web Billing Portal Surface
A web portal MUST provide billing landing, pricing, plan comparison, and management pages.

#### Scenario: Open billing portal
- GIVEN a user needs to manage plan or payment
- WHEN opening web billing portal
- THEN user can access dedicated landing/pricing/plans/management surfaces

### Requirement: Web Purchase Authority
Primary purchase interactions MUST happen in web-hosted billing flow.

#### Scenario: Purchase execution
- GIVEN an authenticated billing manager
- WHEN initiating checkout
- THEN the action is executed via web billing flow rather than desktop in-app checkout widgets

## MODIFIED

### Requirement: Desktop Billing Experience
Desktop billing pages SHOULD act as orchestration and visibility surfaces, not direct checkout authority.

#### Scenario: Desktop pricing action
- GIVEN user clicks upgrade/manage from desktop
- WHEN choosing a billing action
- THEN desktop opens web billing route and waits for refreshed subscription state

### Requirement: Legacy Checkout Route Handling
Legacy desktop checkout callback handling SHOULD NOT remain the primary purchase path.

#### Scenario: Desktop route navigation
- GIVEN user navigates billing sections in desktop
- WHEN selecting pricing/billing actions
- THEN old in-app checkout intent flow is bypassed in favor of web billing links
