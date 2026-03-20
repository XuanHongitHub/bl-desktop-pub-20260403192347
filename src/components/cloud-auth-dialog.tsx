"use client";

import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCloudAuth } from "@/hooks/use-cloud-auth";
import { extractRootError } from "@/lib/error-utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";
import { LoadingButton } from "./loading-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

interface CloudAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledInviteToken?: string | null;
}

interface SyncSettings {
  sync_server_url?: string;
  sync_token?: string;
}

type AuthStep = "request" | "verify";

function normalizeBaseUrl(url?: string | null): string | null {
  if (!url) {
    return null;
  }
  const trimmed = url.trim().replace(/\/$/, "");
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function CloudAuthDialog({
  isOpen,
  onClose,
  prefilledInviteToken = null,
}: CloudAuthDialogProps) {
  const { t } = useTranslation();
  const { requestOtp, verifyOtp } = useCloudAuth();
  const [step, setStep] = useState<AuthStep>("request");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep("request");
      setEmail("");
      setOtpCode("");
      setInviteToken("");
      setIsRequestingOtp(false);
      setIsVerifyingOtp(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !prefilledInviteToken) {
      return;
    }
    setInviteToken(prefilledInviteToken);
    setStep("verify");
  }, [isOpen, prefilledInviteToken]);

  const isBusy = isRequestingOtp || isVerifyingOtp;

  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);

  const handleRequestOtp = async () => {
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      showErrorToast(t("authDialog.invalidEmail"));
      return;
    }

    try {
      setIsRequestingOtp(true);
      await requestOtp(normalizedEmail);
      setStep("verify");
      showSuccessToast(t("authDialog.otpRequested"));
    } catch (error) {
      showErrorToast(t("authDialog.otpRequestFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const acceptInviteIfProvided = async (
    userId: string,
    verifiedEmail: string,
    platformRole?: string,
  ) => {
    const token = inviteToken.trim();
    if (!token) {
      return;
    }

    try {
      const settings = await invoke<SyncSettings>("get_sync_settings");
      const baseUrl = normalizeBaseUrl(settings.sync_server_url);
      if (!baseUrl) {
        showErrorToast(t("authDialog.inviteServerMissing"));
        return;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "x-user-id": userId,
        "x-user-email": verifiedEmail,
      };
      if (platformRole) {
        headers["x-platform-role"] = platformRole;
      }
      if (settings.sync_token?.trim()) {
        headers.Authorization = `Bearer ${settings.sync_token.trim()}`;
      }

      const response = await fetch(`${baseUrl}/v1/control/auth/invite/accept`, {
        method: "POST",
        headers,
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`invite_accept_${response.status}:${body}`);
      }

      showSuccessToast(t("authDialog.inviteAccepted"));
    } catch (error) {
      showErrorToast(t("authDialog.inviteAcceptFailed"), {
        description: extractRootError(error),
      });
    }
  };

  const handleVerifyOtp = async () => {
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      showErrorToast(t("authDialog.invalidEmail"));
      return;
    }
    if (!otpCode.trim()) {
      showErrorToast(t("authDialog.invalidOtp"));
      return;
    }

    try {
      setIsVerifyingOtp(true);
      const authState = await verifyOtp(normalizedEmail, otpCode.trim());
      await acceptInviteIfProvided(
        authState.user.id,
        authState.user.email,
        authState.user.platformRole,
      );
      showSuccessToast(t("authDialog.loginSuccess"));
      onClose();
    } catch (error) {
      showErrorToast(t("authDialog.otpVerifyFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("authDialog.title")}</DialogTitle>
          <DialogDescription>{t("authDialog.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-border bg-muted px-3 py-2">
            <p className="text-xs font-medium text-foreground">
              {t("authDialog.googlePendingTitle")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("authDialog.googlePendingDescription")}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cloud-auth-email">{t("authDialog.emailLabel")}</Label>
            <Input
              id="cloud-auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("authDialog.emailPlaceholder")}
              disabled={isBusy || step === "verify"}
            />
          </div>

          {step === "verify" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="cloud-auth-otp">{t("authDialog.otpLabel")}</Label>
                <Input
                  id="cloud-auth-otp"
                  value={otpCode}
                  onChange={(event) => setOtpCode(event.target.value)}
                  placeholder={t("authDialog.otpPlaceholder")}
                  disabled={isBusy}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cloud-auth-invite-token">
                  {t("authDialog.inviteTokenLabel")}
                </Label>
                <Input
                  id="cloud-auth-invite-token"
                  value={inviteToken}
                  onChange={(event) => setInviteToken(event.target.value)}
                  placeholder={t("authDialog.inviteTokenPlaceholder")}
                  disabled={isBusy}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex flex-wrap justify-between gap-2">
          {step === "verify" ? (
            <div className="flex gap-2">
              <LoadingButton
                type="button"
                variant="outline"
                onClick={() => setStep("request")}
                disabled={isBusy}
              >
                {t("authDialog.back")}
              </LoadingButton>
              <LoadingButton
                type="button"
                variant="outline"
                onClick={handleRequestOtp}
                isLoading={isRequestingOtp}
                disabled={isBusy}
              >
                {t("authDialog.resendOtp")}
              </LoadingButton>
            </div>
          ) : (
            <div />
          )}
          {step === "request" ? (
            <LoadingButton
              type="button"
              onClick={handleRequestOtp}
              isLoading={isRequestingOtp}
              disabled={isBusy}
            >
              {t("authDialog.sendOtp")}
            </LoadingButton>
          ) : (
            <LoadingButton
              type="button"
              onClick={handleVerifyOtp}
              isLoading={isVerifyingOtp}
              disabled={isBusy}
            >
              {t("authDialog.verifyOtp")}
            </LoadingButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
