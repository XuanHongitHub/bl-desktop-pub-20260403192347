# Hybrid Release Runbook (macOS on GHA + Windows/Linux local)

## 1) Mục tiêu
- Giảm quota GitHub Actions: không build 3 nền tảng cùng lúc trên cloud.
- Pipeline chính:
  - GitHub Actions: chỉ build + publish `macOS`.
  - Local Windows: build + upload artifact Windows.
  - Local Linux (WSL): build + upload artifact Linux.

## 2) Quy tắc runtime bắt buộc
- Không dùng chung `node_modules` giữa Windows và WSL/Linux.
- Nên dùng 2 working copy riêng:
  - Windows repo: ví dụ `E:\bug-login`
  - WSL repo: ví dụ `~/bug-login`
- Trước khi build: chạy runtime guard.

## 3) Tạo release tag (kích hoạt macOS build trên GHA)
- Cách 1: push tag `vX.Y.Z` để workflow `release.yml` chạy tự động.
- Cách 2: chạy `workflow_dispatch` với input `release_tag`.

## 4) Build Windows local (PowerShell)
```powershell
cd E:\bug-login
pnpm guard:runtime
pnpm install --frozen-lockfile
pnpm tauri build --target x86_64-pc-windows-msvc
```

Artifact thường nằm ở:
- `src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\`
- `src-tauri\target\x86_64-pc-windows-msvc\release\bundle\msi\`

## 5) Build Linux local (WSL)
```bash
cd ~/bug-login
pnpm guard:runtime
pnpm install --frozen-lockfile
pnpm tauri build --target x86_64-unknown-linux-gnu
```

Artifact thường nằm ở:
- `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/appimage/`
- `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/deb/`
- `src-tauri/target/x86_64-unknown-linux-gnu/release/bundle/rpm/`

## 6) Upload artifact local vào đúng release tag
```bash
gh release upload vX.Y.Z <asset-file> --clobber
gh release upload vX.Y.Z <asset-file>.sig --clobber
```

Lặp lại cho mọi asset Windows/Linux cần phát hành.

## 7) Kiểm tra trước khi public
- Release tag có đủ asset cho nền tảng cần phát hành.
- Với auto-update, đảm bảo upload cả file chữ ký `.sig` tương ứng.
- macOS đã được upload tự động bởi workflow `release.yml`.
