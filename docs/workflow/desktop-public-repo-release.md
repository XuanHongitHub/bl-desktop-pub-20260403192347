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

- `BUGLOGIN_BROWSER_API_BASE=https://api.gnohh.com`
- `NEXT_PUBLIC_SYNC_SERVER_URL=https://api.gnohh.com`
- `NEXT_PUBLIC_WEB_PORTAL_URL=https://gnohh.com`
- `NEXT_PUBLIC_BILLING_PORTAL_URL=https://gnohh.com`
- `NEXT_PUBLIC_STRIPE_BILLING_URL=https://gnohh.com`
- `BUGLOGIN_AUTH_API_URL=https://api.gnohh.com`

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
