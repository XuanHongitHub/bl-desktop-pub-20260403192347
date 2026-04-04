# Topic 10 Design: Web Billing Replacement

Date: 2026-03-26
Owner: codex
Status: in_progress
OpenSpec Change: `openspec/changes/topic10-web-billing-replacement`

## Objective
Replace legacy desktop in-app checkout logic with a web-first billing portal so purchase orchestration and plan operations happen outside the desktop runtime.

## Locked Decisions
1. Billing purchase actions move to web-hosted routes only.
2. Desktop app keeps billing visibility and opens web routes with workspace context.
3. Web portal ships with Notion-like visual language for fast, clean delivery.
4. Legacy checkout/coupon/license desktop execution path is removed from primary UX.

## Scope
- Web billing landing page
- Web pricing page
- Web plans/comparison page
- Web billing management page
- Desktop pricing/billing flow replacement to launch web

## Non-Goals
- Full payment backend rewrite
- New payment provider onboarding
- Auth platform rearchitecture

## Acceptance Targets
- Desktop no longer executes purchase flow in-app.
- Web portal handles pricing/plan/management UX.
- Desktop subscription data continues to sync from control-plane state.

## Linked Execution Docs
- `docs/workflow/superpowers/plans/2026-03-26-topic10-web-billing-replacement.md`
- `docs/workflow/beads/2026-03-26-topic10-web-billing-replacement.md`
