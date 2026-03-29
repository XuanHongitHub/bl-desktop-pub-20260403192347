# Proposal: Topic 11 - Web Admin Portal Separation

**Change ID:** `topic11-web-admin-portal-separation`  
**Created:** 2026-03-26  
**Status:** In Progress

## Problem Statement
Desktop app currently contains governance panel routing and admin workflows. This mixes runtime usage with administrative control surfaces, creates security/tampering pressure on desktop, and adds UX complexity.

## Goals
1. Move Super Admin and Workspace Owner control surfaces to web-hosted admin portal.
2. Keep desktop app focused on workspace runtime usage (profiles, proxies, integrations, settings, bug automation runtime).
3. Replace in-app admin entry points with external web portal launch.
4. Keep entitlement/subscription visibility in app read-only from control-plane state.

## In Scope
- Define web-admin information architecture for self-host and production domains.
- Remove desktop navigation entry points for legacy in-app admin panels.
- Replace desktop admin section renders with web portal bridge actions.
- Document environment/domain mapping for `bugdev.site` (selfhost) and `buglogin.com` (production).

## Out of Scope
- Rewriting backend control APIs in this change.
- Multi-tenant RBAC redesign beyond existing role model.
- Stripe webhook/payment backend redesign (covered in billing track).

## Success Criteria
- [ ] Desktop sidebar/topbar no longer routes to in-app Super Admin/Workspace Owner panels.
- [ ] Desktop opens web portal routes for admin/governance operations.
- [ ] Documentation clearly defines web portal architecture and domain strategy for selfhost/prod.
- [ ] Legacy in-app admin panel path is removed from primary desktop UX.
