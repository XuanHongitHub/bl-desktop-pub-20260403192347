# Backend/Core Profile Flow - Deep Analysis & Refactor (2026-03-29, updated 2026-03-30)

## 1) Scope
- Runtime + lifecycle state machine
- Team lock (multi-machine/team)
- Sync pipeline (S3 via sync service): queue/replay/retry/idempotency
- Scale behavior for 50/500/2000+ profiles

## 2) Root-Cause (Before)
- `save_profile` triggered global tag rebuild from `list_profiles` every save => O(n) per save.
- Status loop in `lib.rs` probed all profiles every 5s; each probe could do process-table scan => O(n * process_scan).
- `profile-updated` emitted even when status did not change (event storm).
- Lock enforcement used stale profile payload path in launch flow; release path ignored HTTP result.
- Lock pre-check relied on local cache without strong stale/lease handling.
- `open_url_with_profile` path could launch without strict lock enforcement.
- Sync scheduler had no durable outbox and no retry/backoff state persistence across restart.
- Sync upload/download task errors were swallowed; sync could appear successful despite partial failure.
- Sync subscription parser expected old `profiles/<id>.tar.gz` key while engine uses `profiles/<id>/manifest.json|metadata.json|files/*`.
- Sync list API call used single page (`max_keys=1000`, no pagination loop).
- Proxy temp PID used fixed `0/1` placeholders => potential race when multiple launches overlap.

## 3) Refactor Architecture (Implemented)
### 3.1 Lifecycle State Machine
- Added states in `RuntimeState`:
  - `Starting`, `Running`, `Parked`, `Stopping`, `Syncing`, `Error`, `Stopped`, `Crashed`, `Terminating`
- Enforced transitions in backend runtime:
  - launch path: `Starting -> Running` (or `Error`)
  - kill path: `Stopping -> Stopped` (or `Error`)
  - sync execution: `Stopped -> Syncing -> Stopped` (or `Error`)

### 3.2 Lock (Lease + stale recovery + backend enforcement)
- Lock acquisition now enforced against freshest profile data in backend launch path.
- Removed fragile local-cache pre-block in `acquire_team_lock_if_needed` (server remains source of truth).
- Added stale lock handling:
  - use `expiresAt` when present
  - fallback to `lockedAt + default lease window`
  - stale lock auto-evicted from local cache
- `release_lock` now validates HTTP response; only clears local cache on success/404.
- Heartbeat handles non-success responses and removes local lock on 404.
- `open_url_with_profile` now enforces lock before launch path when profile not already running.
- Launch/open failure paths release lock if lock was acquired in this run.

### 3.3 Sync Reliability (Outbox/Replay/Retry/Idempotency)
- Added durable profile sync outbox in scheduler:
  - persisted at `profiles/.sync_profile_outbox.json`
  - contains `idempotency_key`, `attempts`, `next_attempt_at_ms`, `reason`, `queued`
- Startup replay:
  - scheduler loads persisted outbox and resumes pending profile sync work.
- Retry/backoff:
  - exponential backoff with cap
  - attempt count tracked per profile
  - retry metadata emitted in `profile-sync-status`
- Concurrency limit:
  - bounded profile sync processing (`PROFILE_SYNC_CONCURRENCY_LIMIT=4`)
- Backpressure:
  - in-flight set prevents duplicate concurrent sync per profile.
- Outbox persistence now uses `dirty + debounce` flush (250ms window, tick-assisted)
  to reduce write amplification under event storms while preserving replay durability.
- Lifecycle hooks:
  - on launch success: mark running + queue profile sync
  - on stop success: mark stopped + queue immediate profile sync

### 3.4 Sync Correctness Fixes
- Subscription parser now supports:
  - `profiles/<id>/manifest.json`
  - `profiles/<id>/metadata.json`
  - `profiles/<id>/files/*`
  - plus backward-compatible `profiles/<id>.tar.gz`
- Sync list API now paginates until completion (continuation token loop).
- Upload/download file workers now propagate failures (no silent partial success).

### 3.5 Scale & Event Throughput
- Removed global tag rebuild from `save_profile` hot path.
- Reduced status probing in `lib.rs`:
  - fast path probes only active/uncertain states
  - full sweep only every ~60s
- `check_browser_status` now persists/emits only on actual state changes.
- Proxy temp PID now uses unique high-range placeholder per launch (no fixed `0/1`).
- `sync/scheduler.rs` now snapshots profile metadata once per batch instead of calling
  `ProfileManager::list_profiles()` per in-flight profile task.
- `sync/scheduler.rs` now creates one shared sync engine per batch (instead of per profile)
  to reduce auth/config fetch overhead under burst close/open workloads.
- `profile/manager.rs` now uses read-through in-memory cache for `list_profiles()` (cache
  bound to current `profiles_dir`, with invalidation on profile delete paths and upsert on save).
- `profile/manager.rs` cache now maintains `profile_id -> profile` index for O(1) single-profile
  lookups (`get_profile_by_id`/`get_profile_by_id_str`) used by runtime/scheduler hot paths.

## 4) Flow Matrix (Backend/Core)
| Category | Flow Tốt | Chưa Tốt | Có thể sửa | Sửa triệt để (đã làm) |
|---|---|---|---|---|
| Lifecycle state | có `Running/Stopped/Parked` | thiếu `Starting/Stopping/Syncing/Error` | thêm state mới | state machine backend đầy đủ + transition tại launch/kill/sync |
| Team lock | có acquire/release API | stale cache + release mù + enforce chưa chặt ở open-url | check stale + response | enforce backend bằng profile mới nhất, stale recovery, release có kiểm tra status |
| Sync durability | có queue cơ bản | không outbox bền, retry yếu | thêm retry/backoff | outbox persisted + replay + idempotency key + retry |
| Sync parser | có SSE listener | parser lệch format object key hiện tại | normalize key | parser hỗ trợ manifest/metadata/files + compat tar.gz |
| Sync list scale | có list | dừng ở 1000 key | pagination | list loop với continuation token |
| Save hot path | có save metadata | save kéo theo rebuild tags O(n) | tách rebuild | loại O(n) khỏi save hot path |
| Status loop | có heartbeat status | quét toàn bộ profile mỗi 5s | probe chọn lọc | probe theo active-state + full sweep giãn chu kỳ |
| Proxy PID map | có remap temp->actual | fixed temp PID gây race | temp per-launch | temp PID unique theo launch |

## 5) P0 / P1 / P2 Rollout + Risk
### P0 (đã implement)
- Lifecycle state machine backend
- Lock enforce + stale recovery + release correctness
- Durable outbox/replay + retry/backoff + concurrency limit
- SSE parser + list pagination + upload/download error propagation
- Remove save O(n) hotspot + reduce status probe storm

### P1 (khuyến nghị tiếp theo)
- Batch process snapshot shared cho status checks (single snapshot reused across probes)
- Add explicit lock lease duration contract from server payload (strict TTL, no fallback)
- End-to-end idempotency key handshake with sync API (request header / metadata)

### P2 (hardening)
- Chaos testing: random crash/network partition/clock skew
- Long-run soak test 24h with 2k-5k profiles
- Observability dashboard: queue depth, retry histogram, stale-lock count, sync latency p95/p99

### Rollback strategy
- Each change is local to backend modules; rollback by reverting:
  - `team_lock.rs` (lease/release behavior)
  - `sync/scheduler.rs` (outbox/retry)
  - `sync/subscription.rs` + `sync/client.rs` + `sync/engine.rs` (parser/pagination/error strictness)
  - `browser_runner.rs` + `profile/manager.rs` + `lib.rs` (runtime/status)

## 6) Test Plan
### 6.1 Lock contention multi-machine
- Case A: same profile launched concurrently by 2 members.
  - Expect: first acquires, second denied by server lock.
- Case B: stale local lock cache with expired lease.
  - Expect: stale lock ignored/evicted; backend tries acquire with server truth.
- Case C: launch failure after lock acquired.
  - Expect: lock released automatically.

### 6.2 Open/close sync no missing event
- Launch synced profile -> scheduler marks running + queued outbox entry.
- Kill profile -> scheduler marks stopped + immediate sync trigger.
- Crash app during pending sync -> restart -> outbox replay continues.

### 6.3 Crash/restart no ghost lock
- With lock held, simulate process crash then restart app.
- Heartbeat/refresh path + stale lease logic should clear stale local lock; subsequent launch can reacquire.

## 7) Added/Updated Unit Tests
- `src-tauri/src/team_lock.rs`
  - stale by explicit `expiresAt`
  - stale by `lockedAt + lease`
  - recent lock not stale
- `src-tauri/src/sync/subscription.rs`
  - parse profile id from manifest/metadata/files keys
  - backward-compat tar.gz key
  - strip team prefix normalization
- `src-tauri/src/sync/scheduler.rs`
  - retry backoff growth + cap
  - scheduler timestamp monotonic sanity

## 8) Benchmark Evidence
> Benchmarks are measured with synthetic scripts that model the exact hot-path behaviors addressed.

### 8.1 Save hot path (ms/op)
| Profiles | Before (save + full rebuild) | After (save only) | Improvement |
|---:|---:|---:|---:|
| 50 | 0.345 | 0.084 | 4.1x faster |
| 500 | 3.270 | 0.030 | 109.0x faster |
| 2000 | 14.592 | 0.037 | 394.4x faster |
| 5000 (stress) | 35.459 | 0.694 | 51.1x faster |

### 8.2 Status probe average cost per tick (ms/tick)
| Profiles | Before (probe all each tick) | After (active probe + periodic full sweep) | Improvement |
|---:|---:|---:|---:|
| 50 | 0.140 | 0.012 | 11.7x faster |
| 500 | 0.511 | 0.044 | 11.6x faster |
| 2000 | 2.272 | 0.191 | 11.9x faster |
| 5000 (stress) | 5.247 | 0.472 | 11.1x faster |

### 8.3 Scheduler profile selection (Windows FS + JSON metadata, ms per cycle)
Scenario:
- Before: up to 4 in-flight profile tasks, each calls `list_profiles()` then `find()`.
- After: single `list_profiles()` snapshot + map lookup reused by all tasks in cycle.

| Profiles | Before | After | Improvement |
|---:|---:|---:|---:|
| 50 | 30.41 | 7.06 | 4.31x faster |
| 500 | 277.63 | 63.39 | 4.38x faster |
| 2000 | 1133.40 | 251.07 | 4.51x faster |
| 5000 (stress) | 2510.30 | 630.38 | 3.98x faster |

### 8.4 Profile list cache impact (Windows FS + JSON metadata)
Scenario:
- Before: each `list_profiles()` call reads all `metadata.json` from disk.
- After: cold read keeps same cost, warm reads served from in-memory cache.

| Profiles | Before avg/call (disk) | After cold (disk) | After warm avg/call (cache) |
|---:|---:|---:|---:|
| 50 | 6.85 | 5.89 | 0.01 |
| 500 | 61.33 | 58.84 | 0.07 |
| 2000 | 235.05 | 231.68 | 0.16 |
| 5000 (stress) | 584.00 | 585.56 | 0.27 |

### 8.5 Outbox write amplification (simulation)
Scenario:
- Before: every queue/stop event writes outbox immediately.
- After: dirty flag + debounce (250ms) + scheduler tick-assisted flush.

| Events | Duration | Before writes | After writes | Reduction |
|---:|---:|---:|---:|---:|
| 2000 | 1s | 2000 | 4 | 500x |
| 2000 | 10s | 2000 | 40 | 50x |
| 5000 | 1s | 5000 | 4 | 1250x |
| 5000 | 10s | 5000 | 40 | 125x |

### 8.6 Single-profile lookup path (simulation, per call)
Scenario:
- Before: clone whole profile list then `find()` for target profile.
- After: direct map lookup from cache index (`profile_id -> profile`).

| Profiles | Before (ms/call) | After (ms/call) | Improvement |
|---:|---:|---:|---:|
| 50 | 0.003000 | 0.000020 | 134.4x |
| 500 | 0.014000 | 0.000020 | 713.8x |
| 2000 | 0.058000 | 0.000021 | 2728.6x |
| 5000 | 0.136000 | 0.000031 | 4362.8x |

## 9) Current Gaps / Next Verification
- Need multi-machine lock contention test against real sync server environment.
- Need true end-to-end benchmark with real profile datasets (filesystem + process churn + network RTT).
- Need crash/restart scenario automation (hard kill process while lock/sync in-flight) in CI.

## 10) Windows Verification Evidence (2026-03-30)
Commands executed in PowerShell at `E:\bug-login\src-tauri`:
- `cargo check --all-targets` -> passed.
- `cargo test --lib profile::manager::tests:: -- --nocapture` -> 7 passed.
- `cargo test --lib team_lock::tests:: -- --nocapture` -> 3 passed.
- `cargo test --lib sync::scheduler::tests:: -- --nocapture` -> 2 passed.
- `cargo test --lib sync::subscription::tests:: -- --nocapture` -> 3 passed.

Compile issues fixed during this pass:
- `src/sync/engine.rs`: invalid `tokio::spawn(async move -> ...)` syntax.
- `src/browser_runner.rs`: `#[tauri::command]` futures not `Send` due non-`Send` error value held across `await`.
