# Beads

This folder stores lightweight execution beads for multi-step changes.

## Canonical structure

- Place bead files directly under `docs/workflow/beads/`
- Use naming: `YYYY-MM-DD-<topic>.md`
- Start from `docs/workflow/beads/_template.md`

## Status flow

`todo -> in_progress -> done` (or `blocked`)

## Required fields

- `id`: unique kebab-case id
- `status`: `todo | in_progress | done | blocked`
- `owner`: assignee
- `created_at`: date
- `updated_at`: date
- `scope`: short description
- `files`: touched files
- `notes`: key decisions
