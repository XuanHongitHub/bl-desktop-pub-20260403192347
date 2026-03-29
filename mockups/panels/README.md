# BugLogin Panel HTML Review

Đây là bộ HTML review để chốt kiến trúc và trải nghiệm panel trước khi code chính thức vào app.

## 2 panel trong phạm vi này
- `super-admin/`: panel cho quản trị platform-level.
- `workspace-owner/`: panel cho quản trị workspace-level (chỉ workspace hiện tại).

## Nguyên tắc scope
- Không đưa `BugIdea Automation` vào 2 panel này.
- Super Admin panel: chức năng cấp platform.
- Workspace Owner panel: chức năng cấp workspace hiện tại, không chạm workspace khác.

## Hai lớp HTML
- `index.html`: IA tree đầy đủ page + capability/data/API/checklist.
- `panel.html`: mô phỏng panel UI/UX dạng compact (KPI, table, timeline, state, patterns).

## Mỗi page trong tree đều có
- Chức năng chính
- Nội dung cần có trên page
- Data contracts
- API/service contracts
- Guardrails
- KPI/success criteria
- Build checklist theo phase
- Delivery lanes (P0/P1/P2)

## Mở trên Windows
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\open-panel-html-mockups.ps1
```
Mặc định sẽ mở `panel.html` cho cả 2 panel.

Mở bản IA tree (`index.html`):
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\open-panel-html-mockups.ps1 -View ia
```

Hoặc mở qua HTTP local:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\open-panel-html-mockups.ps1 -UseHttpServer
```

HTTP + IA tree:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\open-panel-html-mockups.ps1 -UseHttpServer -View ia
```
