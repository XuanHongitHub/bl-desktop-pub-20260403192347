# Implementation Tasks: Topic 5 - UI Shell and Scroll Contract Normalization

**Change ID:** `topic5-ui-shell-normalization`

## Phase 1: Shell and Scroll Audit

- [x] 1.1 Inventory shared scroll primitives and shell containers that still rely on custom overlay scrollbar behavior.
- [x] 1.2 Classify layout escape hatches that can be removed safely versus those that need compatibility handling.
- [x] 1.3 Freeze the native thin scrollbar contract as the canonical desktop-shell behavior.

**Quality Gate:**
- [x] The scroll contract is documented in one place and can be tested.

## Phase 2: Shared Primitive Normalization

- [x] 2.1 Convert shared `ScrollArea` to a native overflow container that inherits the global thin scrollbar styling.
- [x] 2.2 Remove dead custom scrollbar surface from the shared primitive.
- [x] 2.3 Keep status/chip primitives readable by removing clipping assumptions.

**Quality Gate:**
- [x] Shared primitives no longer render overlay scrollbar chrome.
- [x] Localized labels and descenders are not clipped by base UI primitives.

## Phase 3: Shell and Dialog Cleanup

- [x] 3.1 Normalize page-mode shells so long content scrolls in a flex/min-h-0 chain.
- [x] 3.2 Normalize long dialogs so body scroll and footer separation remain stable.
- [x] 3.3 Remove negative-margin or inset compensation that fights the shell scroll contract.
- [x] 3.4 Normalize sidebar header branding so the logo-only header carries the collapse/expand control.

**Quality Gate:**
- [x] Settings-like pages and long dialogs no longer hide their scrollbar affordance.
- [x] Content overlap does not occur at max-height breakpoints.
- [x] Sidebar collapse control stays in the header row and does not float as a separate block.

## Phase 4: Verification and Guardrails

- [x] 4.1 Add/maintain targeted guards for shell, scroll, and clipping behavior.
- [x] 4.2 Run focused smoke checks for the normalized layout surfaces.
- [x] 4.3 Sync docs/beads with the final shell contract.

**Quality Gate:**
- [x] Regression tests fail if the old overlay-scrollbar or clipping pattern returns.
- [x] The workflow docs mirror the implemented layout contract.
