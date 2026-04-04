"use client";

import { useEffect, useState } from "react";
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
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function CloudAuthDialog({ isOpen, onClose }: CloudAuthDialogProps) {
  const { t } = useTranslation();
  const { loginWithEmail, refreshProfile } = useCloudAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setPassword("");
      setIsSigningIn(false);
    }
  }, [isOpen]);

  const handleSignIn = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      showErrorToast(t("authDialog.invalidEmail"));
      return;
    }
    if (!password || password.length < 8) {
      showErrorToast(t("authDialog.passwordTooShort"));
      return;
    }

    try {
      setIsSigningIn(true);
      await loginWithEmail(normalizedEmail, {
        password,
      });
      await refreshProfile().catch(() => null);
      showSuccessToast(t("authDialog.loginSuccess"));
      onClose();
    } catch (error) {
      showErrorToast(t("authDialog.loginFailed"), {
        description: extractRootError(error),
      });
    } finally {
      setIsSigningIn(false);
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
          <div className="space-y-2">
            <Label htmlFor="cloud-auth-email">
              {t("authDialog.emailLabel")}
            </Label>
            <Input
              id="cloud-auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("authDialog.emailPlaceholder")}
              disabled={isSigningIn}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cloud-auth-password">
              {t("proxies.form.password")}
            </Label>
            <Input
              id="cloud-auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isSigningIn}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-wrap justify-between gap-2">
          <LoadingButton
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSigningIn}
            isLoading={false}
          >
            {t("common.buttons.cancel")}
          </LoadingButton>
          <LoadingButton
            type="button"
            onClick={handleSignIn}
            isLoading={isSigningIn}
            disabled={isSigningIn}
          >
            {t("authDialog.signInWithEmail")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
