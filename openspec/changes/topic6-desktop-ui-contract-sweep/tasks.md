# Implementation Tasks: Topic 6 - Desktop UI Action Hierarchy and Surface Contract

**Change ID:** `topic6-desktop-ui-contract-sweep`

## Phase 1: Audit and Contract Definition

- [ ] 1.1 Inventory page headers, toolbars, dialog headers/footers, and table action bars that currently mix action types.
- [ ] 1.2 Classify actions into primary, secondary, utility, bulk, and destructive groups.
- [ ] 1.3 Write the desktop action hierarchy contract so future screens have a clear default pattern.

**Quality Gate:**
- [ ] The action hierarchy is documented in one place and can be referenced by future UI work.

## Phase 2: Shared Surface Primitives

- [ ] 2.1 Normalize shared header/action containers so title-left, action-right becomes the default.
- [ ] 2.2 Normalize toolbar rows so filters, search, saved views, and utility toggles sit below or beside the primary CTA instead of replacing it.
- [ ] 2.3 Normalize dialog footers so confirm/cancel actions remain anchored and predictable.

**Quality Gate:**
- [ ] Shared primitives provide a stable default layout contract for new screens.

## Phase 3: High-Traffic Surface Sweep

- [ ] 3.1 Update the main workspace header/actions surface to separate primary actions from search and utility controls.
- [ ] 3.2 Sweep Settings, Proxy, Integrations, and Create Profile surfaces for the new hierarchy.
- [ ] 3.3 Sweep table-heavy surfaces so bulk actions and selection bars are isolated from the page header.

**Quality Gate:**
- [ ] The most visible app surfaces use the same action hierarchy contract.

## Phase 4: Long-Tail Surface Cleanup

- [ ] 4.1 Sweep remaining dialogs and forms that still center or over-pack actions.
- [ ] 4.2 Normalize narrow-window fallbacks so the hierarchy degrades gracefully.
- [ ] 4.3 Remove per-screen layout hacks that fight the shared action contract.

**Quality Gate:**
- [ ] No routine workflow screen depends on a one-off action layout pattern.

## Phase 5: Verification and Guardrails

- [ ] 5.1 Add guard tests for header/action placement and overflow behavior.
- [ ] 5.2 Run focused UI smoke checks on the highest-traffic screens.
- [ ] 5.3 Sync OpenSpec, Superpowers, and Beads with the finalized contract.

**Quality Gate:**
- [ ] The contract is documented, testable, and ready for future UI work.
