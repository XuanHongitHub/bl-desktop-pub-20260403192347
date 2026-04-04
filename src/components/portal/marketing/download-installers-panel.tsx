"use client";

import { Download, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type InstallerAsset = {
  id: number;
  name: string;
  size: number;
  downloadUrl: string;
  updatedAt: string;
  platformHint:
    | "windows-x64"
    | "windows-arm64"
    | "macos-x64"
    | "macos-arm64"
    | "linux-x64"
    | "unknown";
};

type LatestDesktopReleaseResponse = {
  repo: string;
  tagName: string;
  publishedAt: string | null;
  assets: InstallerAsset[];
};

type InstallerSlot = {
  key: "windows" | "macIntel" | "macApple" | "linux";
  labelKey: string;
  asset: InstallerAsset | null;
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 100 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded} ${units[unitIndex]}`;
}

function detectPreferredKey(): InstallerSlot["key"] {
  if (typeof window === "undefined") return "windows";
  const ua = window.navigator.userAgent.toLowerCase();
  const platform = (window.navigator.platform ?? "").toLowerCase();
  if (platform.includes("mac") || ua.includes("mac os")) {
    if (ua.includes("arm") || ua.includes("aarch64")) {
      return "macApple";
    }
    return "macIntel";
  }
  if (platform.includes("linux") || ua.includes("linux")) {
    return "linux";
  }
  return "windows";
}

export function DownloadInstallersPanel() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<LatestDesktopReleaseResponse | null>(
    null,
  );
  const [preferredKey, setPreferredKey] =
    useState<InstallerSlot["key"]>("windows");

  useEffect(() => {
    setPreferredKey(detectPreferredKey());
    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/desktop-release/latest", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const json = (await response.json()) as LatestDesktopReleaseResponse;
        setPayload(json);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => controller.abort();
  }, []);

  const installers = useMemo<InstallerSlot[]>(() => {
    const assets = payload?.assets ?? [];
    const pick = (matcher: (asset: InstallerAsset) => boolean) =>
      assets.find(matcher) ?? null;
    return [
      {
        key: "windows",
        labelKey: "portalSite.downloadPage.installers.windows",
        asset: pick(
          (asset) =>
            asset.platformHint === "windows-x64" ||
            asset.platformHint === "windows-arm64",
        ),
      },
      {
        key: "macApple",
        labelKey: "portalSite.downloadPage.installers.macApple",
        asset: pick((asset) => asset.platformHint === "macos-arm64"),
      },
      {
        key: "macIntel",
        labelKey: "portalSite.downloadPage.installers.macIntel",
        asset: pick((asset) => asset.platformHint === "macos-x64"),
      },
      {
        key: "linux",
        labelKey: "portalSite.downloadPage.installers.linux",
        asset: pick((asset) => asset.platformHint === "linux-x64"),
      },
    ];
  }, [payload?.assets]);

  const preferredAsset =
    installers.find((item) => item.key === preferredKey)?.asset ??
    installers.find((item) => item.asset !== null)?.asset ??
    null;

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {t("portalSite.downloadPage.installers.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("portalSite.downloadPage.installers.description")}
        </p>
        {payload?.tagName ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("portalSite.downloadPage.installers.latest", {
              tag: payload.tagName,
            })}
          </p>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{t("portalSite.downloadPage.installers.loading")}</span>
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">
          {t("portalSite.downloadPage.installers.error")}
        </p>
      ) : null}

      {preferredAsset ? (
        <div className="mb-4 rounded-lg border border-border bg-background/70 p-3">
          <Button asChild className="w-full justify-between" size="sm">
            <a href={preferredAsset.downloadUrl}>
              <span>
                {t("portalSite.downloadPage.installers.downloadForCurrentOs")}
              </span>
              <span className="inline-flex items-center gap-2 text-xs">
                {preferredAsset.name}
                <Download className="h-4 w-4" />
              </span>
            </a>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        {installers.map((installer) => (
          <div
            key={installer.key}
            className="rounded-lg border border-border bg-background/70 p-3"
          >
            <p className="text-sm font-medium text-foreground">
              {t(installer.labelKey)}
            </p>
            {installer.asset ? (
              <>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {installer.asset.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatBytes(installer.asset.size)}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-3">
                  <a href={installer.asset.downloadUrl}>
                    {t("portalSite.downloadPage.installers.download")}
                  </a>
                </Button>
              </>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("portalSite.downloadPage.installers.empty")}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
