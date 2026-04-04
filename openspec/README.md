# OpenSpec Canonical Layout

This repository uses `openspec/` as the single source of truth for change lifecycle.

## Required structure

- `openspec/project.md`
- `openspec/specs/`
- `openspec/changes/<change-id>/`
  - `proposal.md`
  - `tasks.md`
  - `specs/*_delta.md`

## Rule

Do not create or use `openspecs/` here.
All OpenSpec artifacts must be created under `openspec/`.
