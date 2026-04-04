id: relax-validation-and-add-workflow
status: done
owner: codex
created_at: 2026-03-18
updated_at: 2026-03-18
scope: Relax mandatory full lint/test policy, protect tauri dev flow, and add OpenSpec/Superpowers/Beads workflow.
files:
  - AGENTS.md
  - CLAUDE.md
  - openspec/project.md
  - openspec/specs/agent-workflow.md
  - openspec/changes/relax-validation-and-add-workflow/proposal.md
  - openspec/changes/relax-validation-and-add-workflow/tasks.md
  - openspec/changes/relax-validation-and-add-workflow/specs/agent-workflow_delta.md
  - docs/workflow/beads/README.md
notes:
  - Full checks moved to conditional execution.
  - Explicitly avoid heavy checks during active tauri dev unless requested.
  - Runtime guidance emphasizes Windows-first execution when install context is Windows.
