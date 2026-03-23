# Production Readiness Checklist - Quyền & Pro Gating (2026-03-23)

## 1) Snapshot hiện trạng (code-level)
- `142` điểm `console.error(...)` trong `src/`.
- `69` điểm `await invoke(...)` trong `src/`.
- `66` điểm dùng `toast.error/success` trực tiếp (không qua `showErrorToast/showSuccessToast`).
- `22` điểm `showErrorToast/showSuccessToast` còn hardcoded string literal (chưa i18n đầy đủ).

## 2) Findings quan trọng (ưu tiên xử lý)

### P0 - Blocker production

1. UI mở khóa Pro bằng cờ hardcoded, không theo entitlement thật
- Evidence: `src/app/page.tsx:261` (`const crossOsUnlocked = true;`).
- Ảnh hưởng: các action Pro (extension/cookie/cross-OS) được mở trên UI nhưng backend từ chối.

2. Backend cloud auth command đang stub, subscription luôn không active
- Evidence: `src-tauri/src/cloud_auth.rs:1006-1008` (`cloud_get_user -> Ok(None)`), `:1031-1033` (`cloud_has_active_subscription -> Ok(false)`).
- Ảnh hưởng: logic `has_active_paid_subscription()` gần như luôn false trong runtime hiện tại, gây lỗi kiểu `requires an active Pro subscription`.

3. Frontend auth local không đồng bộ trạng thái paid vào backend
- Evidence: `src/hooks/use-cloud-auth.ts:355-411` (`loginWithEmail` local-only), `:415-440` (fallback local state).
- Ảnh hưởng: frontend có thể hiển thị user plan paid, nhưng backend vẫn coi chưa có entitlement paid.

4. Extension group assignment xử lý lỗi theo hướng “runtime error” thay vì “feature locked state”
- Evidence: `src/components/extension-group-assignment-dialog.tsx:50-63`, `:81-86`.
- Ảnh hưởng: user gặp lỗi kỹ thuật thay vì trạng thái khóa tính năng rõ ràng.

### P1 - High

5. Sync encryption gating đang hardcoded, không phản ánh quyền thật
- Evidence: `src/components/profile-sync-dialog.tsx:38-39` (`isCloudSyncEligible = false`, `canUseEncryption = true`), `src/components/settings-dialog.tsx:245` (`canUseEncryption = true`).
- Ảnh hưởng: copy UX và enforcement lệch nhau, khó dự đoán hành vi.

6. Runtime access fallback theo hướng permissive
- Evidence: `src/hooks/use-runtime-access.ts:32-36` set `entitlement=null`, `runtimeConfig=null` khi lỗi command.
- Ảnh hưởng: khi command lỗi, app có thể “mở” hành vi thay vì fail-closed.

7. Pro-limiting dùng cờ `crossOsUnlocked` cho nhiều domain chức năng khác nhau
- Evidence: extension/cookie/cross-OS cùng dựa vào `crossOsUnlocked` tại:
  - `src/components/profile-data-table.tsx:3057-3097`
  - `src/components/profiles-workspace-chrome.tsx:200-210`
  - `src/components/camoufox-config-dialog.tsx:165-177`
- Ảnh hưởng: semantic lệch, dễ tạo bug mở/khóa sai tính năng.

### P2 - Medium

8. Chuẩn UX/i18n/toast chưa đồng nhất
- Evidence:
  - Dùng `toast.*` trực tiếp nhiều nơi: `src/components/cookie-copy-dialog.tsx`, `src/components/delete-group-dialog.tsx`, `src/components/camoufox-config-dialog.tsx`, ...
  - Hardcoded copy operational strings trong toasts/dialogs.
- Ảnh hưởng: khó maintain, đa ngôn ngữ thiếu nhất quán, khó chuẩn hóa thông điệp lỗi.

## 3) Checklist production (thực thi)

## A. Nguồn quyền thống nhất (single source of truth)
- [ ] Tạo command backend trả `FeatureAccessSnapshot` (ví dụ: `pro_extensions`, `pro_cookies`, `pro_cross_os`, `sync_encryption`, `read_only`).
- [ ] Frontend chỉ dựa trên snapshot này để enable/disable UI (không hardcode `true/false`).
- [ ] Xóa/đổi tên `crossOsUnlocked` thành flags theo từng domain chức năng.

## B. Fail-closed + UX rõ ràng cho Pro lock
- [ ] Trước khi mở dialog/action Pro, pre-check quyền và hiển thị trạng thái lock (badge + CTA nâng cấp), không đợi backend throw.
- [ ] Map lỗi backend dạng `requires an active Pro subscription` sang key i18n chuẩn (`t("pro.*")`) thay vì show raw error.
- [ ] Không log `console.error` cho lỗi business-expected (feature locked), chỉ telemetry/debug level phù hợp.

## C. Backend enforcement
- [ ] Giữ backend guard cho các command Pro hiện có (extensions/cookies/fingerprint).
- [ ] Bổ sung guard read-only ở backend cho các mutate command quan trọng (không chỉ UI gate).
- [ ] Rà `set_entitlement_state` để đảm bảo chỉ context admin hợp lệ được phép đổi state trong production mode.

## D. Chuẩn hóa i18n + toast
- [ ] Thay `toast.error/success` trực tiếp bằng `showErrorToast/showSuccessToast` ở các dialog chính.
- [ ] Loại hardcoded strings trong toasts/dialogs (EN/VI sync đầy đủ).
- [ ] Chuẩn hóa thông điệp lỗi kỹ thuật vs thông điệp hành động cho user.

## E. Test matrix bắt buộc trước release
- [ ] Matrix quyền: `viewer/member/admin/owner/platform_admin` x `active/grace/read_only`.
- [ ] Matrix plan: `free` vs `paid` cho các feature Pro (extension, cookie, fingerprint/cross-OS, sync encryption).
- [ ] E2E: đảm bảo UI lock khớp backend deny (không còn trường hợp UI cho click nhưng backend chặn bất ngờ).

## 4) Quick wins (1-2 ngày)
- [ ] Bỏ hardcoded `crossOsUnlocked = true`.
- [ ] Đổi `ExtensionGroupAssignmentDialog` sang luồng “feature locked” + i18n/toast-utils.
- [ ] Đồng bộ `canUseEncryption` từ quyền thực, bỏ hardcoded.
- [ ] Giảm `console.error` ở các luồng lỗi business-expected.

## 5) Definition of Done cho nhánh hardening này
- [ ] Không còn lỗi runtime kiểu `Extension management requires an active Pro subscription` hoặc `Fingerprint OS spoofing requires an active Pro subscription` xuất hiện trong các luồng UI đã lock đúng.
- [ ] 100% entry points Pro có pre-check quyền trước khi gọi mutate command.
- [ ] Không còn hardcoded boolean entitlement trong UI.
