"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function decodeJwtPayload(idToken: string): Record<string, unknown> | null {
  try {
    const payloadBase64 = idToken.split(".")[1];
    if (!payloadBase64) {
      return null;
    }
    const base64 = payloadBase64.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(""),
    );
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function fetchGoogleProfile(
  accessToken: string,
): Promise<{ email: string; name?: string; picture?: string } | null> {
  try {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) {
      return null;
    }
    const payload = (await response.json()) as {
      email?: unknown;
      name?: unknown;
      picture?: unknown;
    };
    if (typeof payload.email !== "string" || payload.email.length === 0) {
      return null;
    }
    return {
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : undefined,
      picture: typeof payload.picture === "string" ? payload.picture : undefined,
    };
  } catch {
    return null;
  }
}

function OAuthCallbackContent() {
  const searchParams = useSearchParams();
  const [manualDeepLink, setManualDeepLink] = useState<string>(
    "buglogin://oauth-callback?error=unknown_error",
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let isCancelled = false;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;

    const finish = (target: string) => {
      if (isCancelled) {
        return;
      }
      setManualDeepLink(target);
      window.location.assign(target);
      closeTimer = setTimeout(() => {
        window.close();
      }, 3000);
    };

    const resolveDeepLink = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const idToken = hashParams.get("id_token");
      const accessToken = hashParams.get("access_token");
      const error = hashParams.get("error") || searchParams.get("error");
      const code = hashParams.get("code") || searchParams.get("code");

      if (idToken) {
        const payload = decodeJwtPayload(idToken);
        const email =
          payload && typeof payload.email === "string" ? payload.email : null;
        if (!email) {
          finish("buglogin://oauth-callback?error=invalid_token_payload");
          return;
        }
        const name =
          payload && typeof payload.name === "string" ? payload.name : "";
        const avatar =
          payload && typeof payload.picture === "string" ? payload.picture : "";
        finish(
          `buglogin://oauth-callback?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}`,
        );
        return;
      }

      if (accessToken) {
        const profile = await fetchGoogleProfile(accessToken);
        if (!profile) {
          finish("buglogin://oauth-callback?error=google_userinfo_unreachable");
          return;
        }
        finish(
          `buglogin://oauth-callback?email=${encodeURIComponent(profile.email)}&name=${encodeURIComponent(profile.name ?? "")}&avatar=${encodeURIComponent(profile.picture ?? "")}`,
        );
        return;
      }

      if (error) {
        finish(`buglogin://oauth-callback?error=${encodeURIComponent(error)}`);
        return;
      }

      if (code) {
        finish("buglogin://oauth-callback?error=authorization_code_not_supported");
        return;
      }

      finish("buglogin://oauth-callback?error=missing_oauth_tokens");
    };

    void resolveDeepLink();

    return () => {
      isCancelled = true;
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
    };
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
