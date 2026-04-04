#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Bootstrap AI context files (CLAUDE.md, AGENTS.md, Copilot instructions) into any Git repo.

.DESCRIPTION
    Copies a minimal AI context template to one or more target repositories.
    Supports three modes:
      1. Bootstrap a single specified repo
      2. Bootstrap all Git repos under a parent directory
      3. Register a PowerShell function for quick use from anywhere

.USAGE
    # Bootstrap THIS directory's repo:
    .\bootstrap-ai-context.ps1

    # Bootstrap a specific repo:
    .\bootstrap-ai-context.ps1 -TargetRepo "C:\Projects\my-app"

    # Bootstrap ALL repos under a parent folder:
    .\bootstrap-ai-context.ps1 -ScanDir "C:\Projects" -All

.NOTES
    After running, edit the generated CLAUDE.md in each repo with project-specific details.
    The generated files are minimal starters — customize them per project.
#>

param(
    [string]$TargetRepo = $PWD,
    [string]$ScanDir    = "",
    [switch]$All        = $false
)

# ── Template content ────────────────────────────────────────────────────────

$claudeTemplate = @'
# [Project Name] — AI Context File

> This file is read by AI coding assistants at the start of every session.
> Keep it updated when major architectural decisions are made.

## Project Overview

**[Project Name]** is a [brief description].

- **Tech stack:** [e.g. Next.js 15 + Tailwind / Tauri + Rust / Laravel + MySQL]
- **Package manager:** [pnpm / npm / yarn / cargo / composer]
- **Test framework:** [e.g. Vitest / Jest / PyTest / cargo test]

## Essential Commands

```bash
# Development
[dev command]       # e.g. pnpm dev / npm run dev / cargo run

# Build
[build command]     # e.g. pnpm build / cargo build --release

# Lint & Format
[lint command]      # e.g. pnpm lint / cargo clippy
[format command]    # e.g. pnpm format / cargo fmt

# Test
[test command]      # e.g. pnpm test / cargo test
```

## Architecture Rules

### DO
- [Key convention 1]
- [Key convention 2]

### DON'T
- ❌ [Anti-pattern 1]
- ❌ [Anti-pattern 2]

## Key Files / Modules

| File/Folder | Purpose |
| :--- | :--- |
| `[path]` | [description] |

## Docs Index

| Document | Purpose |
| :--- | :--- |
| `docs/` | Architecture decisions |

## Current Tech Debt

| Item | Status |
| :--- | :--- |
| [Item] | 🔴 / 🟡 / ✅ |
'@

$agentsTemplate = @'
# [Project Name] — AI Agent Context (AGENTS.md)
# For: OpenAI Codex, ChatGPT Agents, and any OpenAI-compatible coding agent.
# Full context: see CLAUDE.md

## Project
- **Name:** [Project Name]
- **Stack:** [tech stack summary]

## Commands
```bash
[dev command]
[test command]
[lint/format command]
```

## Critical Rules

### DO
- [Rule 1]
- [Rule 2]

### DON'T
- ❌ [Anti-pattern 1]
- ❌ [Anti-pattern 2]

## Full Context
See `CLAUDE.md` for complete documentation.
'@

$copilotTemplate = @'
# [Project Name] — GitHub Copilot Instructions
# See CLAUDE.md for full context.

## Stack
[tech stack]

## Conventions
- [Convention 1]
- [Convention 2]

## Commands
```bash
[key commands]
```
'@

# ── Helper: bootstrap a single repo ─────────────────────────────────────────

function Bootstrap-Repo {
    param([string]$RepoPath)

    if (-not (Test-Path "$RepoPath\.git")) {
        Write-Warning "Skipping '$RepoPath' — not a Git repository."
        return
    }

    $projectName = Split-Path -Leaf $RepoPath
    Write-Host "→ Bootstrapping: $projectName" -ForegroundColor Cyan

    # CLAUDE.md
    $claudeFile = Join-Path $RepoPath "CLAUDE.md"
    if (-not (Test-Path $claudeFile)) {
        $claudeTemplate -replace '\[Project Name\]', $projectName | Set-Content $claudeFile -Encoding UTF8
        Write-Host "  ✅ Created CLAUDE.md" -ForegroundColor Green
    } else {
        Write-Host "  ⏭  CLAUDE.md already exists — skipped" -ForegroundColor Yellow
    }

    # AGENTS.md
    $agentsFile = Join-Path $RepoPath "AGENTS.md"
    if (-not (Test-Path $agentsFile)) {
        $agentsTemplate -replace '\[Project Name\]', $projectName | Set-Content $agentsFile -Encoding UTF8
        Write-Host "  ✅ Created AGENTS.md" -ForegroundColor Green
    } else {
        Write-Host "  ⏭  AGENTS.md already exists — skipped" -ForegroundColor Yellow
    }

    # .github/copilot-instructions.md
    $githubDir  = Join-Path $RepoPath ".github"
    $copilotFile = Join-Path $githubDir "copilot-instructions.md"
    if (-not (Test-Path $copilotFile)) {
        New-Item -ItemType Directory -Path $githubDir -Force | Out-Null
        $copilotTemplate -replace '\[Project Name\]', $projectName | Set-Content $copilotFile -Encoding UTF8
        Write-Host "  ✅ Created .github/copilot-instructions.md" -ForegroundColor Green
    } else {
        Write-Host "  ⏭  copilot-instructions.md already exists — skipped" -ForegroundColor Yellow
    }

    Write-Host "  → Edit CLAUDE.md to add project-specific details.`n" -ForegroundColor DarkGray
}

# ── Main logic ───────────────────────────────────────────────────────────────

if ($All -and $ScanDir -ne "") {
    # Scan all subdirectories for Git repos
    $repos = Get-ChildItem -Path $ScanDir -Directory |
             Where-Object { Test-Path (Join-Path $_.FullName ".git") }

    if ($repos.Count -eq 0) {
        Write-Warning "No Git repositories found under '$ScanDir'."
        exit 1
    }

    Write-Host "Found $($repos.Count) repositories under '$ScanDir'.`n" -ForegroundColor Cyan
    foreach ($repo in $repos) {
        Bootstrap-Repo -RepoPath $repo.FullName
    }
} else {
    # Bootstrap single repo
    Bootstrap-Repo -RepoPath (Resolve-Path $TargetRepo).Path
}

Write-Host "Done! Next steps:" -ForegroundColor Green
Write-Host "  1. Open CLAUDE.md in each repo and fill in the [Project Name] and details." -ForegroundColor White
Write-Host "  2. Commit the files: git add CLAUDE.md AGENTS.md .github/ && git commit -m 'chore: add AI context files'" -ForegroundColor White
