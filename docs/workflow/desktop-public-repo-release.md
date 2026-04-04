# Desktop Public Repo Release (Windows + GH CLI)

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

## Build and release desktop (free-budget path)

Workflow file: `.github/workflows/desktop-release-public.yml`

### Option A: Manual release
- Open GitHub Actions
- Run workflow `Desktop Release (Public Repo)`
- Input `release_tag` (example `v0.17.1-desktop.1`)
- Keep `publish_release=true`

### Option B: Tag-based release

```powershell
git tag v0.17.1-desktop.1
git push origin v0.17.1-desktop.1
```

The workflow runs on `windows-latest`, builds NSIS installer only, uploads artifact, and publishes GitHub Release.
