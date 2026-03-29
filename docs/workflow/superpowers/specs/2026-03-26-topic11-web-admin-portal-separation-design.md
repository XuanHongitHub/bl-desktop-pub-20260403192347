# Topic 11 Design: Web Admin Portal Separation

Date: 2026-03-26
Owner: codex
Status: in_progress
OpenSpec Change: `openspec/changes/topic11-web-admin-portal-separation`

## Objective
Move governance surfaces out of desktop app and into web portal. Desktop remains runtime-focused and reads server authority state.

## Product Split
1. Desktop app (Tauri): profile runtime, proxy runtime, integrations, settings, BugIdea runtime.
2. Web admin portal: super-admin and workspace-owner governance.
3. Control API (`buglogin-sync`): single source of truth for auth, workspace state, billing, entitlement, audit.

## Domain Strategy
- Selfhost default:
  - Web portal: `https://bugdev.site`
  - Sync API: `https://sync.bugdev.site`
- Production default:
  - Web portal: `https://buglogin.com` (or configured replacement domain)
  - Sync API: `https://sync.buglogin.com`

Portal resolution order in desktop:
1. `NEXT_PUBLIC_WEB_PORTAL_URL`
2. derive from `sync_server_url` (strip `sync.` subdomain when present)
3. environment fallback (`bugdev.site` for dev/selfhost, `buglogin.com` for prod)

## Web Panel Information Architecture
### Super Admin Panel (web only)
- Command Center
  - Platform health, incidents, queue, release gates
- Workspace Control
  - Workspace lifecycle, ownership transfer, seat anomalies
- Revenue Control
  - Plans, entitlements, coupon campaigns, payment exceptions
- Audit & Compliance
  - Sensitive actions, access anomalies, export/audit retention
- Operations
  - BugIdea operation controls, queue supervision, safety toggles

### Workspace Owner Panel (web only)
- Overview
  - Current workspace health, plan status, usage and limits
- Members & Invites
  - Invite, role assignment, revoke access
- Access Policy
  - Share grants, access posture, policy checks
- Workspace Ops
  - Workspace metadata, governance settings, operational controls
- Billing & Entitlement (owner scope)
  - Subscription state, invoice feed, renewal controls

## Desktop UX Rules After Migration
1. Sidebar does not include in-app Super Admin / Workspace Owner panel routes.
2. Topbar/account menu admin actions open web portal routes instead of internal sections.
3. Legacy in-app admin section routes become bridge pages with "Open Web Portal" action.
4. Desktop never executes checkout/coupon/license activation as primary path.

## Security Direction
- Server authority only for billing/entitlement transitions.
- Desktop keeps read model and cache sync; no purchase authority.
- Existing local commands are treated as compatibility helpers and should not drive final entitlement truth.

## Acceptance Targets
- No primary desktop UX path lands inside in-app governance panel.
- Admin/governance opens web portal with workspace context.
- Desktop still reflects current entitlement after web-side changes.

## Linked Execution Docs
- `docs/workflow/superpowers/plans/2026-03-26-topic11-web-admin-portal-separation.md`
- `docs/workflow/beads/2026-03-26-topic11-web-admin-portal-separation.md`
