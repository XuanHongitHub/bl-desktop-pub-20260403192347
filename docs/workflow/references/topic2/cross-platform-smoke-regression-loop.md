# Topic 2 Cross-Platform Smoke + Regression Loop

Date: 2026-03-19
Scope: Topic 2 P0-06

## 1) Required Environment

- Target OS set: Windows, macOS, Linux.
- Same candidate build/version across all OS.
- Same smoke profile fixture set (minimum 5 profiles):
  - Default profile
  - Profile with valid proxy
  - Profile with invalid proxy
  - Wayfern/Camoufox profile
  - Team-shared profile

## 2) Smoke Scenario Set (T2-GATE-07)

Run these scenarios on each OS:

1. Create profile -> run -> stop -> relaunch.
2. Create profile with proxy -> validate -> run.
3. Force invalid proxy -> verify retry/edit recovery path.
4. Clone profile -> confirm inherited settings.
5. Bulk select -> assign group/proxy -> verify reflected in list.
6. Role checks under viewer account (write actions must be denied).

Pass condition:
- 0 blocker crash.
- All viewer write actions denied.
- No dead-end state in create/proxy/run path.

## 3) Regression Loop (T2-GATE-08)

- A regression loop is complete when all smoke scenarios pass on all 3 OS.
- Topic 2 release readiness requires 3 consecutive passing loops.
- If any scenario fails on any OS:
  - Mark loop as failed.
  - Create bug ticket and include evidence references.
  - Restart consecutive counter after fix.

## 4) Evidence Logging

Use the helper script:

```bash
node scripts/topic2-release-gate.mjs loop-start --build "0.0.0-topic2-rc1" --notes "Loop 1"
node scripts/topic2-release-gate.mjs record --os windows --scenario "create-run-stop-relaunch" --result pass
node scripts/topic2-release-gate.mjs record --os windows --scenario "create-proxy-validate-run" --result pass
node scripts/topic2-release-gate.mjs record --os windows --scenario "invalid-proxy-recovery" --result pass
node scripts/topic2-release-gate.mjs record --os windows --scenario "clone-config-integrity" --result pass
node scripts/topic2-release-gate.mjs record --os windows --scenario "bulk-assign-reflect" --result pass
node scripts/topic2-release-gate.mjs record --os windows --scenario "viewer-role-deny" --result pass
# repeat for macos and linux, then:
node scripts/topic2-release-gate.mjs loop-close --notes "Loop 1 complete"
node scripts/topic2-release-gate.mjs status
node scripts/topic2-release-gate.mjs summary
```

Command set:
- `loop-start --build <candidate-build> [--notes ...]`
- `record --os <windows|macos|linux> --scenario <name> --result <pass|fail|blocked>`
- `loop-close [--loop <id>] [--notes ...]`
- `status`
- `summary`

Required scenario names:
- `create-run-stop-relaunch`
- `create-proxy-validate-run`
- `invalid-proxy-recovery`
- `clone-config-integrity`
- `bulk-assign-reflect`
- `viewer-role-deny`

Evidence artifact:
- `docs/workflow/references/topic2/gates/gate-log.json`

## 5) Go/No-Go Rule

Go only when:
- T2-GATE-07 passes for Windows + macOS + Linux in the same candidate build.
- T2-GATE-08 reaches 3 consecutive pass loops.
- No open blocker from Topic 2 P0 items.
