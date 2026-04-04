id: upstream-bugloginbrowser-intake-workflow
status: done
owner: codex
created_at: 2026-03-19
updated_at: 2026-03-19
scope: Create canonical upstream intake workflow for tracking and selectively porting commits from zhom/bugloginbrowser.
files:
  - openspec/changes/upstream-bugloginbrowser-intake-workflow/proposal.md
  - openspec/changes/upstream-bugloginbrowser-intake-workflow/tasks.md
  - openspec/changes/upstream-bugloginbrowser-intake-workflow/specs/agent-workflow_delta.md
  - docs/workflow/superpowers/specs/2026-03-19-upstream-bugloginbrowser-intake-design.md
  - docs/workflow/superpowers/plans/2026-03-19-upstream-bugloginbrowser-intake.md
  - docs/workflow/references/upstream-bugloginbrowser/README.md
  - docs/workflow/references/upstream-bugloginbrowser/commit-review-template.md
  - docs/workflow/references/upstream-bugloginbrowser/upstream-intake-log.md
  - docs/workflow/README.md
  - AGENTS.md
notes:
  - Keep one canonical upstream tracking folder and template.
  - Every upstream commit must get an explicit decision before any local port.
  - Default to targeted verification to protect active dev flow.
