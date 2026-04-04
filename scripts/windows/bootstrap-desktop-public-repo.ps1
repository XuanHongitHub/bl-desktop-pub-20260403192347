param(
  [Parameter(Mandatory = $true)]
  [string]$RepoOwner,

  [Parameter(Mandatory = $true)]
  [string]$RepoName,

  [string]$DefaultBranch = "main",
  [switch]$DisableActions
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing command: $Name"
  }
}

Require-Command "gh"
Require-Command "git"

$repoSlug = "$RepoOwner/$RepoName"

Write-Host "[1/7] Check GitHub auth..." -ForegroundColor Cyan
gh auth status | Out-Host

Write-Host "[2/7] Create public repo..." -ForegroundColor Cyan
gh repo create $repoSlug --public --disable-issues --disable-wiki --confirm | Out-Host

Write-Host "[3/7] Add origin and push current branch..." -ForegroundColor Cyan
$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if ([string]::IsNullOrWhiteSpace($currentBranch)) {
  $currentBranch = $DefaultBranch
}

$hasOrigin = $false
try {
  git remote get-url origin | Out-Null
  $hasOrigin = $true
} catch {
  $hasOrigin = $false
}

if ($hasOrigin) {
  git remote rename origin origin-old
}
git remote add origin ("https://github.com/{0}.git" -f $repoSlug)
git push -u origin $currentBranch | Out-Host

Write-Host "[4/7] Set default branch..." -ForegroundColor Cyan
gh api -X PATCH "repos/$repoSlug" -f default_branch=$currentBranch | Out-Host

Write-Host "[5/7] Enable minimal branch protection..." -ForegroundColor Cyan
$protection = @{
  required_status_checks         = @{
    strict   = $true
    contexts = @()
  }
  enforce_admins                 = $true
  required_pull_request_reviews  = @{
    required_approving_review_count = 1
    dismiss_stale_reviews           = $true
  }
  restrictions                   = $null
  allow_force_pushes             = $false
  allow_deletions                = $false
  required_conversation_resolution = $true
} | ConvertTo-Json -Depth 8

gh api -X PUT "repos/$repoSlug/branches/$currentBranch/protection" `
  -H "Accept: application/vnd.github+json" `
  --input - <<< $protection | Out-Host

Write-Host "[6/7] Set Actions permission..." -ForegroundColor Cyan
if ($DisableActions) {
  gh api -X PUT "repos/$repoSlug/actions/permissions" -f enabled=false | Out-Host
} else {
  gh api -X PUT "repos/$repoSlug/actions/permissions" -f enabled=true -f allowed_actions=all | Out-Host
}

Write-Host "[7/7] Done: $repoSlug" -ForegroundColor Green
Write-Host "Next: add release env secrets if needed, then run workflow 'Desktop Release (Public Repo)'." -ForegroundColor Yellow
