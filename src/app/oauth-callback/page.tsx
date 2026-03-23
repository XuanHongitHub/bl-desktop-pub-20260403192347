"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const [manualDeepLink, setManualDeepLink] = useState<string>(
    "buglogin://oauth-callback?error=unknown_error",
  );

  useEffect(() => {
    // Chỉ chạy ở phía Client
    if (typeof window === "undefined") return;

    // Google Implicit Flow trả về token trong URL Hash thay vì query string
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);

    const idToken = hashParams.get("id_token");
    const error = hashParams.get("error") || searchParams.get("error");

    let deepLinkTarget = "buglogin://oauth-callback?error=unknown_error";

    if (idToken) {
      try {
        // Parse JWT payload (phần thứ 2 của token)
        const payloadBase64 = idToken.split(".")[1];
        const base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split("")
            .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
            .join(""),
        );
        const user = JSON.parse(jsonPayload);

        const email = encodeURIComponent(user.email || "");
        const name = encodeURIComponent(user.name || "");
        const avatar = encodeURIComponent(user.picture || "");

        // Chuyển hướng kèm theo dữ liệu user
        deepLinkTarget = `buglogin://oauth-callback?email=${email}&name=${name}&avatar=${avatar}`;
      } catch (_err) {
        deepLinkTarget = "buglogin://oauth-callback?error=invalid_token";
      }
    } else if (error) {
      deepLinkTarget = `buglogin://oauth-callback?error=${encodeURIComponent(error)}`;
    } else {
      // Dự phòng nếu không có gì
      deepLinkTarget = "buglogin://oauth-callback?error=unknown_error";
    }
    setManualDeepLink(deepLinkTarget);
    window.location.assign(deepLinkTarget);

    // Tuỳ chọn: Tự động đóng tab trình duyệt sau vài giây (trình duyệt có thể chặn nếu user ko tương tác)
    const timer = setTimeout(() => {
      window.close();
    }, 3000);

    return () => clearTimeout(timer);
  }, [searchParams]);

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full bg-[#FAFAFA] dark:bg-[#0A0A0A] font-sans">
      <div className="flex flex-col items-center p-8 bg-white dark:bg-[#111] rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-800">
        <svg
          className="animate-spin h-8 w-8 text-blue-500 mb-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">
          Đang xác thực tài khoản
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-xs">
          Trình duyệt sẽ tự động quay trở lại ứng dụng BugLogin. Nếu không thấy
          gì xảy ra, hãy kiểm tra thông báo xuất hiện phía trên.
        </p>
        <a
          href={manualDeepLink}
          className="mt-4 inline-flex items-center justify-center rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          Mở BugLogin thủ công
        </a>
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center text-sm text-neutral-500">
          Đang khởi tạo...
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
