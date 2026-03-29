# Plan: Topic 11 Web Admin Portal Separation

Date: 2026-03-26
Owner: codex
Status: in_progress
Spec: `docs/workflow/superpowers/specs/2026-03-26-topic11-web-admin-portal-separation-design.md`
OpenSpec: `openspec/changes/topic11-web-admin-portal-separation`

## Scope
Remove in-app governance/admin routing and switch desktop to web-portal launch actions.

## Phases
1. Define architecture and domain resolution for selfhost/prod.
2. Remove sidebar and topbar entry points to in-app governance pages.
3. Replace admin/billing/pricing sections with web portal bridge behavior.
4. Verify TypeScript and route behavior.

## Progress Log
- [x] Architecture and domain mapping documented.
- [x] Sidebar/topbar entry points replaced.
- [x] In-app governance routes bridged to web portal.
- [x] Verification complete.

## Notes
- Keep BugIdea runtime section available in desktop.
- Keep control-plane fetch/sync for entitlement visibility in desktop.
