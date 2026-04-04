# Hướng Dẫn Setup "Xưởng Đúc App" (Local Build Farm) Trên 1 Máy Windows

Tài liệu này hướng dẫn cách thiết lập máy tính Windows của bạn thành một trung tâm CI/CD (Build Farm) cá nhân để build ứng dụng Tauri (BugLogin) ra 3 hệ điều hành: Windows, Linux, macOS.

## 🌟 Chìa khóa của hệ thống (Unlimited & Tiết kiệm)
Vì bạn chỉ có máy Windows, phương án duy nhất và tối ưu nhất để "lách" giới hạn hệ sinh thái là chia chiếc máy tính của bạn thành 3 môi trường ảo và thật chạy song song:

1. **Windows Host (Máy thật)**: Để build file cài đặt cho Windows (`.exe`, `.msi`).
2. **Linux Subsystem (WSL2)**: Để build file cài đặt cho Linux (`.deb`, `.rpm`, `.AppImage`).
3. **macOS Virtual Machine (VMware)**: Để mượn hệ sinh thái của Apple build ra file đĩa cho Mac (`.dmg`, `.app`).

---

## 💻 Yêu cầu phần cứng
- RAM: Tối thiểu **16GB** (Khuyến nghị 32GB vì macOS VM ăn khoảng 8-12GB, Windows + Chrome ngốn khoảng 8GB, WSL2 ăn khoảng 4GB).
- Ổ cứng: Trống ít nhất **100GB** (Môi trường Windows: 20GB, WSL2: 20GB, macOS VM: 60GB).
- CPU: Intel Core i5/Ryzen 5 gen đời mới trở lên. Đã bật Ảo hóa (Virtualization - VT-x/AMD-V) trong BIOS.

---

## 🛠️ Bước 1: Môi trường Windows (Native)
Đây là môi trường chính bạn đang code hàng ngày, hãy đảm bảo mọi thứ đã sẵn sàng.
1. **Toolchain cơ bản**:
   - Node.js (cài qua `nvm-windows` hoặc tải trực tiếp bản ổn định LTS).
   - `pnpm` (`corepack enable` hoặc tải qua npm).
   - Rust toolchain (`rustup-init.exe` từ trang chủ rust-lang.org). Bắt buộc phải có **C++ Build Tools** đi kèm Visual Studio.
2. Lệnh để chạy build test:
   ```powershell
   cd e:\bug-login
   pnpm install
   pnpm tauri build --target x86_64-pc-windows-msvc
   ```

---

## 🐧 Bước 2: Môi trường Linux (WSL2)
1. **Bật WSL2 trên Windows**:
   Mở PowerShell (Quyền Admin) và gõ lệnh:
   ```powershell
   wsl --install -d Ubuntu-22.04
   ```
   Khởi động lại máy nếu được yêu cầu.

2. **Cài đặt trong WSL2**:
   Mở Terminal Ubuntu lên và chạy (bạn chỉ làm 1 lần duy nhất):
   ```bash
   # Cập nhật Ubuntu
   sudo apt update && sudo apt upgrade -y
   
   # Cài dependencies cho Tauri Linux (Giống y hệt build-macos-linux-x64.yml)
   sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev pkg-config xdg-utils nodejs
   
   # Cài Node.js, pnpm, Rust
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   sudo corepack enable
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

3. **Clone source code (Quan trọng)**:
   Để WSL build nhanh nhất, bản source code của Linux phải nằm trong đường dẫn của Linux (VD: `~/bug-login`), **đừng clone vào ổ C/D của Windows** vì đọc/ghi xuyên rào OS rất chậm.

---

## 🍎 Bước 3: Môi trường macOS (VMware)
Cửa hẹp nhất là đây, nhưng chúng ta sẽ qua khe nứt này bằng Ảo hóa hoàn toàn.

1. **Cài đặt VMware Workstation Player 17** (Hàng chuẩn miễn phí cho cá nhân).
2. **Unlock macOS cho VMware**: 
   - Windows mặc định không cho VMware nhận diện hệ điều hành macOS.
   - Lên GitHub tìm từ khóa `Unlocker for VMware` (Ví dụ: DrDonk/unlocker). Rút file nén, chạy `win-install.cmd` với quyền Admin.
3. **Tải ISO macOS**: Tải file cài đặt macOS Ventura (hoặc Sonoma) dạng `.iso`.
4. **Tạo và Cấu hình máy ảo**:
   - Tạo VM mới -> Chọn hệ điều hành *Apple Mac OS X*.
   - Cho nó ít nhất **8-12GB RAM**, 60GB ổ đĩa, 4-6 Core CPU.
5. **Cài đặt bên trong macOS VM**:
   - Sau khi setup macOS thành công, mở Terminal và gõ:
   ```bash
   # Cài Command Line Tools cho Xcode (chứa clang, c++ compiler để build)
   xcode-select --install
   
   # Cài Homebrew
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   
   # Cài Node, Pnpm, Rust
   brew install node
   corepack enable
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
6. **Code Signing Certificate (Chữ ký điện tử Apple)**:
   Chép các file Certificate của Apple (`.p12`) mà bạn đang dùng ở GitHub Actions vào trong `Keychain Access` của macOS VM.

---

## 🤖 Bước 4: Tự động hóa Pipeline (Automation)
Gõ lệnh build riêng lẻ cả 3 màn hình thì khá "phèn". Có 2 cách để nâng tầm:

### Lựa chọn 1: Viết 1 file PowerShell (Local Orchestrator)
Bạn duy trì 1 thư mục `C:\Release_BugsLogin` chứa source mới nhất. Khi cần build:
- Nó tự chạy `pnpm tauri build` cho Windows.
- Nó kích hoạt SSH sang WSL2 và chạy `pnpm tauri build` cho thẻ Linux.
- Nó kích hoạt SSH sang máy ảo MacOS và chạy tiếp.
- Cuối cùng, script copy tất cả artifact từ WSL2/MacOS về 1 thư mục kết quả `C:\Release_BugsLogin\Out`.

### Lựa chọn 2: Setup Local CI/CD (Biến nhà bạn thành GitHub)
- Tải [Gitea](https://gitea.com) chạy trên localhost:3000 (File exe rất nhẹ).
- Tải phần mềm `act_runner` cài lên cả 3 máy (Windows gốc, WSL2, MacOS VM).
- Sửa lại nội dung file `release.yml` (xoá platform `ubuntu-latest` mà đổi thành tag `self-hosted-windows`, v.v).
👉 Mỗi khi bạn Push code vào Gitea local của mình, **3 con runner ở 3 góc cỗ máy bắt đầu gồng CPU lên chạy y hệt GH Actions** - Đẳng cấp, Không Tốn 1 Xu, và Tốc Độ Cao Kịch Trần phần cứng.
