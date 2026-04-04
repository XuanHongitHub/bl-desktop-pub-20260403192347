# Topic 2 - Browser Profile Parity Blueprint (HideMyAcc-first)

Status: Topic 2 locked - Phase 1 baseline completed
Owner: Product + Engineering
Date: 2026-03-18

## 1) Muc tieu Topic 2

- Ship BugLogin o muc on dinh de co the thay the ngay cac app cung nhom (uu tien HideMyAcc, doi chieu them GoLogin).
- Doi tuong: ca solo va team.
- Nen tang release: Windows + macOS + Linux.
- Trong tam: Browser Profile flow va trai nghiem van hanh profile, khong uu tien automation dac thu trong pha nay.
- Rang buoc nghiep vu: truy cap/phan quyen duoc quan ly qua Kmediaz (ghi chu product direction, chua implement trong pha discovery).

## 2) Nguyen tac benchmark

- Rule parity: khong kem HideMyAcc o cac nang luc cot loi; chi chap nhan bang hoac tot hon.
- Rule UX: giam ma sat thao tac, it buoc hon hoac ro hon cho cung mot tac vu.
- Rule stability: khong crash, khong treo profile, khong mat data profile/proxy/group.
- Rule confidence: moi luong chinh phai co loading, empty, error, retry ro rang.

## 3) Competitive scope (so sanh rong)

### 3.1 Product flow end-to-end

- Onboarding lan dau.
- Tao profile nhanh va tao profile nang cao.
- Gan proxy, kiem tra proxy, xu ly proxy loi.
- Start/stop profile, theo doi trang thai runtime.
- Quan ly profile: search/filter/group/tag/sort/pin.
- Clone/import/export profile.
- Quan ly team/workspace/co quyen.
- License/quota/canh bao het han/het quota.

### 3.2 UI/UX flow

- So click de hoan tat 1 tac vu quan trong.
- Muc do ro rang cua thong tin tren 1 man hinh.
- Kha nang thao tac hang loat (bulk).
- Do nhanh khi chuyen context (list <-> detail <-> run).
- Cac state can bat buoc: loading/empty/error/success.

### 3.3 UI/UX logic

- Default values thong minh (timezone, language, webgl, canvas mode, v.v.).
- Validation khong gay kho chiu (bao loi som, huong dan sua).
- Guardrail chong thao tac nguy hiem (xoa, overwrite, stop all).
- Recovery path (undo/retry/open logs).

### 3.4 Nghiep vu va van hanh

- Team model: owner/admin/member/viewer.
- Scope quyen tren profile/group/workspace.
- Audit logs su kien quan trong.
- Data lifecycle: archive/restore/delete hard.
- Dong bo trang thai giua nhieu may (future-ready theo huong Kmediaz).

### 3.5 Chuc nang Browser Profile cot loi

- Create, duplicate, clone from template.
- Group, tag, filter, sort, saved views.
- Import/export cookies/profile metadata.
- Proxy setup (HTTP/SOCKS5, auth, test connectivity).
- Fingerprint preset + custom overrides.
- One-click run + run status telemetry.

## 4) Bang muc tieu parity (HideMyAcc-first)

Phan loai:
- Must match: bat buoc ngang bang HideMyAcc de co the thay the.
- Must better: diem can vuot de tao ly do chuyen doi.
- Later: de sau release parity core.

| Nhom | Must match | Must better | Later |
|---|---|---|---|
| Profile CRUD | Tao/sua/xoa/clone on dinh, khong mat data | Tao profile nhanh hon (it buoc hon) | Wizard nang cao theo use-case |
| Proxy | Gan proxy, test proxy, hien loi ro rang | Batch proxy gan profile + retry thong minh | Auto-rotation policy |
| Run profile | Start/stop on dinh, trang thai chinh xac | Khoi dong nhanh hon va hien health state ro hon | Session timeline detail |
| List management | Search/filter/group/tag day du | Saved filters va quick actions tot hon | Smart recommendations |
| Team access | Quyen co ban cho team | UX cap quyen de hieu, it loi thao tac | Fine-grained policy engine |
| Reliability | Khong crash flow chinh | Recovery ro rang + retry 1 click | He thong canh bao chu dong |

## 5) Release gate: "Co the thay the ngay"

BugLogin duoc xem la thay the ngay khi tat ca gate sau dat:

1. Profile lifecycle gate
- Tao 100 profile lien tiep khong fail logic.
- Clone 100 profile khong sai config goc.
- Start/stop profile lap lai nhieu lan khong treo app.

2. Proxy gate
- Ty le test proxy thanh cong theo dung input > 99% trong bo testcase chuan.
- Loi proxy hien ro nguyen nhan (auth/network/timeout/blocked).
- Tu flow loi co nut retry va fallback huong dan ro.

3. UX gate
- Tac vu "tao + gan proxy + run" khong vuot qua nguong click muc tieu (set trong QA matrix).
- Khong co dead-end screen (man hinh khong co loi thoat/tiep tuc).
- Tat ca async action co loading + disable state + thong bao ket qua.

4. Team gate
- User dung role khong the vuot quyen.
- Owner/Admin cap quyen va thu hoi quyen khong gay loi data.
- Log duoc cac hanh dong chinh (create/update/delete/run).

5. Stability gate
- Khong co crash blocker trong smoke suite da dinh nghia.
- Khong regression o cac flow core qua 3 vong test lien tiep.

## 6) Khoang cach hien tai (da dien - Phase 1)

| ID | Flow/Feature | Competitive baseline expectation | BugLogin hien tai | Gap loai | Muc do | Uu tien |
|---|---|---|---|---|---|---|
| G-01 | Profile quick create | Fast lane tao profile + run trong luong ngan | Co create dialog day du nhung van nhieu buoc tuy ngu canh | UX flow | High | P0 |
| G-02 | Proxy error recovery | Bao loi phan loai ro + retry nhanh | Da co check proxy va message, nhung retry/fallback chua thanh flow chuan | UX logic | High | P0 |
| G-03 | Team role clarity | Role model ro, UI denial reason de hieu | Da co team lock va cloud role fields, nhung RBAC matrix chua lock | Nghiep vu | High | P0 |
| G-04 | Saved views | Luu bo filter/sort cho tac vu lap lai | Da co search/filter/group/tag/sort, chua co saved views | Chuc nang | Medium | P1 |
| G-05 | Cross-platform reliability gate | Co smoke/regression matrix 3 OS | Chua co gate matrix lock trong tai lieu QA | Reliability | High | P0 |
| G-06 | Async state consistency | Tat ca action core co loading/disable/success/error | Da co nhieu loading states, nhung pattern chua dong nhat toan bo flow | UX logic | High | P0 |
| G-07 | Audit trail baseline | Log duoc su kien profile/proxy/run quan trong | Chua lock danh sach audit events bat buoc | Nghiep vu | High | P0 |

## 7) De xuat phan ky de ship thuc dung

Phase A - Parity Core (bat buoc)
- Khoa profile lifecycle + proxy flow + run flow.
- Hoan tat cac gate P0 lien quan thay the ngay.

Phase B - Stability Hardening
- Tang do on dinh tren 3 OS, toi uu recovery va thong diep loi.
- Chot smoke/regression matrix cho release lien tuc.

Phase C - Better-than parity
- Cai tien UX toc do thao tac, bulk actions, saved views.
- Them cac diem "vuot" de tao ly do migration ro net.

## 8) Danh sach benchmark can thu thap tiep

- Time-to-first-profile-run (TTPR).
- Clicks-per-core-task.
- Profile start success rate.
- Proxy validation success/failure classification quality.
- Crash-free sessions.
- Task completion time cho 3 persona: solo operator, team operator, admin.

Tai lieu chi tiet:
- `docs/workflow/references/topic2/competitive-gap-matrix.md`
- `docs/workflow/references/topic2/release-gate-qa-matrix.md`
- `docs/workflow/references/topic2/implementation-backlog.md`

## 9) Quy uoc cho buoc tiep theo

- Tai lieu nay da duoc lock cung OpenSpec/Superpowers/Beads cho Topic 2.
- Phase 1 (baseline + gap lock + gate metrics) da hoan tat.
- Buoc tiep theo: vao implementation planning/exec theo P0 o Phase 2.
