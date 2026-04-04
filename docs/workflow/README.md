# Workflow Hub

Single entrypoint for the repository workflow standard.

## Canonical triad

1. OpenSpec (source of truth)
- `openspec/README.md`
- `openspec/project.md`
- `openspec/changes/`

2. Superpowers (operational specs + plans)
- `docs/workflow/superpowers/README.md`
- `docs/workflow/superpowers/specs/`
- `docs/workflow/superpowers/plans/`

3. Beads (execution tracking)
- `docs/workflow/beads/README.md`
- `docs/workflow/beads/`

4. References (historical/analysis artifacts)
- `docs/workflow/references/`
- `docs/workflow/references/upstream-bugloginbrowser/` (upstream intake canonical log)
- `docs/workflow/references/tiktok-seller-signup/` (cleaned Sign Up TikTok Seller HTML dataset)

## Rule

- Do not recreate `openspecs/`.
- Keep OpenSpec + Superpowers + Beads synchronized for non-trivial changes.
- For upstream intake from `zhom/bugloginbrowser`, use the canonical files under `docs/workflow/references/upstream-bugloginbrowser/`.

## Release runbooks

- Desktop public release-only flow: `docs/workflow/desktop-public-repo-release.md`
