# Implementation Tasks: Topic 9 - SaaS Auth and Pricing Surface

**Change ID:** `topic9-auth-pricing-saas-surface`

## Phase 1: Shared Building Blocks
- [x] 1.1 Create shared auth quick-preset definitions for role preview accounts.
- [x] 1.2 Create shared invite acceptance helper for control-plane auth invite flow.
- [x] 1.3 Refactor existing auth modal to consume shared blocks.

## Phase 2: Auth + Pricing Workspace
- [x] 2.1 Build a complete signed-out workspace surface combining auth form and pricing tiers.
- [x] 2.2 Add monthly/yearly pricing switch and selectable plan cards.
- [x] 2.3 Keep sign-in scope and invite-token behavior available in-page.

## Phase 3: App Integration and Localization
- [x] 3.1 Route signed-out users to the new workspace auth/pricing surface.
- [x] 3.2 Add new UX copy keys for both `en` and `vi` locales.
- [x] 3.3 Keep component styling aligned with existing tokenized UI system.

## Phase 4: Verification
- [x] 4.1 JSON parse check for updated locales.
- [x] 4.2 TS transpile syntax checks for updated files.
- [x] 4.3 `git diff --check` clean.
