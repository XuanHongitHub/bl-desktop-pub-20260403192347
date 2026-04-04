# Plan: Topic 10 Web Billing Replacement

Date: 2026-03-26
Owner: codex
Status: in_progress
Spec: `docs/workflow/superpowers/specs/2026-03-26-topic10-web-billing-replacement-design.md`
OpenSpec: `openspec/changes/topic10-web-billing-replacement`

## Scope
Ship a web-first billing experience and remove legacy desktop purchase flow entry points.

## Phases
1. Phase 1 - Create web billing portal routes and shared context handling.
2. Phase 2 - Replace desktop pricing/billing interaction path to open web routes.
3. Phase 3 - Remove checkout intent/callback usage from desktop primary flow.
4. Phase 4 - Verify types and navigation behavior.

## Progress Log
- [x] Phase 1 - Spec and migration boundaries locked.
- [ ] Phase 1 - Web billing portal pages implemented.
- [ ] Phase 2 - Desktop replacement implemented.
- [ ] Phase 3 - Legacy flow entry points removed.
- [ ] Phase 4 - Verification complete.

## Notes
- Keep existing billing data fetch from control-plane source intact.
- Ensure new web routes remain usable in desktop external browser context.
