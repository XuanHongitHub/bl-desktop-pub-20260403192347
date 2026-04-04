# Implementation Tasks: Topic 7 - UI/UX Polish for New Governance Flows

**Change ID:** `topic7-ui-ux-polish-new-governance-flows`

## Phase 1: Design Contract
- [x] 1.1 Define a compact section contract (title, helper, content, actions) for new admin/auth/sync surfaces.
- [x] 1.2 Define status signal contract (pending/connected/error/unknown) using existing theme tokens.
- [x] 1.3 Define copy style contract for operational guidance (short, explicit, action-oriented).

**Quality Gate:**
- [x] The contract is reflected in the OpenSpec delta and can be followed by future UI changes.

## Phase 2: Admin Workspace Polish
- [x] 2.1 Normalize overview/status cards to improve scanability.
- [x] 2.2 Improve workspace/member/invite/share list readability and action grouping.
- [x] 2.3 Improve billing/coupon/audit sections with clearer helper copy and safer action affordances.

**Quality Gate:**
- [x] Admin operators can identify state and next actions without hunting through the UI.

## Phase 3: Auth and Sync Setup Polish
- [x] 3.1 Improve `CloudAuthDialog` step clarity for OTP + optional invite acceptance.
- [x] 3.2 Improve `SyncConfigDialog` section readability and setup confidence messaging.
- [x] 3.3 Ensure loading/error states are explicit and consistent with toast + disabled actions.

**Quality Gate:**
- [x] First-time setup flows are clear and predictable in both vi/en locales.

## Phase 4: Verification
- [x] 4.1 Ensure updated text keys exist in both `en.json` and `vi.json`.
- [x] 4.2 Run lightweight static verification (JSON parse + TS transpile syntax checks).
- [x] 4.3 Confirm no unintended non-theme color additions.

**Quality Gate:**
- [x] Updated surfaces are implementation-complete and ready for release smoke testing.
