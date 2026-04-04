# Proposal: Topic 9 - SaaS Auth and Pricing Surface

**Change ID:** `topic9-auth-pricing-saas-surface`  
**Created:** 2026-03-21  
**Status:** Implemented

## Problem Statement
The previous login experience relied on a compact modal and did not present a complete SaaS-style entry point with clear pricing context. This felt like a dev/demo flow instead of a production onboarding surface.

## Goals
1. Provide a complete workspace-level `Auth + Pricing` page for signed-out users.
2. Make pricing tiers explicit and selectable with clear monthly/yearly framing.
3. Keep sign-in, invite acceptance, and role preview capabilities accessible from the same surface.
4. Preserve consistent Shadcn/Notion-like styling and bilingual copy.

## In Scope
- New auth/pricing workspace component and route integration
- Shared auth quick-preset model
- Shared invite-accept helper for auth surfaces
- i18n additions in `en.json` and `vi.json`

## Out of Scope
- Stripe checkout backend implementation
- Subscription provisioning webhooks
- External marketing website changes

## Success Criteria
- [x] Signed-out users land on a complete auth + pricing page, not only a modal.
- [x] Pricing tiers and billing cycle choices are clearly visible.
- [x] Sign-in remains functional with invited email and optional invite token.
- [x] UX language is complete in both Vietnamese and English.
