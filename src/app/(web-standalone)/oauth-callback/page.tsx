"use client";

import { ExternalLink } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/icons/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader } from "@/components/ui/page-loader";
import { Spinner } from "@/components/ui/spinner";
import {
  PORTAL_GOOGLE_STORAGE_KEY,
  PORTAL_OAUTH_INTENT_STORAGE_KEY,
} from "@/lib/portal-session";

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

function decodeOAuthState(state: string | null): {
  targetMode: "desktop" | "portal";
  nextPath: string;
  inviteToken: string;
} {
  if (!state) {
    return {
      targetMode: "desktop",
      nextPath: "",
      inviteToken: "",
    };
  }

  try {
    const parsed = JSON.parse(atob(state)) as {
      target?: unknown;
      nextPath?: unknown;
      inviteToken?: unknown;
    };
    return {
      targetMode: parsed.target === "portal" ? "portal" : "desktop",
      nextPath:
        typeof parsed.nextPath === "string" ? parsed.nextPath.trim() : "",
      inviteToken:
        typeof parsed.inviteToken === "string" ? parsed.inviteToken.trim() : "",
    };
  } catch {
    return {
      targetMode: "desktop",
      nextPath: "",
      inviteToken: "",
    };
  }
}

function readPortalOAuthIntent(): {
  targetMode: "portal";
  nextPath: string;
  inviteToken: string;
} | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(PORTAL_OAUTH_INTENT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as {
      targetMode?: unknown;
      nextPath?: unknown;
      inviteToken?: unknown;
      createdAt?: unknown;
    };
    const createdAt =
      typeof parsed.createdAt === "number" ? parsed.createdAt : 0;
    const maxAgeMs = 10 * 60 * 1000;
    if (Date.now() - createdAt > maxAgeMs) {
      window.sessionStorage.removeItem(PORTAL_OAUTH_INTENT_STORAGE_KEY);
      return null;
    }
    if (parsed.targetMode !== "portal") {
      return null;
    }
    return {
      targetMode: "portal",
      nextPath:
        typeof parsed.nextPath === "string" ? parsed.nextPath.trim() : "",
      inviteToken:
        typeof parsed.inviteToken === "string" ? parsed.inviteToken.trim() : "",
    };
  } catch {
    return null;
  }
}

function OAuthCallbackContent() {
  const { t } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [manualTarget, setManualTarget] = useState(
    "buglogin://oauth-callback?error=unknown_error",
  );
  const [phase, setPhase] = useState<"resolving" | "redirecting">("resolving");
  const [mode, setMode] = useState<"desktop" | "portal">("desktop");
  const [isSuccessfulRedirect, setIsSuccessfulRedirect] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    let isCancelled = false;
    const closeTimers: ReturnType<typeof setTimeout>[] = [];

    const finish = (target: string, nextMode: "desktop" | "portal") => {
      if (isCancelled) {
        return;
      }
      setMode(nextMode);
      setManualTarget(target);
      setPhase("redirecting");
      setIsSuccessfulRedirect(
        nextMode === "portal"
          ? !target.includes("oauthError=")
          : target.includes("buglogin://oauth-callback?email="),
      );
      if (nextMode === "portal") {
        router.replace(target);
        return;
      }
      window.location.assign(target);
      if (
        nextMode === "desktop" &&
        target.includes("buglogin://oauth-callback?email=")
      ) {
        closeTimers.push(
          setTimeout(() => {
            window.close();
          }, 1200),
        );
        closeTimers.push(
          setTimeout(() => {
            window.close();
          }, 2600),
        );
      }
    };

    const resolveTargetUrl = (
      nextPath: string,
      inviteToken: string,
      extra: Record<string, string | null | undefined>,
    ) => {
      const url = new URL("/auth", window.location.origin);
      if (nextPath) {
        url.searchParams.set("next", nextPath);
      }
      if (inviteToken) {
        url.searchParams.set("inviteToken", inviteToken);
        url.searchParams.set("view", "invite");
      }
      for (const [key, value] of Object.entries(extra)) {
        if (value) {
          url.searchParams.set(key, value);
        }
      }
      return url.toString();
    };

    const resolveDeepLink = async () => {
      const statePayload = decodeOAuthState(searchParams.get("state"));
      const intentPayload = readPortalOAuthIntent();
      const targetMode =
        searchParams.get("target") === "portal"
          ? "portal"
          : statePayload.targetMode === "portal" || intentPayload
            ? "portal"
            : "desktop";
      const nextPath =
        searchParams.get("next")?.trim() ??
        statePayload.nextPath ??
        intentPayload?.nextPath ??
        "";
      const inviteToken =
        searchParams.get("inviteToken")?.trim() ??
        statePayload.inviteToken ??
        intentPayload?.inviteToken ??
        "";
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const idToken = hashParams.get("id_token");
      const accessToken = hashParams.get("access_token");
      const error = hashParams.get("error") || searchParams.get("error");
      const code = hashParams.get("code") || searchParams.get("code");

      const finishPortalProfile = (payload: {
        email: string;
        name?: string;
        avatar?: string;
        idToken?: string;
      }) => {
        window.sessionStorage.removeItem(PORTAL_OAUTH_INTENT_STORAGE_KEY);
        window.sessionStorage.setItem(
          PORTAL_GOOGLE_STORAGE_KEY,
          JSON.stringify(payload),
        );
        finish(
          resolveTargetUrl(nextPath, inviteToken, {
            oauth: "google",
          }),
          "portal",
        );
      };

      if (idToken) {
        const payload = decodeJwtPayload(idToken);
        const email =
          payload && typeof payload.email === "string" ? payload.email : null;
        const name =
          payload && typeof payload.name === "string" ? payload.name : "";
        const avatar =
          payload && typeof payload.picture === "string" ? payload.picture : "";
        if (!email) {
          if (targetMode === "portal") {
            window.sessionStorage.removeItem(PORTAL_OAUTH_INTENT_STORAGE_KEY);
            finish(
              resolveTargetUrl(nextPath, inviteToken, {
                oauthError: "invalid_token_payload",
              }),
              "portal",
            );
            return;
          }
          finish(
            "buglogin://oauth-callback?error=invalid_token_payload",
            "desktop",
          );
          return;
        }
        if (targetMode === "portal") {
          finishPortalProfile({ email, name, avatar, idToken });
          return;
        }
        finish(
          `buglogin://oauth-callback?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatar)}`,
          "desktop",
        );
        return;
      }

      if (accessToken) {
        if (targetMode === "portal") {
          window.sessionStorage.removeItem(PORTAL_OAUTH_INTENT_STORAGE_KEY);
          finish(
            resolveTargetUrl(nextPath, inviteToken, {
              oauthError: "missing_oauth_tokens",
            }),
            "portal",
          );
          return;
        }
        finish(
          "buglogin://oauth-callback?error=missing_oauth_tokens",
          "desktop",
        );
        return;
      }

      if (error) {
        if (targetMode === "portal") {
          window.sessionStorage.removeItem(PORTAL_OAUTH_INTENT_STORAGE_KEY);
          finish(
            resolveTargetUrl(nextPath, inviteToken, { oauthError: error }),
            "portal",
          );
          return;
        }
        finish(
          `buglogin://oauth-callback?error=${encodeURIComponent(error)}`,
          "desktop",
        );
        return;
      }

      if (code) {
        if (targetMode === "portal") {
          window.sessionStorage.removeItem(PORTAL_OAUTH_INTENT_STORAGE_KEY);
          finish(
            resolveTargetUrl(nextPath, inviteToken, {
              oauthError: "authorization_code_not_supported",
            }),
            "portal",
          );
          return;
        }
        finish(
          "buglogin://oauth-callback?error=authorization_code_not_supported",
          "desktop",
        );
        return;
      }

      if (targetMode === "portal") {
        window.sessionStorage.removeItem(PORTAL_OAUTH_INTENT_STORAGE_KEY);
        finish(
          resolveTargetUrl(nextPath, inviteToken, {
            oauthError: "missing_oauth_tokens",
          }),
          "portal",
        );
        return;
      }
      finish("buglogin://oauth-callback?error=missing_oauth_tokens", "desktop");
    };

    void resolveDeepLink();

    return () => {
      isCancelled = true;
      for (const timer of closeTimers) {
        clearTimeout(timer);
      }
    };
  }, [router, searchParams]);

  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background px-4 text-foreground">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/35 to-card" />
      <div className="absolute inset-0 opacity-35 [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:18px_18px]" />
      <Card className="relative z-10 w-full max-w-[420px] gap-0 border-border/70 shadow-xl">
        <CardContent className="flex flex-col items-center gap-5 px-6 py-8 text-center">
          <Logo alt={t("authLanding.title")} className="h-10 w-auto" />
          <div className="flex flex-col items-center gap-3">
            <Spinner size="lg" className="h-8 w-8 text-primary" />
            <p className="max-w-[24ch] text-sm leading-6 text-muted-foreground">
              {phase === "redirecting" && isSuccessfulRedirect
                ? mode === "portal"
                  ? t("portalSite.auth.oauthReturn")
                  : t("authLanding.oauthCallbackAutoClosing")
                : t("authLanding.oauthCallbackResolving")}
            </p>
          </div>
          <Button asChild variant="outline" className="h-10 w-full font-medium">
            <a href={manualTarget}>
              <ExternalLink className="h-4 w-4" />
              {mode === "portal"
                ? t("portalSite.auth.returnToAuth")
                : t("authLanding.oauthCallbackOpenManually")}
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

export default function OAuthCallbackPage() {
  const { t } = useTranslation();

  return (
    <Suspense fallback={<PageLoader mode="fullscreen" />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
