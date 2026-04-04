# Desktop Public Repo Release (Windows + GH CLI)

## Public repo camouflage contract (required)

Goal:
- Private repo (`keyduc91/Malvanut-Login`) keeps full source.
- Public repo (`XuanHongitHub/ops-snapshot-labs`) is **release-only** for desktop packaging.

Public repo `main` must contain only:
- `.github/workflows/desktop-release-public.yml`
- `src/`, `src-tauri/`, `public/`, `scripts/`
- build/config files needed by Tauri/Next static build (`package.json`, `pnpm-lock.yaml`, `next.config.ts`, `tsconfig.json`, etc.)
- `PUBLIC_REPO_SCOPE.md`

Must NOT exist in public repo:
- `buglogin-sync/`, `docs/`, `openspec/`, `private/`, `mockups/`, internal workflows, and any sensitive operations data.

## Commit/push flow (do not skip)

1. Commit normal work to private repo first.
2. Push private:

```powershell
git push origin main
```

3. Sync **release-only scope** to public `main` (from private HEAD) using a temporary worktree:

```powershell
$tmp = Join-Path $env:TEMP "public-release-only-$([guid]::NewGuid().ToString('N'))"
git worktree add -B temp-public-release-only $tmp desktop-public/main
Push-Location $tmp

git rm -r .
git clean -fdx

git -C "E:\bug-login" archive --format=tar HEAD `
  .github/workflows/desktop-release-public.yml `
  .gitignore `
  LICENSE README.md components.json `
  next-env.d.ts next.config.ts package.json `
  pnpm-lock.yaml pnpm-workspace.yaml `
  postcss.config.mjs tailwind.config.js tsconfig.json `
  public scripts src src-tauri `
| tar -xf -

@'
# Public Release-Only Scope
This repository is intentionally limited to desktop app release packaging.
'@ | Set-Content PUBLIC_REPO_SCOPE.md

git add -A
git commit -m "chore(public): sync release-only desktop packaging scope"
git push desktop-public HEAD:main

Pop-Location
git worktree remove $tmp --force
git branch -D temp-public-release-only
```

4. Before releasing, verify public scope quickly:

```powershell
git ls-tree --name-only desktop-public/main
```

Expected top-level list must not include `docs`, `openspec`, `buglogin-sync`, `private`, `mockups`.

## Release checklist (pre-run)

1. Confirm endpoints:
   - `https://api.buglogin.com/v1/browser/bugox.json`
   - `https://api.buglogin.com/v1/browser/bugium.json`
2. Confirm public repo variables are set (no `buglogin.com`).
3. Run workflow `Release Packaging Pipeline` in public repo.
4. Verify release assets created in target repo.

## Security toggles to enable (recommended)

1. Branch protection on `main`:
   - Require pull request before merge
   - Require 1 approving review
   - Require conversation resolution
   - Disallow force-push/delete
   - Enforce for admins
2. Actions:
   - Keep enabled
   - Do not allow untrusted third-party workflows unless pinned
3. Secrets:
   - Only add needed secrets
   - Rotate tokens regularly

## Create new public repo (hard-to-search name)

Run in **Windows PowerShell** at project root:

```powershell
.\scripts\windows\bootstrap-desktop-public-repo.ps1 `
  -RepoOwner "<your-github-user-or-org>" `
  -RepoName "bl-desktop-pub-7f4k1x"
```

This script will:
- create a new public repo,
- push current branch,
- set default branch,
- apply branch protection baseline,
- enable Actions.

## Production env contract (desktop)

Current production contract used by workflow:

- `BUGLOGIN_BROWSER_API_BASE=https://api.buglogin.com`
- `NEXT_PUBLIC_SYNC_SERVER_URL=https://api.buglogin.com`
- `NEXT_PUBLIC_WEB_PORTAL_URL=https://buglogin.com`
- `NEXT_PUBLIC_BILLING_PORTAL_URL=https://buglogin.com`
- `NEXT_PUBLIC_STRIPE_BILLING_URL=https://buglogin.com`
- `BUGLOGIN_AUTH_API_URL=https://api.buglogin.com`

Do not inject `NEXT_PUBLIC_SYNC_TOKEN` or `BUGLOGIN_DEFAULT_SYNC_TOKEN` into public desktop build workflows. Those values can be extracted from shipped clients.

Managed browser metadata endpoints must be available before starting a desktop release build:

- `https://api.buglogin.com/v1/browser/bugox.json`
- `https://api.buglogin.com/v1/browser/bugium.json`

If you host metadata on `buglogin-sync`, configure these keys at deploy time:

- `BUGLOGIN_RELEASE_API_TOKEN`
- `BUGLOGIN_BUGOX_VERSION`, `BUGLOGIN_BUGOX_WINDOWS_X64`, `BUGLOGIN_BUGOX_WINDOWS_ARM64`, `BUGLOGIN_BUGOX_LINUX_X64`, `BUGLOGIN_BUGOX_LINUX_ARM64`, `BUGLOGIN_BUGOX_MACOS_X64`, `BUGLOGIN_BUGOX_MACOS_ARM64`
- `BUGLOGIN_BUGIUM_VERSION`, `BUGLOGIN_BUGIUM_WINDOWS_X64`, `BUGLOGIN_BUGIUM_WINDOWS_ARM64`, `BUGLOGIN_BUGIUM_LINUX_X64`, `BUGLOGIN_BUGIUM_LINUX_ARM64`, `BUGLOGIN_BUGIUM_MACOS_X64`, `BUGLOGIN_BUGIUM_MACOS_ARM64`
- Optional policy keys: `BUGLOGIN_BUGOX_UPDATE_MODE`, `BUGLOGIN_BUGIUM_UPDATE_MODE`, `BUGLOGIN_BUGOX_MIN_SUPPORTED_VERSION`, `BUGLOGIN_BUGIUM_MIN_SUPPORTED_VERSION`

## Build and release desktop (mandatory 2-phase)

Workflow file: `.github/workflows/desktop-release-public.yml`

### Phase 1: Verify build only (required)
- Open GitHub Actions
- Run workflow `Release Packaging Pipeline`
- Set `publish_release=false`
- Wait until both jobs (`build-windows`, `build-macos`) are green

### Phase 2: Publish release (manual only)
- Run workflow `Release Packaging Pipeline` again
- Set:
  - `publish_release=true`
  - `release_tag=vX.Y.Z-desktop.N`
  - `target_repo=keyduc91/Malvanut-Login` (or desired target)

Tag-push auto release is disabled by design. Publish is always manual after verify passes.
