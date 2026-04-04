# Hướng Dẫn Build Release (NSIS) Cho BugLogin Trên Windows

Tài liệu này hướng dẫn bạn cách biên dịch (build) và đóng gói bản cài đặt `.exe` của ứng dụng BugLogin bằng script `build-buglogin-nsis.cmd` được cung cấp sẵn. NSIS là trình đóng gói bộ cài Windows nhẹ gọn được Tauri hỗ trợ.

---

## 1. Yêu cầu Hệ Thống (Prerequisites)

Để lệnh build NSIS có thể hoạt động thành công, máy tính Windows của bạn **bắt buộc** phải cài đặt các công cụ sau:

1. **Rust & Cargo**: Ngôn ngữ lõi.
   - Cài đặt qua [rustup.rs](https://rustup.rs/).
2. **Node.js & pnpm**: Trình quản lý Frontend.
   - Đảm bảo bạn đã cài `pnpm` (ví dụ: `npm install -g pnpm`).
3. **Microsoft Visual Studio 2022 C++ Build Tools**: Bộ công cụ biên dịch thiết yếu mà Rust/Tauri cần trên Windows.
   - Tải [Build Tools for Visual Studio 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
   - Phải tick chọn mục **"Desktop development with C++"** khi cài đặt.

---

## 2. Cách Chạy Lệnh Build Bằng Script

Script `scripts\build-buglogin-nsis.cmd` sẽ tự động thiết lập biến môi trường Linker C++ phù hợp và tiến hành build tauri theo chuẩn `nsis`.

Để tiến hành build toàn bộ dự án:

1. Mở terminal (PowerShell / Command Prompt)
2. Di chuyển vào thư mục gốc của dự án BugLogin (`f:\Herd\bug-login`).
3. Đảm bảo bạn đã tải đủ các node package bằng lệnh:
   ```cmd
   pnpm install
   ```
4. Chạy script để tự động build phiên bản Release NSIS (`.exe`):
   ```cmd
   cmd /c scripts\build-buglogin-nsis.cmd
   ```

---

## 3. Quá Trình Build Hoạt Động Như Thế Nào

Dưới đây là các bước công khai trong mã lệnh của file `.cmd`:

- Lệnh tải các công cụ biến của Visual Studio vào cmd môi trường: `call "%ProgramFiles(x86)%\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"`
- Nó dò tìm đường dẫn của trình liên kết `link.exe` của C++.
- Sau khi ghim biến môi trường `CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER`, nó thực thi lệnh build cuối cùng: `pnpm tauri build --bundles nsis`.

---

## 4. Tại Sao Lại Gọi Lệnh Này Thay Vì `pnpm tauri build` Thuần Túy?

Trên một số máy Windows, Rust gặp khó khăn trong việc tự động tìm thấy C++ Linker, gây lỗi `link.exe not found`.
Chạy Script này là **để gỡ và sửa chữa dứt điểm lỗi đấy**, buộc compiler sử dụng trình liên kết (`linker`) chuẩn xác nhất từ hệ sinh thái Visual Studio.

---

## 5. File Thành Phẩm Ở Đâu?

Sau khi script chạy xong tốn một vài phút compile bằng Rust, tìm file cài đặt cuối cùng (thường là `BugLogin_xxx_x64_setup.exe`) trong đường dẫn:
```text
src-tauri\target\release\bundle\nsis\
```

---

## 6. Lỗi Thường Gặp (Troubleshooting)

- **Lỗi `vcvars64.bat not found`**: Máy của bạn đang bị cài đặt sai thư mục đường dẫn của Visual Studio C++ Build Tools, hoặc cài thiếu. Hãy check lại path trong `%ProgramFiles(x86)%\...`.
- **Lỗi thiếu file binary proxy/daemon**: Dự án có cơ chế tải binary proxy trong file `package.json`. Hãy chạy `pnpm run prebuild` bằng tay 1 lần để chắc chắn các tệp phụ trợ (binaries) đã được sao chép vào `src-tauri/binaries/`.
