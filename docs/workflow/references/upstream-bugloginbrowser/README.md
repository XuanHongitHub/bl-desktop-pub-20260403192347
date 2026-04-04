# Upstream Intake: BugLoginBrowser

Canonical workflow for monitoring and evaluating upstream commits from:
- `https://github.com/zhom/bugloginbrowser`

## Why this exists

BugLogin is heavily customized and cannot safely consume upstream commits blindly. This workflow ensures each upstream change is triaged before any port.

## Canonical files

- `docs/workflow/references/upstream-bugloginbrowser/upstream-intake-log.md`
- `docs/workflow/references/upstream-bugloginbrowser/commit-review-template.md`

## Intake cadence

- Weekly checkpoint: review new commits since last reviewed SHA.
- Pre-release checkpoint: extra review for security/stability/perf commits.
- Hotfix checkpoint: ad-hoc review if upstream ships critical fixes.

## Decision rubric

For each upstream commit, assign exactly one:
- `adopt`: apply with minimal or no adaptation.
- `adapt`: apply intent, but re-implement to match BugLogin architecture.
- `defer`: potentially useful but postponed.
- `skip`: not relevant or conflicts with product direction.

## Mandatory review fields

- Upstream SHA and date
- Commit summary
- Touched area (UI, Tauri backend, profile runtime, proxy, build, etc.)
- Risk level (`low`, `medium`, `high`)
- BugLogin impact
- Decision (`adopt/adapt/defer/skip`)
- Rationale
- Follow-up action and local links

## Intake execution rules

1. Never port directly without decision log entry.
2. Prefer small batch intake (1-5 related commits per local patch).
3. For diverged modules, prefer `adapt` over direct patch import.
4. Use targeted verification by default.
5. Use heavy full-project checks only when risk is high or before release.

## Suggested command snippets

```bash
# Latest upstream main SHA
git ls-remote https://github.com/zhom/bugloginbrowser.git refs/heads/main

# Optional: inspect recent commits via API
curl -s "https://api.github.com/repos/zhom/bugloginbrowser/commits?sha=main&per_page=30"

# Generate markdown-ready commit rows since last reviewed SHA
node scripts/upstream-bugloginbrowser-intake.mjs
```
