# Superpowers Workspace Layout

This folder is the operational collaboration layer for planning and execution.

## Canonical structure

- `docs/workflow/superpowers/plans/`
  - implementation plans
  - phase logs
  - use naming: `YYYY-MM-DD-<topic>.md`
- `docs/workflow/superpowers/specs/`
  - design notes and implementation-oriented specs
  - use naming: `YYYY-MM-DD-<topic>-design.md`
- `docs/workflow/superpowers/plans/_template.md`
- `docs/workflow/superpowers/specs/_template-design.md`

## Relationship with OpenSpec

- OpenSpec source of truth: `openspec/`
- Superpowers operational docs: `docs/workflow/superpowers/*`
- Both must stay synchronized for non-trivial scoped changes.
