param(
  [string]$Branch = "main",
  [string]$Tag = "",
  [switch]$Verify,
  [switch]$SkipPublicPush,
  [switch]$SkipPrivateRelease,
  [switch]$SkipPublicWorkflow
)

$ErrorActionPreference = "Stop"

function Run([string]$Cmd) {
  Write-Host "> $Cmd" -ForegroundColor Cyan
  iex $Cmd
}

function Get-NextBuildTag {
  $tags = git tag --sort=-v:refname
  $pattern = '^v(\d+)\.(\d+)\.(\d+)\+build\.(\d+)$'
  foreach ($t in $tags) {
    if ($t -match $pattern) {
      $major = [int]$Matches[1]
      $minor = [int]$Matches[2]
      $patch = [int]$Matches[3]
      $build = [int]$Matches[4] + 1
      return "v$major.$minor.$patch+build.$build"
    }
  }
  return "v1.0.0+build.1"
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "gh CLI not found. Install GitHub CLI first."
}

$dirty = git status --porcelain
if ($dirty) {
  throw "Working tree is dirty. Commit/stash first."
}

if ($Verify) {
  Run "pnpm exec tsc --noEmit"
}

if (-not $Tag) {
  $Tag = Get-NextBuildTag
  Write-Host "Auto tag: $Tag" -ForegroundColor Yellow
}

Run "git fetch --all --tags"
Run "git checkout $Branch"
Run "git pull --ff-only origin $Branch"

Run "git push origin $Branch"

if (-not $SkipPublicPush) {
  Run "git push desktop-public $Branch"
}

$tagExists = (git tag -l $Tag)
if (-not $tagExists) {
  Run "git tag -a $Tag -m 'Release $Tag'"
}
Run "git push origin $Tag"

if (-not $SkipPrivateRelease) {
  $existing = gh release view $Tag --repo keyduc91/Malvanut-Login 2>$null
  if (-not $existing) {
    Run "gh release create $Tag --repo keyduc91/Malvanut-Login --generate-notes --latest"
  } else {
    Write-Host "Release $Tag already exists on private repo." -ForegroundColor Yellow
  }
}

if (-not $SkipPublicWorkflow) {
  Run "gh workflow run 'Release Packaging Pipeline' --repo XuanHongitHub/ops-snapshot-labs --ref $Branch"
  Run "gh run list --repo XuanHongitHub/ops-snapshot-labs --workflow 'Release Packaging Pipeline' --limit 3"
}

Write-Host "Done. Branch=$Branch Tag=$Tag" -ForegroundColor Green
