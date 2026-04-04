# TikTok Seller Signup Reference Dataset (Cleaned)

Nguồn dữ liệu gốc: `D:\Download\TIKTOK_REG_SELLER`

Mục tiêu:
- Chuẩn hóa tên file HTML để dễ dùng trong automation/docs.
- Giữ nguyên nội dung snapshot gốc (không chỉnh sửa DOM).
- Tách rõ dữ liệu tham chiếu TikTok Seller Signup cho BugLogin.

Cấu trúc:
- `raw/`: HTML đã đổi tên sạch + thư mục `_files` assets tương ứng.
- `descriptions/`: mô tả mục đích từng HTML.
- `manifest.json`: metadata (size/hash/title/original filename).
- `catalog.md`: bảng tra nhanh từ file gốc -> file sạch.

Ghi chú:
- Các file `*_files` là tài nguyên phụ của snapshot browser (css/js/img).
- Bộ dữ liệu này là tài liệu tham chiếu cho `Sign Up TikTok Seller`, không phải source code runtime.
