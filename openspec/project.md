# OpenSpec Project Conventions

## Purpose
This folder contains spec-driven workflow artifacts for BugLogin.

## Workflow
1. Create proposal in `openspec/changes/<change-id>/proposal.md`.
2. Define implementation checklist in `tasks.md`.
3. Define behavior deltas in `specs/*_delta.md`.
4. Implement changes.
5. Merge final requirements into `openspec/specs/`.
6. Archive completed changes under `openspec/archive/`.

## Conventions
- Keep change IDs short and kebab-case.
- Keep scope minimal and explicit.
- Align with `AGENTS.md` and `CLAUDE.md`.
- Treat Windows runtime as primary when dependency install happened in Windows.
