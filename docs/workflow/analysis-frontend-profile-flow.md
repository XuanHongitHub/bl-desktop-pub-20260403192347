# Frontend Profile Flow Analysis (Phase A Baseline)

Date: 2026-03-29  
Scope: Desktop profiles flow + new Phase A baseline routes (`/app-baseline`, `/web-baseline`, `/app-baseline-benchmark`)

## 1) Deep Analysis: Current Frontend Bottlenecks

### A. Monolithic screen composition in desktop view
- Current desktop entrypoint is very large: [`src/app/(desktop)/desktop/page.tsx`](/mnt/e/bug-login/src/app/(desktop)/desktop/page.tsx) (~4.4k LOC).
- A high number of state domains (profiles, groups, proxies, permissions, auth, workspace switching, dialogs) are all held in one client component.
- Result: profile updates can trigger broad render pressure beyond the profiles workspace.

### B. Large table component still carries high render surface area
- Profiles table is also large: [`src/components/profile-data-table.tsx`](/mnt/e/bug-login/src/components/profile-data-table.tsx) (~3.6k LOC).
- Although row virtualization exists, each row contains many interactive cells/popovers/tooltips/actions, so per-row render cost remains high.
- Table meta object includes many dependencies and references profile arrays heavily, increasing recalculation churn.

### C. Full-list filter/sort runs on every relevant state change
- In desktop page, filtered data is recomputed by filtering then sorting full profile collections each time dependencies change at [`src/app/(desktop)/desktop/page.tsx:3593`](/mnt/e/bug-login/src/app/(desktop)/desktop/page.tsx:3593).
- Pattern: `filter -> filter(group) -> filter(search) -> sort`.
- At 2000+ rows this becomes expensive and couples UI responsiveness to list-size.

### D. Event path still causes periodic full refresh
- In profile events hook, `profiles-changed` schedules full refresh and invalidates caches at [`src/hooks/use-profile-events.ts:183`](/mnt/e/bug-login/src/hooks/use-profile-events.ts:183).
- This is correct for consistency, but expensive under burst events; even with debounce, large snapshots are reloaded.

### E. Rendering and state concerns are mixed in many places
- Data loading, selection state, action orchestration, and presentational logic are mixed in large component files.
- This lowers isolation and complicates targeted memoization/selectors.

### F. Missing performance lab in main product flow
- Before this task, there was no dedicated benchmark route that consistently measures render latency, interaction delay, FPS, CPU busy, memory for 50/500/2000/5000 datasets.
- Without a stable perf lab, “faster/slower” claims are hard to verify.

## 2) Flow Comparison Table

| Flow | Tốt | Chưa Tốt | Có thể sửa | Sửa triệt để |
|---|---|---|---|---|
| Data updates from backend events | Có hook riêng `useProfileEvents`, đã có incremental replace theo `profile-updated` | Vẫn có nhánh full refresh khi `profiles-changed` burst | Tăng debounce strategy + split invalidation per entity scope | Chuyển sang normalized client store + event reducer by entity type |
| Profiles rendering | Đã có virtualization trong bảng cũ | Row surface nặng, full filter/sort ở parent; cost tăng theo N | Tách selectors theo concern, tránh sort/filter toàn cục lặp lại | Thiết kế workspace data-grid mới tối ưu virtualization + cell isolation |
| State architecture | Có phân lớp hook/domain | Màn desktop vẫn monolith lớn | Tách workspace slices + memoized selectors | Re-architecture theo bounded contexts (profiles/proxies/sync/workspace) |
| Benchmarking | Đã có benchmark lab trong PHASE A | Chưa có budget gate trong CI, chưa có trend tracking | Lưu benchmark artifact theo lần chạy | Thiết lập perf budget gating trước merge |

## 3) Refactor Priority Plan (Impact-first)

### P0 (Ngay)
1. Chốt baseline routes độc lập để duyệt UI foundation trước khi custom business layout.
2. Giữ benchmark lab cố định để có số liệu trước/sau cho từng phase.
3. Áp dụng selector-based filtering cho list workspace mới, tránh full-array replace liên tục.

### P1 (Ngay sau khi có “GO CODE”)
1. Rebuild Profiles Workspace UI/UX hoàn toàn trên baseline đã duyệt.
2. Tối ưu event-driven state cho Running/Lock/Sync realtime bằng incremental patch theo id.
3. Tách render surface: list shell, row primitive, action overlays, side panels.

### P2 (Hardening)
1. Budget hóa chỉ số perf (render latency, interaction delay, fps, cpu busy).
2. Tạo replay scenarios 50/500/2000/5000 trong CI/nightly.
3. Đưa regression perf vào checklist release.

## 4) Phase A Baseline Evidence

### Routes
- App baseline: `/app-baseline`
- App benchmark lab: `/app-baseline-benchmark`
- Web baseline: `/web-baseline`

### Screenshot artifacts
- [`phase-a-app-baseline.png`](/mnt/e/bug-login/docs/workflow/references/frontend-phase-a/phase-a-app-baseline.png)
- [`phase-a-web-baseline.png`](/mnt/e/bug-login/docs/workflow/references/frontend-phase-a/phase-a-web-baseline.png)
- [`phase-a-benchmark-results.png`](/mnt/e/bug-login/docs/workflow/references/frontend-phase-a/phase-a-benchmark-results.png)

### Benchmark raw data
- [`phase-a-benchmark-results.json`](/mnt/e/bug-login/docs/workflow/references/frontend-phase-a/phase-a-benchmark-results.json)

## 5) Benchmark Results (Before vs After)

Definition:
- Before = legacy strategy (full-array replace + full list render path in benchmark lab).
- After = optimized strategy (incremental patch + virtualized windowing path in benchmark lab).
- Environment: Windows runtime, Next dev server, Playwright Chromium headless.

| Dataset | Mode | Render Latency (ms) | Interaction Delay (ms) | Scroll FPS (avg/min) | CPU Busy % | RAM MB |
|---|---:|---:|---:|---:|---:|---:|
| 50 | Before | 59.9 | 50.1 | 59.55 / 30.03 | 0.00 | 202.18 |
| 50 | After | 111.0 | 40.1 | 60.45 / 59.52 | 2.60 | 202.18 |
| 500 | Before | 432.1 | 48.7 | 60.45 / 59.52 | 17.79 | 202.18 |
| 500 | After | 511.7 | 48.6 | 60.46 / 59.52 | 17.26 | 202.18 |
| 2000 | Before | 1082.2 | 148.3 | 39.11 / 14.99 | 34.23 | 202.18 |
| 2000 | After | 1339.8 | 178.6 | 45.57 / 29.94 | 39.66 | 202.18 |
| 5000 | Before | 2274.1 | 342.6 | 12.26 / 8.57 | 98.42 | 202.18 |
| 5000 | After | 2884.5 | 444.4 | 11.56 / 6.00 | 94.31 | 202.18 |

### Assessment
- PHASE A baseline scaffold is complete and reviewable.
- Perf harness is now available and produces repeatable numbers.
- Target “2000+ profiles without lag” is **not concluded as achieved** at this stage; metrics show that deeper optimization is required in PHASE B.
