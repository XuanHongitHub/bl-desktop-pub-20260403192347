# Implementation Tasks: Topic 13 - Groups Workspace Upgrade

**Change ID:** `topic13-groups-workspace-upgrade`

---

## Phase 1: Data and Contract Foundation

- [ ] 1.1 Audit current groups data model, API contracts, and UI call sites
- [ ] 1.2 Define normalized state model for groups, members, and selection/bulk actions
- [ ] 1.3 Add/adjust API helpers for query, mutation, and activity retrieval
- [ ] 1.4 Add targeted unit tests for helper/state logic

**Quality Gate:**
- [ ] Group API helpers pass targeted tests
- [ ] TypeScript passes for touched foundation files

---

## Phase 2: Groups Index (Table-First UX)

- [ ] 2.1 Rebuild groups index into clean data-grid layout (minimal cards)
- [ ] 2.2 Add search, status filters, sort, pagination, row selection
- [ ] 2.3 Add row-level quick actions and bulk action toolbar
- [ ] 2.4 Align typography/style with workspace profile surface
- [ ] 2.5 Add hover/focus/keyboard interaction polish for menu and actions

**Quality Gate:**
- [ ] Empty/loading/error states verified
- [ ] Selection and bulk action behaviors verified manually
- [ ] Desktop and web visual parity checklist passes for index page

---

## Phase 3: Group Detail and Operational Panels

- [ ] 3.1 Build group detail shell (members, policies/rules, sync health, activity)
- [ ] 3.2 Implement add/remove/move members flows with confirmation and toast feedback
- [ ] 3.3 Implement policy/rule preview and assignment UX
- [ ] 3.4 Implement sync health/drift indicators and recent activity timeline

**Quality Gate:**
- [ ] Happy path: create/edit group + member operations succeeds
- [ ] Error path: API failures show actionable toasts and stable UI state
- [ ] No unhandled promise rejections in group flows

---

## Phase 4: Permission, i18n, and Rollout Hardening

- [ ] 4.1 Enforce role-based UI access and action guards
- [ ] 4.2 Add/refresh translation keys in `en.json` and `vi.json`
- [ ] 4.3 Run targeted regression checks for related profile/group areas
- [ ] 4.4 Sync docs (OpenSpec/spec/plan/bead) and rollout notes

**Quality Gate:**
- [ ] Permission matrix validated for owner/admin/member
- [ ] Translation coverage complete for new copy
- [ ] Targeted verification commands succeed

---

## Completion Checklist

- [ ] All phases complete
- [ ] Targeted tests for touched logic pass
- [ ] TypeScript/lint checks for touched files pass
- [ ] Documentation synced and ready for `/openspec-archive`
