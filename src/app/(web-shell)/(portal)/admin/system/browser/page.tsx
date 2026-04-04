"use client";

import { Copy, KeyRound, RefreshCcw, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PortalSettingsPage } from "@/components/portal/portal-settings-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { showErrorToast, showSuccessToast } from "@/lib/toast-utils";

type BrowserUpdateConfig = {
  releaseApiUrl: string;
  updateMode: "optional" | "required";
  minSupportedVersion: string;
  updateMessage: string;
  token: string;
};

const STORAGE_KEY = "buglogin.admin.browser-update-config.v1";

function createToken(): string {
  if (typeof window === "undefined" || !window.crypto) {
    return `bl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  }
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
  return `bl_${hex}`;
}

function readStoredConfig(): BrowserUpdateConfig {
  if (typeof window === "undefined") {
    return {
      releaseApiUrl: "https://api.buglogin.com/v1/browser/release",
      updateMode: "optional",
      minSupportedVersion: "",
      updateMessage: "",
      token: "",
    };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        releaseApiUrl: "https://api.buglogin.com/v1/browser/release",
        updateMode: "optional",
        minSupportedVersion: "",
        updateMessage: "",
        token: "",
      };
    }
    const parsed = JSON.parse(raw) as Partial<BrowserUpdateConfig>;
    return {
      releaseApiUrl:
        parsed.releaseApiUrl || "https://api.buglogin.com/v1/browser/release",
      updateMode: parsed.updateMode === "required" ? "required" : "optional",
      minSupportedVersion: parsed.minSupportedVersion || "",
      updateMessage: parsed.updateMessage || "",
      token: parsed.token || "",
    };
  } catch {
    return {
      releaseApiUrl: "https://api.buglogin.com/v1/browser/release",
      updateMode: "optional",
      minSupportedVersion: "",
      updateMessage: "",
      token: "",
    };
  }
}

export default function AdminBrowserUpdatePage() {
  const { t } = useTranslation();
  const defaults = useMemo(() => readStoredConfig(), []);
  const [releaseApiUrl, setReleaseApiUrl] = useState(defaults.releaseApiUrl);
  const [updateMode, setUpdateMode] = useState<"optional" | "required">(
    defaults.updateMode,
  );
  const [minSupportedVersion, setMinSupportedVersion] = useState(
    defaults.minSupportedVersion,
  );
  const [updateMessage, setUpdateMessage] = useState(defaults.updateMessage);
  const [token, setToken] = useState(defaults.token);

  const envSnippet = useMemo(
    () =>
      [
        `BUGLOGIN_RELEASE_API_URL=${releaseApiUrl || "https://api.buglogin.com/v1/browser/release"}`,
        `BUGLOGIN_RELEASE_API_TOKEN=${token || "<paste_token_here>"}`,
        "",
        `BUGLOGIN_BUGIUM_UPDATE_MODE=${updateMode}`,
        `BUGLOGIN_BUGOX_UPDATE_MODE=${updateMode}`,
        minSupportedVersion
          ? `BUGLOGIN_BUGIUM_MIN_SUPPORTED_VERSION=${minSupportedVersion}`
          : "BUGLOGIN_BUGIUM_MIN_SUPPORTED_VERSION=",
        minSupportedVersion
          ? `BUGLOGIN_BUGOX_MIN_SUPPORTED_VERSION=${minSupportedVersion}`
          : "BUGLOGIN_BUGOX_MIN_SUPPORTED_VERSION=",
        updateMessage
          ? `BUGLOGIN_BUGIUM_UPDATE_MESSAGE=${updateMessage}`
          : "BUGLOGIN_BUGIUM_UPDATE_MESSAGE=",
        updateMessage
          ? `BUGLOGIN_BUGOX_UPDATE_MESSAGE=${updateMessage}`
          : "BUGLOGIN_BUGOX_UPDATE_MESSAGE=",
      ].join("\n"),
    [minSupportedVersion, releaseApiUrl, token, updateMessage, updateMode],
  );

  const handleGenerateToken = () => {
    const next = createToken();
    setToken(next);
    showSuccessToast(t("portalSite.admin.browserUpdate.toastTokenGenerated"));
  };

  const handleSaveLocal = () => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          releaseApiUrl,
          updateMode,
          minSupportedVersion,
          updateMessage,
          token,
        } satisfies BrowserUpdateConfig),
      );
      showSuccessToast(t("portalSite.admin.browserUpdate.toastSaved"));
    } catch {
      showErrorToast(t("portalSite.admin.browserUpdate.toastSaveFailed"));
    }
  };

  const copyText = async (value: string, successKey: string) => {
    try {
      await navigator.clipboard.writeText(value);
      showSuccessToast(t(successKey));
    } catch {
      showErrorToast(t("portalSite.admin.browserUpdate.toastCopyFailed"));
    }
  };

  return (
    <PortalSettingsPage
      eyebrow={t("portalSite.admin.eyebrow")}
      title={t("portalSite.admin.browserUpdate.title")}
      description={t("portalSite.admin.browserUpdate.description")}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleGenerateToken}>
            <RefreshCcw className="h-4 w-4" />
            {t("portalSite.admin.browserUpdate.actions.generateToken")}
          </Button>
          <Button size="sm" onClick={handleSaveLocal}>
            {t("portalSite.admin.browserUpdate.actions.saveLocal")}
          </Button>
        </div>
      }
    >
      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {t("portalSite.admin.browserUpdate.secretTitle")}
          </h2>
          <Badge variant="outline">
            {t("portalSite.admin.browserUpdate.required")}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="release-api-url">
              {t("portalSite.admin.browserUpdate.fields.releaseApiUrl")}
            </Label>
            <Input
              id="release-api-url"
              value={releaseApiUrl}
              onChange={(event) => {
                setReleaseApiUrl(event.target.value);
              }}
              placeholder="https://api.buglogin.com/v1/browser/release"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="release-api-token">
              {t("portalSite.admin.browserUpdate.fields.releaseApiToken")}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="release-api-token"
                value={token}
                onChange={(event) => {
                  setToken(event.target.value);
                }}
                placeholder="bl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => {
                  void copyText(
                    token,
                    "portalSite.admin.browserUpdate.toastTokenCopied",
                  );
                }}
                aria-label={t(
                  "portalSite.admin.browserUpdate.actions.copyToken",
                )}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            {t("portalSite.admin.browserUpdate.policyTitle")}
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="update-mode">
              {t("portalSite.admin.browserUpdate.fields.updateMode")}
            </Label>
            <Input
              id="update-mode"
              value={updateMode}
              onChange={(event) => {
                const next = event.target.value.toLowerCase();
                setUpdateMode(next === "required" ? "required" : "optional");
              }}
              placeholder="optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min-supported-version">
              {t("portalSite.admin.browserUpdate.fields.minSupportedVersion")}
            </Label>
            <Input
              id="min-supported-version"
              value={minSupportedVersion}
              onChange={(event) => {
                setMinSupportedVersion(event.target.value);
              }}
              placeholder="1.0.0"
            />
          </div>
          <div className="space-y-2 md:col-span-1">
            <Label htmlFor="update-message">
              {t("portalSite.admin.browserUpdate.fields.updateMessage")}
            </Label>
            <Input
              id="update-message"
              value={updateMessage}
              onChange={(event) => {
                setUpdateMessage(event.target.value);
              }}
              placeholder={t(
                "portalSite.admin.browserUpdate.fields.updateMessagePlaceholder",
              )}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("portalSite.admin.browserUpdate.envTitle")}
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              void copyText(
                envSnippet,
                "portalSite.admin.browserUpdate.toastEnvCopied",
              );
            }}
          >
            <Copy className="h-4 w-4" />
            {t("portalSite.admin.browserUpdate.actions.copyEnv")}
          </Button>
        </div>
        <Textarea
          readOnly
          value={envSnippet}
          className="min-h-[220px] font-mono text-xs"
        />
      </section>
    </PortalSettingsPage>
  );
}
