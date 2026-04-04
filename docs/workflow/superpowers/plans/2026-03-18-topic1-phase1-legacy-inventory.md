# Phase 1 Inventory: Legacy Brand and Trial Residue

Date: 2026-03-18
Owner: codex
Status: completed
Parent Plan: `docs/workflow/superpowers/plans/2026-03-18-topic1-rebrand-and-ux-hardening.md`

## Summary
- Total files containing legacy brand identifiers (legacy sync/service naming, old labels, old package names): 41.
- Total files containing trial/commercial/license-gating residue: 12.
- Classification completed for rollout safety: runtime-critical, compatibility, tests/ci, docs/prompts, and third-party skill assets.

## A. Runtime-Critical (change via compatibility-first batches)
- `src-tauri/src/lib.rs` (`"buglogin-browser"` MCP config key)
- `src/components/integrations-dialog.tsx` (`"buglogin-browser"` MCP sample config)
- `src-tauri/src/sync/manifest.rs` (`.buglogin-sync/**` sync cache path)
- `src-tauri/src/app_auto_updater.rs` (legacy artifact names and repo constants)
- `src-tauri/src/app_dirs.rs` (legacy upstream directory comments and temp path labels)
- `src-tauri/src/ephemeral_dirs.rs` (legacy temporary dir naming)
- `src-tauri/src/vpn_worker_runner.rs` (legacy temp config/log naming)
- `src-tauri/src/api_client.rs` (legacy endpoint/domain wording)

Decision:
- Keep backward-compatible aliases while introducing BugLogin-first canonical names.
- Do not hard cut identifiers that can break existing persisted data or integrations.

## B. Compatibility Layer Already Added
- `scripts/dev.sh` resolves `buglogin-sync` first, with legacy fallback support.
- `scripts/sync-test-harness.mjs` resolves sync dir with fallback.
- `scripts/run-in-sync-dir.mjs` executes sync scripts in canonical dir, fallback to legacy.

## C. Workspace and Build Metadata (low-risk, next rename batch)
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `scripts/dev-workflow.mjs`

## D. Trial/Commercial Residue (token-ready neutral target)
- Frontend
  - `src/components/commercial-trial-modal.tsx`
  - `src/hooks/use-commercial-trial.ts`
  - `src/app/page.tsx` (hook comment/wiring note)
  - `src/i18n/locales/{en,es,fr,ja,pt,ru,vi,zh}.json` (`commercial.*` keyset)
- Backend
  - `src-tauri/src/commercial_license.rs`
  - `src-tauri/src/lib.rs` (trial commands)
  - `src-tauri/src/settings_manager.rs` (`commercial_trial_acknowledged`)

Decision:
- UI interruption is already removed.
- Keep backend interfaces in token-ready/deferred state for future `kmediaz.com` integration.

## E. CI / Release / Docs / Prompt Residue (safe rename after runtime freeze)
- Workflows: `.github/workflows/{release.yml,rolling-release.yml,lint-rs.yml,osv.yml}`
- Prompt templates: `.github/prompts/*.yml`
- Sync self-hosting docs are now BugLogin-first.
- Sync service package/source still keeps legacy compatibility paths until full cutover.

## F. Explicitly Excluded from Product Rename
- License/legal text files: `LICENSE`, `CONTRIBUTOR_LICENSE_AGREEMENT.md`, `CONTRIBUTING.md`.
- Skill dataset references under `.agents/` and `.claude/` where legacy keywords may be generic technical terms, not product brand.

## Rollout Order (Locked)
1. Keep runtime compatibility aliases and add BugLogin-first canonical keys/paths.
2. Migrate workspace/build metadata to dual-path support.
3. Update docs/CI/prompts branding.
4. Final cutover of sync service directory/package naming when VPS/runtime readiness is confirmed.

## Exit Criteria for Phase 1
- Inventory complete and classified by risk.
- Rename batches have explicit compatibility boundaries.
- No blind global-replace operation required.
